/**
 * POST /api/teams/[teamId]/games/import — multipart CSV bulk import (edit_roster).
 * Idempotent: same (team, opponent, kickoff) updates the existing row; re-import does not duplicate.
 */
import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { resolveSeasonIdForTeam } from "@/lib/team-season-resolve"
import type { ParsedGameImportRow } from "@/lib/games-import-csv"
import { parseGamesScheduleCsv } from "@/lib/games-import-csv"
import { canonicalGameDateIso, normalizeOpponentForSchedule, scheduleGameIdentityKey } from "@/lib/games/schedule-game-identity"
import { revalidateTeamCalendar, revalidateTeamGamesAndDashboard } from "@/lib/cache/lightweight-get-cache"
import { upsertCalendarEventForGame } from "@/lib/games/sync-game-calendar-event"

const CSV_EXTENSION = /\.csv$/i
const CSV_MIME = /^text\/(csv|plain)|application\/csv$/i

function isCsvFile(file: File): boolean {
  const name = file.name || ""
  const type = file.type || ""
  return CSV_EXTENSION.test(name) || CSV_MIME.test(type)
}

type ExistingGameRow = {
  id: string
  opponent: string | null
  game_date: string
  location: string | null
  game_type: string | null
  conference_game: boolean | null
  notes: string | null
  season_id: string | null
}

function buildIdentityMap(rows: ExistingGameRow[], teamId: string): Map<string, ExistingGameRow> {
  const m = new Map<string, ExistingGameRow>()
  for (const r of rows) {
    m.set(scheduleGameIdentityKey(teamId, r.opponent ?? "", r.game_date), r)
  }
  return m
}

function findExistingInMap(
  map: Map<string, ExistingGameRow>,
  teamId: string,
  parsed: ParsedGameImportRow
): ExistingGameRow | undefined {
  return map.get(scheduleGameIdentityKey(teamId, parsed.opponent, parsed.gameDateIso))
}

/**
 * First occurrence wins; later rows with same identity are skipped (file-level dedupe).
 */
