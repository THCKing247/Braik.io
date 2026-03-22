/**
 * Weekly / per-game stat entries (player_weekly_stat_entries).
 * GET list — team members. POST create — edit_roster. DELETE — edit_roster.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { sanitizeWeeklyStatsInput } from "@/lib/stats-weekly-api"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
      const gameId = raw.game_id as string | null
      const gameLabel =
        gameId && gm
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
        gameId,
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
    }> = []

    for (const e of list) {
      const pid = e.playerId?.trim()
      if (!pid || !UUID_REGEX.test(pid)) {
        return NextResponse.json({ error: "Each entry needs a valid playerId" }, { status: 400 })
      }
      let gameId: string | null = e.gameId?.trim() || null
      if (gameId && !UUID_REGEX.test(gameId)) gameId = null

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

      if (gameId) {
        const { data: gameRow } = await supabase
          .from("games")
          .select("id, team_id, opponent, game_date")
          .eq("id", gameId)
          .eq("team_id", teamId)
          .maybeSingle()
        if (!gameRow) {
          return NextResponse.json({ error: "Invalid game for this team" }, { status: 400 })
        }
        const gr = gameRow as { opponent?: string | null; game_date?: string }
        if (!opponent && gr.opponent) opponent = gr.opponent
        if (!gameDate && gr.game_date) {
          gameDate = String(gr.game_date).slice(0, 10)
        }
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

      insertRows.push({
        team_id: teamId,
        player_id: pid,
        season_year: seasonYear,
        week_number: weekNumber,
        game_id: gameId,
        opponent,
        game_date: gameDate,
        stats,
      })
    }

    const { data: inserted, error } = await supabase.from("player_weekly_stat_entries").insert(insertRows).select("id")
    if (error) {
      console.error("[POST /api/stats/weekly]", error)
      return NextResponse.json({ error: "Failed to save weekly stats" }, { status: 500 })
    }

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

type DeleteBody = { teamId?: string; ids?: string[] }

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    const { data: deleted, error } = await supabase
      .from("player_weekly_stat_entries")
      .delete()
      .eq("team_id", teamId)
      .in("id", ids)
      .select("id")

    if (error) {
      console.error("[DELETE /api/stats/weekly]", error)
      return NextResponse.json({ error: "Failed to delete weekly stats" }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: (deleted ?? []).length })
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
