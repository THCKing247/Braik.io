import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"
import { createNotifications } from "@/lib/utils/notifications"
import {
  parseRosterCsv,
  rosterKeyByEmail,
  rosterKeyByNameJersey,
  type ParsedRosterRow,
} from "@/lib/roster-import"
import { assertCanAddActivePlayers } from "@/lib/billing/roster-entitlement"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"
import { revalidateTeamRosterDerivedCaches } from "@/lib/cache/lightweight-get-cache"

const IMPORT_MODES = ["create_only", "create_or_update", "replace_roster"] as const
export type ImportMode = (typeof IMPORT_MODES)[number]

function parseImportMode(value: string | null): ImportMode {
  if (value && IMPORT_MODES.includes(value as ImportMode)) return value as ImportMode
  return "create_only"
}

/** DB row shape for existing player (minimal fields needed for matching and update). */
type ExistingPlayer = {
  id: string
  team_id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  email: string | null
}

/**
 * POST /api/roster/import
 * Imports players from CSV. Supports create_only, create_or_update, replace_roster.
 * FormData: file, teamId, importMode (optional, default create_only).
 * Expected CSV columns (case-insensitive): First Name, Last Name, Grade, Jersey Number, Position, Email, Notes, Weight, Height.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const teamId = formData.get("teamId") as string | null
    const importMode = parseImportMode(formData.get("importMode") as string | null)

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")
    const supabase = getSupabaseServer()

    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const text = await file.text()
    const { rows: parsedRows, errors: parseErrors } = parseRosterCsv(text)
    if (parsedRows.length === 0 && parseErrors.length === 0) {
      return NextResponse.json({ error: "CSV file is empty or has no valid rows" }, { status: 400 })
    }
    if (parsedRows.length === 0) {
      return NextResponse.json(
        { error: "No valid players found in CSV", parseErrors: parseErrors.slice(0, 20) },
        { status: 400 }
      )
    }

    const totalRows = parsedRows.length
    const conflicts: Array<{ row: number; reason: string }> = []
    const skippedRows: Array<{ row: number; reason: string }> = []
    let created = 0
    let updated = 0
    let replacedCount = 0

    if (importMode === "replace_roster") {
      // Delete all existing players for this team. FK references use ON DELETE CASCADE,
      // so related rows (injuries, follow-ups, guardian_links, etc.) are removed.
      const { data: deleted, error: deleteErr } = await supabase
        .from("players")
        .delete()
        .eq("team_id", teamId)
        .select("id")
      if (deleteErr) {
        console.error("[POST /api/roster/import] replace_roster delete failed", deleteErr)
        return NextResponse.json(
          { error: "Failed to replace roster; delete failed.", details: deleteErr.message },
          { status: 500 }
        )
      }
      replacedCount = (deleted ?? []).length
    }

    let existingPlayers: ExistingPlayer[] = []
    const byEmailSingle = new Map<string, string>()
    const byNameJerseySingle = new Map<string, string>()
    const ambiguousEmailKeys = new Set<string>()
    const ambiguousNameJerseyKeys = new Set<string>()

    if (importMode === "create_or_update") {
      const { data: existing, error: fetchErr } = await supabase
        .from("players")
        .select("id, team_id, first_name, last_name, jersey_number, email")
        .eq("team_id", teamId)
      if (fetchErr) {
        console.error("[POST /api/roster/import] fetch existing roster failed", fetchErr)
        return NextResponse.json({ error: "Failed to load existing roster" }, { status: 500 })
      }
      existingPlayers = (existing ?? []) as ExistingPlayer[]

      const emailToIds = new Map<string, string[]>()
      for (const p of existingPlayers) {
        const key = rosterKeyByEmail(teamId, p.email)
        if (!key) continue
        const list = emailToIds.get(key) ?? []
        list.push(p.id)
        emailToIds.set(key, list)
      }
      for (const [key, ids] of emailToIds) {
        if (ids.length === 1) byEmailSingle.set(key, ids[0])
        else ambiguousEmailKeys.add(key)
      }

      const nameJerseyToIds = new Map<string, string[]>()
      for (const p of existingPlayers) {
        const key = rosterKeyByNameJersey(
          teamId,
          p.first_name,
          p.last_name,
          p.jersey_number
        )
        const list = nameJerseyToIds.get(key) ?? []
        list.push(p.id)
        nameJerseyToIds.set(key, list)
      }
      for (const [key, ids] of nameJerseyToIds) {
        if (ids.length === 1) byNameJerseySingle.set(key, ids[0])
        else ambiguousNameJerseyKeys.add(key)
      }
    }

    const toInsert: Array<{
      team_id: string
      first_name: string
      last_name: string
      grade: number | null
      jersey_number: number | null
      position_group: string | null
      email: string | null
      notes: string | null
      weight: number | null
      height: string | null
      status: string
      created_by: string
    }> = []
    const toUpdate: Array<{ id: string; row: ParsedRosterRow }> = []
    const matchedIds = new Set<string>()

    for (const row of parsedRows) {
      if (importMode === "create_only") {
        toInsert.push(buildInsertRow(row, teamId, session.user.id))
        continue
      }

      if (importMode === "replace_roster") {
        toInsert.push(buildInsertRow(row, teamId, session.user.id))
        continue
      }

      // create_or_update: match by Priority 1 (email) then Priority 2 (name + jersey). Ambiguous keys = conflict.
      const emailKey = rosterKeyByEmail(teamId, row.email)
      if (emailKey && ambiguousEmailKeys.has(emailKey)) {
        conflicts.push({ row: row.rowIndex, reason: "Multiple existing players share this email; cannot determine which to update" })
        continue
      }
      const nameJerseyKey = rosterKeyByNameJersey(
        teamId,
        row.first_name,
        row.last_name,
        row.jersey_number
      )
      if (ambiguousNameJerseyKeys.has(nameJerseyKey)) {
        conflicts.push({ row: row.rowIndex, reason: "Multiple existing players share this name and jersey number; cannot determine which to update" })
        continue
      }
      let matchedId: string | null = null
      if (emailKey) matchedId = byEmailSingle.get(emailKey) ?? null
      if (!matchedId) matchedId = byNameJerseySingle.get(nameJerseyKey) ?? null

      if (matchedId) {
        if (matchedIds.has(matchedId)) {
          conflicts.push({
            row: row.rowIndex,
            reason: "CSV row matches an existing player that was already matched by another row",
          })
          continue
        }
        matchedIds.add(matchedId)
        toUpdate.push({ id: matchedId, row })
      } else {
        toInsert.push(buildInsertRow(row, teamId, session.user.id))
      }
    }

    function buildInsertRow(
      row: ParsedRosterRow,
      tid: string,
      createdBy: string
    ) {
      const positionGroup = row.position_group?.trim()
      return {
        team_id: tid,
        first_name: row.first_name,
        last_name: row.last_name,
        grade: row.grade,
        jersey_number: row.jersey_number,
        position_group: positionGroup ? positionGroup.toUpperCase() : null,
        email: row.email,
        notes: row.notes,
        weight: row.weight,
        height: row.height,
        status: "active",
        created_by: createdBy,
      }
    }

    for (const { id, row } of toUpdate) {
      const positionGroup = row.position_group?.trim()
      const { error: updateErr } = await supabase
        .from("players")
        .update({
          first_name: row.first_name,
          last_name: row.last_name,
          grade: row.grade,
          jersey_number: row.jersey_number,
          position_group: positionGroup ? positionGroup.toUpperCase() : null,
          email: row.email,
          notes: row.notes,
          weight: row.weight,
          height: row.height,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
      if (updateErr) {
        console.error("[POST /api/roster/import] update failed for player", id, updateErr)
        skippedRows.push({ row: row.rowIndex, reason: updateErr.message })
      } else {
        updated++
      }
    }

    let inserted: Array<Record<string, unknown>> = []
    if (toInsert.length > 0) {
      const cap = await assertCanAddActivePlayers(supabase, teamId, toInsert.length)
      if (!cap.ok) {
        return NextResponse.json(
          {
            error: cap.message,
            code: "ROSTER_LIMIT_REACHED",
            limit: cap.limit,
            current: cap.current,
          },
          { status: 402 }
        )
      }
      const { data: insertedRows, error: insertError } = await supabase
        .from("players")
        .insert(toInsert)
        .select("id, first_name, last_name, grade, jersey_number, position_group, status, notes, image_url, email, invite_code, invite_status, claimed_at, user_id, weight, height")
      if (insertError) {
        console.error("[POST /api/roster/import]", insertError)
        return NextResponse.json(
          { error: "Failed to import players", details: insertError.message },
          { status: 500 }
        )
      }
      inserted = (insertedRows ?? []) as Array<Record<string, unknown>>
      created = inserted.length
    }

    const players = inserted.map((p: Record<string, unknown>) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      grade: p.grade,
      jerseyNumber: p.jersey_number,
      positionGroup: p.position_group,
      status: p.status ?? "active",
      notes: p.notes,
      imageUrl: normalizePlayerImageUrl(p.image_url as string | null),
      email: p.email ?? null,
      inviteCode: p.invite_code ?? null,
      inviteStatus: (p.invite_status as string) || "not_invited",
      claimedAt: p.claimed_at ?? null,
      weight: p.weight ?? null,
      height: p.height ?? null,
      user: p.user_id ? { email: "" } : null,
      guardianLinks: [],
    }))

    const summary = {
      totalRows,
      created,
      updated,
      skipped: skippedRows.length,
      conflicts: conflicts.length,
      ...(importMode === "replace_roster" && { replaced: replacedCount }),
    }

    if (created > 0 || updated > 0 || (importMode === "replace_roster" && replacedCount > 0)) {
      try {
        const parts = [
          created > 0 ? `${created} added` : null,
          updated > 0 ? `${updated} updated` : null,
          importMode === "replace_roster" && replacedCount > 0 ? `roster replaced (${replacedCount} removed)` : null,
        ].filter(Boolean)
        await createNotifications({
          type: "roster_import",
          teamId,
          title: "Roster updated (import)",
          body: parts.join(" · ") || "Import completed",
          linkType: "roster",
          excludeUserIds: [session.user.id],
        })
      } catch {
        /* non-fatal */
      }
    }

    trackProductEventServer({
      eventName: BRAIK_EVENTS.roster.import_completed,
      userId: session.user.id,
      teamId,
      role: session.user.role ?? null,
      metadata: {
        import_mode: importMode,
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        conflicts: summary.conflicts,
      },
    })

    if (created > 0 || updated > 0 || (importMode === "replace_roster" && replacedCount > 0)) {
      revalidateTeamRosterDerivedCaches(teamId)
    }

    return NextResponse.json({
      success: true,
      importMode,
      summary,
      conflicts: conflicts.slice(0, 100),
      skippedRows: skippedRows.slice(0, 100),
      parseErrors: parseErrors.length > 0 ? parseErrors.slice(0, 50) : undefined,
      players,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to import roster"
    console.error("[POST /api/roster/import]", error)
    return NextResponse.json(
      { error: message },
      { status: message.includes("Access denied") ? 403 : 500 }
    )
  }
}
