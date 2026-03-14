/**
 * POST /api/stats/import
 * Body: FormData with "file" (CSV), "teamId", and optional "preview" ("1" or "true").
 * - preview=1: validate and match only; return summary and matchedPlayers; no DB updates.
 * - Otherwise: mass-update player season_stats for existing players. Team-scoped only; no new players created.
 *
 * Matching: 1) valid player_id on team, 2) else first_name + last_name + jersey_number (exact).
 *
 * Maintainer notes:
 * - player_id is preferred: stable UUID avoids ambiguity when names/jersey match multiple players.
 * - Duplicate rows are rejected (only first occurrence applied) so coaches get clear errors instead of silent overwrites.
 * - Same-value detection skips DB writes when merged stats equal existing; reduces no-op updates and makes noChangeReason accurate.
 * - Blank stat cells do not overwrite: we only send keys that were present in the CSV row, so existing values are preserved.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import {
  parseAndValidateStatsCsv,
  mergeStatsIntoSeasonStats,
  seasonStatsEqualForImportKeys,
  type RowError,
} from "@/lib/stats-import"
import {
  STATS_IMPORT_MAX_FILE_BYTES,
  STATS_IMPORT_MAX_DATA_ROWS,
  STAT_DB_KEYS,
} from "@/lib/stats-import-fields"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CSV_EXTENSION = /\.csv$/i
const CSV_MIME = /^text\/(csv|plain)|application\/csv$/i

function isCsvFile(file: File): boolean {
  const name = file.name || ""
  const type = file.type || ""
  return CSV_EXTENSION.test(name) || CSV_MIME.test(type)
}

export type StatsImportResponse = {
  success: boolean
  mode: "preview" | "import"
  summary: {
    processed: number
    matched: number
    updated: number
    skipped: number
    errors: number
  }
  rowErrors: Array<{ row: number; field?: string; message: string }>
  matchedPlayers?: Array<{ playerId: string; name: string }>
  noChange?: boolean
  noChangeReason?: "blank_stats" | "same_values" | "mixed_no_changes"
  error?: string
}

function buildResponse(
  mode: "preview" | "import",
  summary: { processed: number; matched: number; updated: number; skipped: number; errors: number },
  rowErrors: RowError[],
  matchedPlayers?: Array<{ playerId: string; name: string }>,
  noChange?: boolean,
  noChangeReason?: "blank_stats" | "same_values" | "mixed_no_changes",
  error?: string
): StatsImportResponse {
  const success = error ? false : (rowErrors.length === 0 || summary.updated > 0)
  return {
    success,
    mode,
    summary: {
      processed: summary.processed,
      matched: summary.matched,
      updated: summary.updated,
      skipped: summary.skipped,
      errors: rowErrors.length,
    },
    rowErrors: rowErrors.map((e) => ({ row: e.row, field: e.field, message: e.message })),
    ...(matchedPlayers?.length ? { matchedPlayers } : undefined),
    ...(noChange ? { noChange: true } : undefined),
    ...(noChangeReason ? { noChangeReason } : undefined),
    ...(error ? { error } : undefined),
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch (e) {
      console.error("[POST /api/stats/import] formData parse failed", e)
      return NextResponse.json(
        { error: "Invalid upload. Please try again with a CSV file." },
        { status: 400 }
      )
    }

    const file = formData.get("file") as File | null
    const teamId = (formData.get("teamId") as string)?.trim()
    const preview = formData.get("preview") === "1" || formData.get("preview") === "true"

    if (!teamId) {
      return NextResponse.json({ error: "Team is required." }, { status: 400 })
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Please choose a CSV file to upload." }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Import file is empty." },
        { status: 400 }
      )
    }
    if (file.size > STATS_IMPORT_MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Import file is too large. Please split it into smaller batches." },
        { status: 400 }
      )
    }
    if (!isCsvFile(file)) {
      return NextResponse.json(
        { error: "Please upload a CSV file (.csv)." },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found. Please refresh and try again." }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    let csvText: string
    try {
      csvText = await file.text()
    } catch (e) {
      console.error("[POST /api/stats/import] file.text() failed", e)
      return NextResponse.json(
        { error: "Something went wrong reading your file. Please check the format and try again." },
        { status: 400 }
      )
    }
    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json(
        { error: "Import file is empty." },
        { status: 400 }
      )
    }

    let parsed: { rows: ReturnType<typeof parseAndValidateStatsCsv>["rows"]; errors: ReturnType<typeof parseAndValidateStatsCsv>["errors"]; dataRowCount: number }
    try {
      parsed = parseAndValidateStatsCsv(csvText)
    } catch (e) {
      console.error("[POST /api/stats/import] parse failed", e)
      return NextResponse.json(
        { error: "Something went wrong processing your file. Please check the format and try again." },
        { status: 400 }
      )
    }
    const { rows, errors: parseErrors, dataRowCount } = parsed
    if (dataRowCount > STATS_IMPORT_MAX_DATA_ROWS) {
      return NextResponse.json(
        { error: "Import file is too large. Please split it into smaller batches." },
        { status: 400 }
      )
    }

    const rowErrors: RowError[] = parseErrors.map((e) => ({ row: e.row, field: e.field, message: e.message }))
    let processed = 0
    let matched = 0
    let updated = 0
    let skipped = 0
    let sameValues = 0
    let hadRowsWithStats = false
    const matchedPlayers: Array<{ playerId: string; name: string }> = []
    const seenPlayerIds = new Set<string>()

    if (rows.length === 0 && rowErrors.length === 0) {
      const mode = preview ? "preview" : "import"
      console.log("[stats/import]", { teamId, mode, processed: 0, matched: 0, updated: 0, skipped: 0, errors: 0 })
      return NextResponse.json(
        buildResponse(mode, { processed: 0, matched: 0, updated: 0, skipped: 0, errors: 0 }, [], undefined, undefined, undefined)
      )
    }

    const { data: teamPlayers, error: playersErr } = await supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number, season_stats")
      .eq("team_id", teamId)

    if (playersErr || !teamPlayers?.length) {
      if (playersErr) console.error("[POST /api/stats/import] players fetch failed", playersErr)
      const mode = preview ? "preview" : "import"
      console.log("[stats/import]", { teamId, mode, processed: rows.length, matched: 0, updated: 0, skipped: rows.length, errors: rowErrors.length })
      return NextResponse.json(
        buildResponse(
          mode,
          { processed: rows.length, matched: 0, updated: 0, skipped: rows.length, errors: rowErrors.length },
          rowErrors
        )
      )
    }

    const byId = new Map<string, (typeof teamPlayers)[0]>()
    const byNameJersey = new Map<string, (typeof teamPlayers)[0][]>()
    for (const p of teamPlayers) {
      const row = p as { id: string; first_name: string; last_name: string; jersey_number: number | null }
      byId.set(row.id, p)
      const first = (row.first_name ?? "").trim().toLowerCase()
      const last = (row.last_name ?? "").trim().toLowerCase()
      const jersey = row.jersey_number != null ? String(row.jersey_number) : ""
      const key = `${first}|${last}|${jersey}`
      const list = byNameJersey.get(key) ?? []
      list.push(p)
      byNameJersey.set(key, list)
    }

    for (const row of rows) {
      processed++
      let player: (typeof teamPlayers)[0] | null = null

      const pid = row.player_id.trim()
      if (pid && UUID_REGEX.test(pid)) {
        const found = byId.get(pid)
        if (found) player = found
      }

      if (!player) {
        const first = row.first_name.trim().toLowerCase()
        const last = row.last_name.trim().toLowerCase()
        const jersey = row.jersey_number.trim()
        const key = `${first}|${last}|${jersey}`
        const candidates = byNameJersey.get(key) ?? []
        if (candidates.length === 0) {
          skipped++
          rowErrors.push({ row: row.rowIndex, message: "No matching player found" })
          continue
        }
        if (candidates.length > 1) {
          skipped++
          rowErrors.push({
            row: row.rowIndex,
            message: "Multiple players match (ambiguous); use player_id to identify",
          })
          continue
        }
        player = candidates[0]
      }

      const playerId = (player as { id: string }).id
      if (seenPlayerIds.has(playerId)) {
        skipped++
        rowErrors.push({
          row: row.rowIndex,
          message: "Duplicate player row in import file; this player already appeared earlier in the CSV",
        })
        continue
      }
      seenPlayerIds.add(playerId)

      const hasStatsToApply = Object.keys(row.stats).length > 0
      if (!hasStatsToApply) {
        skipped++
        matched++
        continue
      }

      hadRowsWithStats = true
      const firstName = (player as { first_name?: string }).first_name ?? ""
      const lastName = (player as { last_name?: string }).last_name ?? ""
      matchedPlayers.push({ playerId, name: `${firstName} ${lastName}`.trim() || playerId })
      matched++

      if (preview) {
        updated++
        continue
      }

      const existingStats = (player as { season_stats?: unknown }).season_stats as Record<string, unknown> | null
      const merged = mergeStatsIntoSeasonStats(existingStats, row.stats)

      if (seasonStatsEqualForImportKeys(existingStats, merged as Record<string, unknown>, [...STAT_DB_KEYS])) {
        sameValues++
        continue
      }

      const { error: updateErr } = await supabase
        .from("players")
        .update({
          season_stats: merged,
          updated_at: new Date().toISOString(),
        })
        .eq("id", playerId)
        .eq("team_id", teamId)

      if (updateErr) {
        rowErrors.push({ row: row.rowIndex, message: `Update failed: ${updateErr.message}` })
        skipped++
        continue
      }
      updated++
    }

    const summary = {
      processed,
      matched,
      updated,
      skipped,
      errors: rowErrors.length,
    }
    const noChange = !preview && processed > 0 && updated === 0 && rowErrors.length === 0
    let noChangeReason: "blank_stats" | "same_values" | "mixed_no_changes" | undefined
    if (noChange) {
      if (!hadRowsWithStats) noChangeReason = "blank_stats"
      else if (sameValues > 0) noChangeReason = "same_values"
      else noChangeReason = "mixed_no_changes"
    }

    console.log("[stats/import]", {
      teamId,
      mode: preview ? "preview" : "import",
      processed: summary.processed,
      matched: summary.matched,
      updated: summary.updated,
      skipped: summary.skipped,
      errors: summary.errors,
      sameValues: preview ? undefined : sameValues,
      noChange: preview ? undefined : noChange,
      noChangeReason: preview ? undefined : noChangeReason,
    })

    return NextResponse.json(
      buildResponse(
        preview ? "preview" : "import",
        summary,
        rowErrors,
        matchedPlayers.length ? matchedPlayers : undefined,
        noChange,
        noChangeReason,
        undefined
      )
    )
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[POST /api/stats/import] membership lookup failed", { error: err.message })
      return NextResponse.json({ error: "Failed to process import" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Insufficient")) {
      return NextResponse.json(
        { error: "You don't have permission to update roster stats.", code: "FORBIDDEN" },
        { status: 403 }
      )
    }
    console.error("[POST /api/stats/import]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
