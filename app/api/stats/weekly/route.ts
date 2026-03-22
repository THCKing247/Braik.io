/**
 * Weekly / per-game stat entries (player_weekly_stat_entries).
 * GET — team members (non-deleted only). POST/PATCH/DELETE — edit_roster.
 * DELETE is soft delete. Season totals sync via recalculateSeasonStatsFromWeeklyForPlayers.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { sanitizeWeeklyStatsInput } from "@/lib/stats-weekly-api"
import { recalculateSeasonStatsFromWeeklyForPlayers } from "@/lib/stats-weekly-season-sync"
import {
  insertWeeklyStatEntryAudit,
  weeklyEntryRowToAuditSnapshot,
} from "@/lib/stats-weekly-audit"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

    for (const e of list) {
      const pid = e.playerId?.trim()
      if (!pid || !UUID_REGEX.test(pid)) {
        return NextResponse.json({ error: "Each entry needs a valid playerId" }, { status: 400 })
      }
      let gid: string | null = e.gameId?.trim() || null
      if (gid && !UUID_REGEX.test(gid)) gid = null

      const stats = sanitizeWeeklyStatsInput(e.stats)
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

      if (gid) {
        const resolved = await resolveGameFields(supabase, teamId, gid, opponent, gameDate)
        if (resolved.error) {
          return NextResponse.json({ error: resolved.error }, { status: 400 })
        }
        opponent = resolved.opponent
        gameDate = resolved.gameDate
      }

      const { data: playerRow } = await supabase
        .from("players")
        .select("id")
        .eq("id", pid)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!playerRow) {
        return NextResponse.json({ error: "Player not on this team" }, { status: 400 })
      }

      playerIdsForSync.add(pid)
      insertRows.push({
        team_id: teamId,
        player_id: pid,
        season_year: seasonYear,
        week_number: weekNumber,
        game_id: gid,
        opponent,
        game_date: gameDate,
        stats,
        created_by: userId,
        updated_by: userId,
      })
    }

    const { data: inserted, error } = await supabase.from("player_weekly_stat_entries").insert(insertRows).select("*")
    if (error) {
      console.error("[POST /api/stats/weekly]", error)
      return NextResponse.json({ error: "Failed to save weekly stats" }, { status: 500 })
    }

    for (const row of inserted ?? []) {
      const snap = weeklyEntryRowToAuditSnapshot(row as Record<string, unknown>)
      await insertWeeklyStatEntryAudit(supabase, {
        entryId: row.id as string,
        teamId,
        action: "create",
        beforeData: null,
        afterData: snap,
        actedBy: userId,
      })
    }

    await recalculateSeasonStatsFromWeeklyForPlayers(supabase, teamId, [...playerIdsForSync])

    return NextResponse.json({ success: true, created: (inserted ?? []).length })
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
      .select("*")
      .eq("id", entryId)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .maybeSingle()

    if (exErr || !existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const beforeSnap = weeklyEntryRowToAuditSnapshot(existing as Record<string, unknown>)
    const playerId = existing.player_id as string

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

    let nextGameId = (existing.game_id as string | null) ?? null
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
      const stats = sanitizeWeeklyStatsInput(body.stats)
      if (Object.keys(stats).length === 0) {
        return NextResponse.json({ error: "stats must include at least one allowed numeric field" }, { status: 400 })
      }
      updates.stats = stats
    }

    const shouldResolveGame =
      Boolean(nextGameId) &&
      (body.game_id !== undefined || body.opponent !== undefined || body.game_date !== undefined)
    if (shouldResolveGame && nextGameId) {
      const opp = (updates.opponent as string | null | undefined) ?? (existing.opponent as string | null)
      const gd = (updates.game_date as string | null | undefined) ?? (existing.game_date as string | null)
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
      .select("*")
      .maybeSingle()

    if (upErr || !updated) {
      console.error("[PATCH /api/stats/weekly]", upErr)
      return NextResponse.json({ error: "Failed to update entry" }, { status: 500 })
    }

    await insertWeeklyStatEntryAudit(supabase, {
      entryId,
      teamId,
      action: "update",
      beforeData: beforeSnap,
      afterData: weeklyEntryRowToAuditSnapshot(updated as Record<string, unknown>),
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
      .select("*")
      .eq("team_id", teamId)
      .in("id", ids)
      .is("deleted_at", null)

    if (fetchErr) {
      console.error("[DELETE /api/stats/weekly] fetch", fetchErr)
      return NextResponse.json({ error: "Failed to delete weekly stats" }, { status: 500 })
    }

    const rows = toDelete ?? []
    if (rows.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 })
    }

    const now = new Date().toISOString()
    const playerIds = new Set<string>()

    for (const row of rows) {
      const id = row.id as string
      playerIds.add(row.player_id as string)
      const beforeSnap = weeklyEntryRowToAuditSnapshot(row as Record<string, unknown>)

      const { data: afterRow, error: softErr } = await supabase
        .from("player_weekly_stat_entries")
        .update({
          deleted_at: now,
          deleted_by: userId,
          updated_at: now,
          updated_by: userId,
        })
        .eq("id", id)
        .eq("team_id", teamId)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle()

      if (softErr || !afterRow) {
        console.error("[DELETE /api/stats/weekly] soft delete", softErr)
        continue
      }

      await insertWeeklyStatEntryAudit(supabase, {
        entryId: id,
        teamId,
        action: "soft_delete",
        beforeData: beforeSnap,
        afterData: weeklyEntryRowToAuditSnapshot(afterRow as Record<string, unknown>),
        actedBy: userId,
      })
    }

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
