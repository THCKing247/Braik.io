/**
 * POST /api/stats/import
 * Body: FormData with "file" (CSV), "teamId", optional "importMode", optional "preview" ("1" or "true").
 *
 * Source of truth: player_weekly_stat_entries. players.season_stats is a derived cache
 * (rebuilt by recalculateSeasonStatsFromWeeklyForPlayers). This route never merges CSV stats into season_stats.
 *
 * - importMode omitted, "weekly_entries", or "weekly" → weekly row import + audit + recalc.
 * - importMode "season_totals" → 400 (deprecated).
 * - preview=1: validate only; no DB writes.
 *
 * Matching: 1) valid player_id on team, 2) else first_name + last_name + jersey_number (exact).
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { parseAndValidateWeeklyStatsCsv, type RowError } from "@/lib/stats-import"
import { STATS_IMPORT_MAX_FILE_BYTES, STATS_IMPORT_MAX_DATA_ROWS } from "@/lib/stats-import-fields"
import { normalizeWeeklyStatsForStorage, sanitizeWeeklyStatsInput } from "@/lib/stats-weekly-api"
import { recalculateSeasonStatsFromWeeklyForPlayers } from "@/lib/stats-weekly-season-sync"
import {
  insertWeeklyStatEntryAudit,
  weeklyEntryRowToAuditSnapshot,
} from "@/lib/stats-weekly-audit"

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

async function runWeeklyStatsImport(
  supabase: ReturnType<typeof getSupabaseServer>,
  teamId: string,
  csvText: string,
  preview: boolean,
  userId: string
) {
  let parsed: ReturnType<typeof parseAndValidateWeeklyStatsCsv>
  try {
    parsed = parseAndValidateWeeklyStatsCsv(csvText)
  } catch (e) {
    console.error("[POST /api/stats/import] weekly parse failed", e)
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
  const matchedPlayers: Array<{ playerId: string; name: string }> = []
  let processed = 0
  let matched = 0
  let updated = 0
  let skipped = 0

  if (rows.length === 0 && rowErrors.length === 0) {
    const mode = preview ? "preview" : "import"
    return NextResponse.json(
      buildResponse(mode, { processed: 0, matched: 0, updated: 0, skipped: 0, errors: 0 }, [], undefined, undefined, undefined)
    )
  }

  const { data: teamPlayers, error: playersErr } = await supabase
    .from("players")
    .select("id, first_name, last_name, jersey_number")
    .eq("team_id", teamId)

  if (playersErr || !teamPlayers?.length) {
    if (playersErr) console.error("[POST /api/stats/import] weekly players fetch failed", playersErr)
    const mode = preview ? "preview" : "import"
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

  type InsertRow = {
    team_id: string
    player_id: string
    season_year: number | null
    week_number: number | null
    game_id: string | null
    opponent: string | null
    game_date: string | null
    stats: Record<string, number>
    created_by: string
    updated_by: string
  }

  const toInsert: InsertRow[] = []
  const affectedPlayerIds = new Set<string>()

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
    const firstName = (player as { first_name?: string }).first_name ?? ""
    const lastName = (player as { last_name?: string }).last_name ?? ""

    let opponent = row.opponent
    let gameDate = row.game_date
    const gid = row.game_id

    if (gid) {
      const { data: gameRow } = await supabase
        .from("games")
        .select("id, team_id, opponent, game_date")
        .eq("id", gid)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!gameRow) {
        skipped++
        rowErrors.push({ row: row.rowIndex, field: "game_id", message: "game_id does not match a game for this team" })
        continue
      }
      const gr = gameRow as { opponent?: string | null; game_date?: string }
      if (!opponent && gr.opponent) opponent = gr.opponent
      if (!gameDate && gr.game_date) gameDate = String(gr.game_date).slice(0, 10)
    }

    const stats = normalizeWeeklyStatsForStorage(sanitizeWeeklyStatsInput(row.stats))
    if (Object.keys(stats).length === 0) {
      skipped++
      rowErrors.push({ row: row.rowIndex, message: "No valid stat values after sanitization" })
      continue
    }

    matchedPlayers.push({ playerId, name: `${firstName} ${lastName}`.trim() || playerId })
    matched++

    if (preview) {
      updated++
      continue
    }

    toInsert.push({
      team_id: teamId,
      player_id: playerId,
      season_year: row.season_year,
      week_number: row.week_number,
      game_id: gid,
      opponent,
      game_date: gameDate,
      stats,
      created_by: userId,
      updated_by: userId,
    })
    affectedPlayerIds.add(playerId)
  }

  if (preview) {
    const summary = { processed, matched, updated, skipped, errors: rowErrors.length }
    return NextResponse.json(
      buildResponse("preview", summary, rowErrors, matchedPlayers.length ? matchedPlayers : undefined)
    )
  }

  const CHUNK = 100
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK)
    const { data: inserted, error: insErr } = await supabase.from("player_weekly_stat_entries").insert(chunk).select("*")
    if (insErr) {
      console.error("[POST /api/stats/import] weekly insert", insErr)
      return NextResponse.json({ error: "Failed to import weekly stat rows." }, { status: 500 })
    }
    for (const r of inserted ?? []) {
      await insertWeeklyStatEntryAudit(supabase, {
        entryId: r.id as string,
        teamId,
        action: "create",
        beforeData: null,
        afterData: weeklyEntryRowToAuditSnapshot(r as Record<string, unknown>),
        actedBy: userId,
      })
    }
    updated += (inserted ?? []).length
  }

  await recalculateSeasonStatsFromWeeklyForPlayers(supabase, teamId, [...affectedPlayerIds])

  const summary = {
    processed,
    matched,
    updated,
    skipped,
    errors: rowErrors.length,
  }
  console.log("[stats/import weekly]", { teamId, processed: summary.processed, updated: summary.updated })

  return NextResponse.json(
    buildResponse("import", summary, rowErrors, matchedPlayers.length ? matchedPlayers : undefined)
  )
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
    const importModeRaw = (formData.get("importMode") as string)?.trim().toLowerCase()

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

    if (importModeRaw === "season_totals") {
      return NextResponse.json(
        {
          error:
            "Season totals CSV import is no longer supported. Standard stat totals are derived only from weekly/game rows. Download the weekly stats template and use importMode weekly_entries (or omit importMode).",
          code: "STATS_IMPORT_SEASON_TOTALS_DEPRECATED",
        },
        { status: 400 }
      )
    }

    return runWeeklyStatsImport(supabase, teamId, csvText, preview, session.user.id)
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