function dedupeFileRows(rows: ParsedGameImportRow[]): {
  rows: ParsedGameImportRow[]
  skippedDuplicateInFile: number
} {
  const seen = new Set<string>()
  const out: ParsedGameImportRow[] = []
  let skippedDuplicateInFile = 0
  for (const r of rows) {
    const key = `${normalizeOpponentForSchedule(r.opponent)}\u0000${canonicalGameDateIso(r.gameDateIso)}`
    if (seen.has(key)) {
      skippedDuplicateInFile++
      continue
    }
    seen.add(key)
    out.push(r)
  }
  return { rows: out, skippedDuplicateInFile }
}

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const importRequestId = randomUUID()
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId?.trim()) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }
    if (!isCsvFile(file)) {
      return NextResponse.json({ error: "Upload a CSV file" }, { status: 400 })
    }

    console.info("[games import] request start", { importRequestId, teamId, fileName: file.name })

    const text = await file.text()
    const parsed = parseGamesScheduleCsv(text)
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          created: 0,
          updated: 0,
          inserted: 0,
          skippedDuplicateInFile: 0,
          parseErrors: parsed.errors,
          rowErrors: [] as Array<{ row: number; message: string }>,
          importRequestId,
        },
        { status: 400 }
      )
    }

    const { rows: fileUniqueRows, skippedDuplicateInFile } = dedupeFileRows(parsed.rows)

    if (fileUniqueRows.length === 0) {
      revalidatePath("/dashboard")
      revalidatePath("/dashboard/schedule")
      revalidatePath("/dashboard/calendar")
      revalidateTeamGamesAndDashboard(teamId)
      revalidateTeamCalendar(teamId)
      console.info("[games import] no rows after file dedupe", { importRequestId, skippedDuplicateInFile })
      return NextResponse.json({
        success: true,
        created: 0,
        updated: 0,
        inserted: 0,
        skippedDuplicateInFile,
        parseErrors: parsed.errors,
        rowErrors: [] as Array<{ row: number; message: string }>,
        importRequestId,
      })
    }

    const season_id = await resolveSeasonIdForTeam(supabase, teamId)

    const dates = fileUniqueRows.map((r) => Date.parse(r.gameDateIso)).filter(Number.isFinite)
    const minMs = dates.length ? Math.min(...dates) : 0
    const maxMs = dates.length ? Math.max(...dates) : 0
    const fromIso = new Date(minMs - 86400000).toISOString()
    const toIso = new Date(maxMs + 86400000).toISOString()

    const { data: existingList, error: exErr } = await supabase
      .from("games")
      .select("id, opponent, game_date, location, game_type, conference_game, notes, season_id")
      .eq("team_id", teamId)
      .gte("game_date", fromIso)
      .lte("game_date", toIso)

    if (exErr) {
      console.error("[games import] existing games load", importRequestId, exErr)
      return NextResponse.json(
        {
          success: false,
          created: 0,
          updated: 0,
          inserted: 0,
          skippedDuplicateInFile,
          parseErrors: parsed.errors,
          rowErrors: [{ row: 0, message: exErr.message || "Failed to load existing games" }],
          importRequestId,
        },
        { status: 500 }
      )
    }

    const existingRows = (existingList ?? []) as ExistingGameRow[]
    const identityMap = buildIdentityMap(existingRows, teamId)

    let created = 0
    let updated = 0
    const rowErrors: Array<{ row: number; message: string }> = []

    for (const pr of fileUniqueRows) {
      const line = pr.sourceLine

      const existing = findExistingInMap(identityMap, teamId, pr)

      if (existing) {
        const patch = {
          location: pr.location,
          game_type: pr.gameType,
          conference_game: pr.conferenceGame,
          notes: pr.notes,
          updated_at: new Date().toISOString(),
        }
        const { data: updatedRow, error: upErr } = await supabase
          .from("games")
          .update(patch)
          .eq("id", existing.id)
          .eq("team_id", teamId)
          .select("id, opponent, game_date, location, notes")
          .maybeSingle()

        if (upErr || !updatedRow) {
          const msg = upErr?.message || "Update failed"
          console.error("[games import] row update", { importRequestId, line, msg })
          rowErrors.push({ row: line, message: msg })
          continue
        }

        const cal = await upsertCalendarEventForGame(supabase, {
          teamId,
          gameId: existing.id,
          opponent: pr.opponent,
          gameDateIso: (updatedRow as { game_date: string }).game_date,
          location: pr.location,
          notes: pr.notes,
          actorUserId: session.user.id,
          actorEmail: session.user.email,
          actorName: session.user.name ?? null,
          actorRole: session.user.role ?? null,
        })
        if (!cal.ok) {
          console.error("[games import] calendar sync after update", { importRequestId, line, message: cal.message })
          rowErrors.push({ row: line, message: cal.message })
          continue
        }

        updated++
        console.info("[games import] row", {
          importRequestId,
          sourceLine: line,
          action: "updated",
          opponent: pr.opponent,
          gameDateIso: pr.gameDateIso,
          event: "upserted",
        })
        continue
      }

      const insertRow = {
        season_id,
        team_id: teamId,
        opponent: pr.opponent,
        game_date: canonicalGameDateIso(pr.gameDateIso),
        location: pr.location,
        game_type: pr.gameType,
        conference_game: pr.conferenceGame,
        notes: pr.notes,
        updated_at: new Date().toISOString(),
      }

      const { data: inserted, error: insErr } = await supabase
        .from("games")
        .insert(insertRow)
        .select("id, opponent, game_date, location, notes")
        .maybeSingle()

      if (insErr?.code === "23505") {
        const { data: retryExisting } = await supabase
          .from("games")
          .select("id, opponent, game_date, location, game_type, conference_game, notes, season_id")
          .eq("team_id", teamId)
          .eq("game_date", insertRow.game_date)

        const match = (retryExisting ?? []).find(
          (g) => normalizeOpponentForSchedule((g as ExistingGameRow).opponent ?? "") === normalizeOpponentForSchedule(pr.opponent)
        ) as ExistingGameRow | undefined

        if (match) {
          identityMap.set(scheduleGameIdentityKey(teamId, match.opponent ?? "", match.game_date), match)
          const patch = {
            location: pr.location,
            game_type: pr.gameType,
            conference_game: pr.conferenceGame,
            notes: pr.notes,
            updated_at: new Date().toISOString(),
          }
          const { data: updatedRow, error: upErr2 } = await supabase
            .from("games")
            .update(patch)
            .eq("id", match.id)
            .select("id, opponent, game_date, location, notes")
            .maybeSingle()
          if (upErr2 || !updatedRow) {
            rowErrors.push({ row: line, message: upErr2?.message || "Race: could not update after unique conflict" })
            continue
          }
          const cal = await upsertCalendarEventForGame(supabase, {
            teamId,
            gameId: match.id,
            opponent: pr.opponent,
            gameDateIso: (updatedRow as { game_date: string }).game_date,
            location: pr.location,
            notes: pr.notes,
            actorUserId: session.user.id,
            actorEmail: session.user.email,
            actorName: session.user.name ?? null,
            actorRole: session.user.role ?? null,
          })
          if (!cal.ok) {
            rowErrors.push({ row: line, message: cal.message })
            continue
          }
          updated++
          console.info("[games import] row", {
            importRequestId,
            sourceLine: line,
            action: "updated_after_race",
            opponent: pr.opponent,
            gameDateIso: pr.gameDateIso,
            event: "upserted",
          })
          continue
        }
      }

      if (insErr || !inserted) {
        const msg = insErr?.message || "Insert failed"
        console.error("[games import] row insert", { importRequestId, line, msg, code: insErr?.code })
        rowErrors.push({ row: line, message: msg })
        continue
      }

      const ins = inserted as { id: string; opponent: string; game_date: string; location: string | null; notes: string | null }
      identityMap.set(scheduleGameIdentityKey(teamId, ins.opponent, ins.game_date), {
        id: ins.id,
        opponent: ins.opponent,
        game_date: ins.game_date,
        location: ins.location,
        game_type: pr.gameType,
        conference_game: pr.conferenceGame,
        notes: ins.notes,
        season_id,
      })

      const cal = await upsertCalendarEventForGame(supabase, {
        teamId,
        gameId: ins.id,
        opponent: pr.opponent,
        gameDateIso: ins.game_date,
        location: pr.location,
        notes: pr.notes,
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        actorName: session.user.name ?? null,
        actorRole: session.user.role ?? null,
      })
      if (!cal.ok) {
        console.error("[games import] calendar sync after insert — rolling back game", { importRequestId, line, gameId: ins.id })
        await supabase.from("games").delete().eq("id", ins.id).eq("team_id", teamId)
        rowErrors.push({ row: line, message: cal.message })
        continue
      }

      created++
      console.info("[games import] row", {
        importRequestId,
        sourceLine: line,
        action: "created",
        opponent: pr.opponent,
        gameDateIso: pr.gameDateIso,
        event: "inserted",
      })
    }

    if (created === 0 && updated === 0 && rowErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          created: 0,
          updated: 0,
          inserted: 0,
          skippedDuplicateInFile,
          parseErrors: parsed.errors,
          rowErrors,
          importRequestId,
        },
        { status: 500 }
      )
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/schedule")
    revalidatePath("/dashboard/calendar")
    revalidateTeamGamesAndDashboard(teamId)
    revalidateTeamCalendar(teamId)

    console.info("[games import] request done", {
      importRequestId,
      teamId,
      created,
      updated,
      skippedDuplicateInFile,
      parseErrorCount: parsed.errors.length,
      rowErrorCount: rowErrors.length,
    })

    return NextResponse.json({
      success: true,
      created,
      updated,
      inserted: created,
      skippedDuplicateInFile,
      parseErrors: parsed.errors,
      rowErrors,
      importRequestId,
    })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[POST games import]", err)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}
