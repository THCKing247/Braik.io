/**
 * Weekly / per-game stat entries (player_weekly_stat_entries).
 * GET — team members (non-deleted only). POST/PATCH/DELETE — edit_roster.
 * DELETE is soft delete. Season totals sync via recalculateSeasonStatsFromWeeklyForPlayers.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { normalizeWeeklyStatsForStorage, sanitizeWeeklyStatsInput } from "@/lib/stats-weekly-api"
import { recalculateSeasonStatsFromWeeklyForPlayers } from "@/lib/stats-weekly-season-sync"
import {
  insertWeeklyStatEntryAudit,
  insertWeeklyStatEntryAuditBatch,
  weeklyEntryRowToAuditSnapshot,
} from "@/lib/stats-weekly-audit"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const WEEKLY_STAT_ENTRY_AUDIT_COLUMNS = [
  "id",
  "team_id",
  "player_id",
  "season_year",
  "week_number",
  "game_id",
  "opponent",
  "game_date",
  "game_type",
  "location",
  "venue",
  "result",
  "team_score",
  "opponent_score",
  "notes",
  "stats",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by",
  "deleted_at",
  "deleted_by",
].join(",")

type WeeklyStatAuditRow = {
  id: string
  team_id: string
  player_id: string
  season_year: number | null
  week_number: number | null
  game_id: string | null
  opponent: string | null
  game_date: string | null
  game_type: string | null
  location: string | null
  venue: string | null
  result: string | null
  team_score: number | null
  opponent_score: number | null
  notes: string | null
  stats: Record<string, unknown> | null
  created_at: string | null
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

async function resolveGameFields(
  supabase: ReturnType<typeof getSupabaseServer>,
  teamId: string,
  gameId: string | null,
  opponent: string | null,
  gameDate: string | null
): Promise<{ opponent: string | null; gameDate: string | null; error?: string }> {
  if (!gameId) return { opponent, gameDate }
  const { data: gameRow } = await supabase
    .from("games")
    .select("id, team_id, opponent, game_date")
    .eq("id", gameId)
    .eq("team_id", teamId)
    .maybeSingle()
  if (!gameRow) return { opponent, gameDate, error: "Invalid game for this team" }
  const gr = gameRow as { opponent?: string | null; game_date?: string }
  let opp = opponent
  let gd = gameDate
  if (!opp && gr.opponent) opp = gr.opponent
  if (!gd && gr.game_date) gd = String(gr.game_date).slice(0, 10)
  return { opponent: opp, gameDate: gd }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")?.trim()
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const seasonYear = searchParams.get("seasonYear")?.trim()
    const weekNumber = searchParams.get("week")?.trim()
    const playerIdFilter = searchParams.get("playerId")?.trim()
    const gameId = searchParams.get("gameId")?.trim()
    const opponent = searchParams.get("opponent")?.trim()
    const dateFrom = searchParams.get("dateFrom")?.trim()
    const dateTo = searchParams.get("dateTo")?.trim()

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    let query = supabase
      .from("player_weekly_stat_entries")
      .select(
        `
        id,
        team_id,
        player_id,
        season_year,
        week_number,
        game_id,
        opponent,
        game_date,
        game_type,
        location,
        venue,
        result,
        team_score,
        opponent_score,
        notes,
        stats,
        players!inner ( first_name, last_name, jersey_number, position_group ),
        games ( opponent, game_date )
      `
      )
      .eq("team_id", teamId)
      .is("deleted_at", null)

    if (seasonYear) {
      const y = parseInt(seasonYear, 10)
      if (Number.isFinite(y)) query = query.eq("season_year", y)
    }
    if (weekNumber) {
      const w = parseInt(weekNumber, 10)
      if (Number.isFinite(w)) query = query.eq("week_number", w)
    }
    if (playerIdFilter && UUID_REGEX.test(playerIdFilter)) {
      query = query.eq("player_id", playerIdFilter)
    }
    if (gameId && UUID_REGEX.test(gameId)) {
      query = query.eq("game_id", gameId)
    }
    if (opponent) {
      query = query.ilike("opponent", `%${opponent}%`)
    }
    if (dateFrom) {
      query = query.gte("game_date", dateFrom)
    }
    if (dateTo) {
      query = query.lte("game_date", dateTo)
    }

    query = query.order("game_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })

    const { data: rows, error } = await query
    if (error) {
      console.error("[GET /api/stats/weekly]", error)
      return NextResponse.json({ error: "Failed to load weekly stats" }, { status: 500 })
    }

    const entries = (rows ?? []).map((raw: Record<string, unknown>) => {
      const pl = raw.players as
        | { first_name?: string | null; last_name?: string | null; jersey_number?: number | null; position_group?: string | null }
        | { first_name?: string | null; last_name?: string | null; jersey_number?: number | null; position_group?: string | null }[]
        | null
      const player = Array.isArray(pl) ? pl[0] : pl
      const gm = raw.games as { opponent?: string | null; game_date?: string | null } | null
      const gid = raw.game_id as string | null
      const gameLabel =
        gid && gm
          ? [gm.opponent ? `vs ${gm.opponent}` : "Game", gm.game_date ? String(gm.game_date).slice(0, 10) : ""]
              .filter(Boolean)
              .join(" · ")
          : null
      const st = raw.stats
      return {
        id: raw.id as string,
        playerId: raw.player_id as string,
        seasonYear: (raw.season_year as number | null) ?? null,
        weekNumber: (raw.week_number as number | null) ?? null,
        gameId: gid,
        opponent: (raw.opponent as string | null) ?? null,
        gameDate: (raw.game_date as string | null) ?? null,
        gameType: (raw.game_type as string | null) ?? null,
        location: (raw.location as string | null) ?? null,
        venue: (raw.venue as string | null) ?? null,
        result: (raw.result as string | null) ?? null,
        teamScore: (raw.team_score as number | null) ?? null,
        opponentScore: (raw.opponent_score as number | null) ?? null,
        notes: (raw.notes as string | null) ?? null,
        stats: st && typeof st === "object" && !Array.isArray(st) ? (st as Record<string, unknown>) : {},
        firstName: player?.first_name ?? "",
        lastName: player?.last_name ?? "",
        jerseyNumber: player?.jersey_number ?? null,
        positionGroup: player?.position_group ?? null,
        gameLabel,
      }
    })

    return NextResponse.json({ entries })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[GET /api/stats/weekly]", err)
    return NextResponse.json({ error: "Failed to load weekly stats" }, { status: 500 })
  }
}

type PostBody = {
  teamId?: string
  entries?: Array<{
    playerId?: string
    seasonYear?: number | null
    weekNumber?: number | null
    gameId?: string | null
    opponent?: string | null
    gameDate?: string | null
    stats?: unknown
  }>
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = (await request.json().catch(() => null)) as PostBody | null
    const teamId = body?.teamId?.trim()
    const list = body?.entries
    if (!teamId || !Array.isArray(list) || list.length === 0) {
      return NextResponse.json({ error: "teamId and entries are required" }, { status: 400 })
    }
    if (list.length > 200) {
      return NextResponse.json({ error: "Too many entries in one request" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    type ParsedWeeklyRow = {
      playerId: string
      seasonYear: number | null
      weekNumber: number | null
      gameId: string | null
      opponent: string | null
      gameDate: string | null
      stats: Record<string, number>
    }

    const parsed: ParsedWeeklyRow[] = []

    for (const e of list) {
      const pid = e.playerId?.trim()
      if (!pid || !UUID_REGEX.test(pid)) {
        return NextResponse.json({ error: "Each entry needs a valid playerId" }, { status: 400 })
      }
      let gid: string | null = e.gameId?.trim() || null
      if (gid && !UUID_REGEX.test(gid)) gid = null

      const stats = normalizeWeeklyStatsForStorage(sanitizeWeeklyStatsInput(e.stats))
      if (Object.keys(stats).length === 0) {
        return NextResponse.json({ error: "Each entry needs at least one stat value" }, { status: 400 })
      }

      const seasonYear =
        e.seasonYear !== undefined && e.seasonYear !== null && Number.isFinite(Number(e.seasonYear))
          ? Math.trunc(Number(e.seasonYear))
          : null
      const weekNumber =
        e.weekNumber !== undefined && e.weekNumber !== null && Number.isFinite(Number(e.weekNumber))
          ? Math.trunc(Number(e.weekNumber))
          : null

      let opponent = e.opponent?.trim() || null
      let gameDate = e.gameDate?.trim() || null
      if (gameDate && !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
        return NextResponse.json({ error: "gameDate must be YYYY-MM-DD" }, { status: 400 })
      }

      parsed.push({
        playerId: pid,
        seasonYear,
        weekNumber,
        gameId: gid,
        opponent,
        gameDate,
        stats,
      })
    }

    const uniquePlayerIds = [...new Set(parsed.map((p) => p.playerId))]
    const gameIdsToLoad = [...new Set(parsed.map((p) => p.gameId).filter((g): g is string => Boolean(g)))]

    const [playersRes, gamesRes] = await Promise.all([
      supabase.from("players").select("id").eq("team_id", teamId).in("id", uniquePlayerIds),
      gameIdsToLoad.length > 0
        ? supabase
            .from("games")
            .select("id, opponent, game_date")
            .eq("team_id", teamId)
            .in("id", gameIdsToLoad)
        : Promise.resolve({ data: [] as { id: string; opponent?: string | null; game_date?: string | null }[], error: null }),
    ])

    if (playersRes.error) {
      console.error("[POST /api/stats/weekly] players batch", playersRes.error)
      return NextResponse.json({ error: "Failed to validate players" }, { status: 500 })
    }
    if (gamesRes.error) {
      console.error("[POST /api/stats/weekly] games batch", gamesRes.error)
      return NextResponse.json({ error: "Failed to validate games" }, { status: 500 })
    }

    const validPlayerIds = new Set((playersRes.data ?? []).map((r) => (r as { id: string }).id))
    const gameById = new Map<string, { opponent?: string | null; game_date?: string | null }>()
    for (const g of gamesRes.data ?? []) {
      const row = g as { id: string; opponent?: string | null; game_date?: string | null }
      gameById.set(row.id, { opponent: row.opponent, game_date: row.game_date })
    }

    const insertRows: Array<{
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
    }> = []

    const playerIdsForSync = new Set<string>()

    for (const row of parsed) {
      if (!validPlayerIds.has(row.playerId)) {
        return NextResponse.json({ error: "Player not on this team" }, { status: 400 })
      }

      let opponent = row.opponent
      let gameDate = row.gameDate
      const gid = row.gameId

      if (gid) {
        const gr = gameById.get(gid)
        if (!gr) {
          return NextResponse.json({ error: "Invalid game for this team" }, { status: 400 })
        }
        if (!opponent && gr.opponent) opponent = gr.opponent
        if (!gameDate && gr.game_date) gameDate = String(gr.game_date).slice(0, 10)
      }

      playerIdsForSync.add(row.playerId)
      insertRows.push({
        team_id: teamId,
        player_id: row.playerId,
        season_year: row.seasonYear,
        week_number: row.weekNumber,
        game_id: gid,
        opponent,
        game_date: gameDate,
        stats: row.stats,
        created_by: userId,
        updated_by: userId,
      })
    }

    const { data: inserted, error } = await supabase
      .from("player_weekly_stat_entries")
      .insert(insertRows)
      .select(WEEKLY_STAT_ENTRY_AUDIT_COLUMNS)
    if (error) {
      console.error("[POST /api/stats/weekly]", error)
      return NextResponse.json({ error: "Failed to save weekly stats" }, { status: 500 })
    }

    const insertedRows = ((inserted ?? []) as unknown) as WeeklyStatAuditRow[]
    await insertWeeklyStatEntryAuditBatch(
      supabase,
      insertedRows.map((row) => ({
        entryId: row.id,
        teamId,
        action: "create" as const,
        beforeData: null,
        afterData: weeklyEntryRowToAuditSnapshot(row),
        actedBy: userId,
      }))
    )

    await recalculateSeasonStatsFromWeeklyForPlayers(supabase, teamId, [...playerIdsForSync])

    return NextResponse.json({ success: true, created: insertedRows.length })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[POST /api/stats/weekly]", err)
    return NextResponse.json({ error: "Failed to save weekly stats" }, { status: 500 })
  }
}

type PatchBody = {
  teamId?: string
  id?: string
  week_number?: number | null
  season_year?: number | null
  game_id?: string | null
  opponent?: string | null
  game_date?: string | null
  stats?: unknown
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = (await request.json().catch(() => null)) as PatchBody | null
    const teamId = body?.teamId?.trim()
    const entryId = body?.id?.trim()
    if (!teamId || !entryId || !UUID_REGEX.test(entryId)) {
      return NextResponse.json({ error: "teamId and id are required" }, { status: 400 })
    }

    const hasPatch =
      body?.week_number !== undefined ||
      body?.season_year !== undefined ||
      body?.game_id !== undefined ||
      body?.opponent !== undefined ||
      body?.game_date !== undefined ||
      body?.stats !== undefined
    if (!hasPatch) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const { data: existing, error: exErr } = await supabase
      .from("player_weekly_stat_entries")
      .select(WEEKLY_STAT_ENTRY_AUDIT_COLUMNS)
      .eq("id", entryId)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .maybeSingle()

    if (exErr || !existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const existingRow = (existing as unknown) as WeeklyStatAuditRow
    const beforeSnap = weeklyEntryRowToAuditSnapshot(existingRow)
    const playerId = existingRow.player_id

    const updates: Record<string, unknown> = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }

    if (body.week_number !== undefined) {
      updates.week_number =
        body.week_number === null
          ? null
          : Number.isFinite(Number(body.week_number))
            ? Math.trunc(Number(body.week_number))
            : null
    }
    if (body.season_year !== undefined) {
      updates.season_year =
        body.season_year === null
          ? null
          : Number.isFinite(Number(body.season_year))
            ? Math.trunc(Number(body.season_year))
            : null
    }

    let nextGameId = existingRow.game_id ?? null
    if (body.game_id !== undefined) {
      let gid: string | null
      if (body.game_id === null) {
        gid = null
      } else if (typeof body.game_id === "string") {
        const t = body.game_id.trim()
        if (t === "") gid = null
        else if (!UUID_REGEX.test(t)) {
          return NextResponse.json({ error: "game_id must be a valid UUID or empty" }, { status: 400 })
        } else gid = t
      } else {
        return NextResponse.json({ error: "Invalid game_id" }, { status: 400 })
      }
      nextGameId = gid
      updates.game_id = gid
    }

    if (body.opponent !== undefined) {
      updates.opponent = body.opponent?.trim() || null
    }
    if (body.game_date !== undefined) {
      const gd = body.game_date?.trim() || null
      if (gd && !/^\d{4}-\d{2}-\d{2}$/.test(gd)) {
        return NextResponse.json({ error: "gameDate must be YYYY-MM-DD" }, { status: 400 })
      }
      updates.game_date = gd
    }

    if (body.stats !== undefined) {
      const stats = normalizeWeeklyStatsForStorage(sanitizeWeeklyStatsInput(body.stats))
      if (Object.keys(stats).length === 0) {
        return NextResponse.json({ error: "stats must include at least one allowed numeric field" }, { status: 400 })
      }
      updates.stats = stats
    }

    const shouldResolveGame =
      Boolean(nextGameId) &&
      (body.game_id !== undefined || body.opponent !== undefined || body.game_date !== undefined)
    if (shouldResolveGame && nextGameId) {
      const opp = (updates.opponent as string | null | undefined) ?? existingRow.opponent
      const gd = (updates.game_date as string | null | undefined) ?? existingRow.game_date
      const resolved = await resolveGameFields(supabase, teamId, nextGameId, opp, gd ? String(gd).slice(0, 10) : null)
      if (resolved.error) {
        return NextResponse.json({ error: resolved.error }, { status: 400 })
      }
      if (body.opponent === undefined && resolved.opponent !== undefined) updates.opponent = resolved.opponent
      if (body.game_date === undefined && resolved.gameDate) updates.game_date = resolved.gameDate
    }

    const { data: updated, error: upErr } = await supabase
      .from("player_weekly_stat_entries")
      .update(updates)
      .eq("id", entryId)
      .eq("team_id", teamId)
      .select(WEEKLY_STAT_ENTRY_AUDIT_COLUMNS)
      .maybeSingle()

    if (upErr || !updated) {
      console.error("[PATCH /api/stats/weekly]", upErr)
      return NextResponse.json({ error: "Failed to update entry" }, { status: 500 })
    }

    const updatedRow = (updated as unknown) as WeeklyStatAuditRow
    await insertWeeklyStatEntryAudit(supabase, {
      entryId,
      teamId,
      action: "update",
      beforeData: beforeSnap,
      afterData: weeklyEntryRowToAuditSnapshot(updatedRow),
      actedBy: userId,
    })

    await recalculateSeasonStatsFromWeeklyForPlayers(supabase, teamId, [playerId])

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[PATCH /api/stats/weekly]", err)
    return NextResponse.json({ error: "Failed to update weekly stats" }, { status: 500 })
  }
}

type DeleteBody = { teamId?: string; ids?: string[] }

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = (await request.json().catch(() => null)) as DeleteBody | null
    const teamId = body?.teamId?.trim()
    const ids = body?.ids?.filter((x) => typeof x === "string" && UUID_REGEX.test(x)) ?? []
    if (!teamId || ids.length === 0) {
      return NextResponse.json({ error: "teamId and ids are required" }, { status: 400 })
    }
    if (ids.length > 500) {
      return NextResponse.json({ error: "Too many ids" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const { data: toDelete, error: fetchErr } = await supabase
      .from("player_weekly_stat_entries")
      .select(WEEKLY_STAT_ENTRY_AUDIT_COLUMNS)
      .eq("team_id", teamId)
      .in("id", ids)
      .is("deleted_at", null)

    if (fetchErr) {
      console.error("[DELETE /api/stats/weekly] fetch", fetchErr)
      return NextResponse.json({ error: "Failed to delete weekly stats" }, { status: 500 })
    }

    const rows = ((toDelete ?? []) as unknown) as WeeklyStatAuditRow[]
    if (rows.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 })
    }

    const now = new Date().toISOString()
    const playerIds = new Set(rows.map((r) => r.player_id))
    const idList = rows.map((r) => r.id)
    const beforeById = new Map(rows.map((r) => [r.id, r]))

    const { data: afterRows, error: bulkSoftErr } = await supabase
      .from("player_weekly_stat_entries")
      .update({
        deleted_at: now,
        deleted_by: userId,
        updated_at: now,
        updated_by: userId,
      })
      .in("id", idList)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .select(WEEKLY_STAT_ENTRY_AUDIT_COLUMNS)

    if (bulkSoftErr) {
      console.error("[DELETE /api/stats/weekly] soft delete bulk", bulkSoftErr)
      return NextResponse.json({ error: "Failed to delete weekly stats" }, { status: 500 })
    }

    const afterList = ((afterRows ?? []) as unknown) as WeeklyStatAuditRow[]
    await insertWeeklyStatEntryAuditBatch(
      supabase,
      afterList.map((afterRow) => {
        const beforeRow = beforeById.get(afterRow.id)
        return {
          entryId: afterRow.id,
          teamId,
          action: "soft_delete" as const,
          beforeData: beforeRow ? weeklyEntryRowToAuditSnapshot(beforeRow) : null,
          afterData: weeklyEntryRowToAuditSnapshot(afterRow),
          actedBy: userId,
        }
      })
    )

    await recalculateSeasonStatsFromWeeklyForPlayers(supabase, teamId, [...playerIds])

    return NextResponse.json({ success: true, deleted: rows.length })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[DELETE /api/stats/weekly]", err)
    return NextResponse.json({ error: "Failed to delete weekly stats" }, { status: 500 })
  }
}
