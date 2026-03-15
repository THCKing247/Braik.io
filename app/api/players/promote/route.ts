import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramHeadCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

const TEAM_LEVELS = ["varsity", "jv", "freshman"] as const

/**
 * POST /api/players/promote
 * Promote or demote a player between program team levels (Freshman, JV, Varsity).
 * Requires head coach of the program. Records history in player_team_history and updates players.team_id.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      playerId: string
      toTeamId: string
      promotionReason?: string | null
      season?: string | null
    }

    const { playerId, toTeamId, promotionReason = null, season = null } = body
    if (!playerId || !toTeamId) {
      return NextResponse.json(
        { error: "playerId and toTeamId are required" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const fromTeamId = player.team_id
    if (fromTeamId === toTeamId) {
      return NextResponse.json(
        { error: "Player is already on the target team" },
        { status: 400 }
      )
    }

    const { data: fromTeam, error: fromErr } = await supabase
      .from("teams")
      .select("id, program_id, team_level")
      .eq("id", fromTeamId)
      .maybeSingle()

    const { data: toTeam, error: toErr } = await supabase
      .from("teams")
      .select("id, program_id, team_level, name")
      .eq("id", toTeamId)
      .maybeSingle()

    if (fromErr || toErr || !fromTeam || !toTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const programId = fromTeam.program_id ?? toTeam.program_id
    if (!programId || fromTeam.program_id !== toTeam.program_id) {
      return NextResponse.json(
        { error: "Both teams must belong to the same program" },
        { status: 400 }
      )
    }

    const toLevel = (toTeam.team_level ?? "").toLowerCase()
    if (!TEAM_LEVELS.includes(toLevel as (typeof TEAM_LEVELS)[number])) {
      return NextResponse.json(
        { error: "Target team must have team_level varsity, jv, or freshman" },
        { status: 400 }
      )
    }

    await requireProgramHeadCoach(programId)

    const fromLevel = (fromTeam.team_level ?? "").toLowerCase() || null
    const fromLevelValid =
      fromLevel && TEAM_LEVELS.includes(fromLevel as (typeof TEAM_LEVELS)[number])
        ? fromLevel
        : null

    const { error: historyInsertErr } = await supabase.from("player_team_history").insert({
      player_id: playerId,
      program_id: programId,
      from_team_id: fromTeamId,
      to_team_id: toTeamId,
      from_level: fromLevelValid,
      to_level: toLevel,
      season: season && String(season).trim() ? String(season).trim() : null,
      promotion_reason:
        promotionReason && String(promotionReason).trim()
          ? String(promotionReason).trim()
          : null,
      promoted_by_user_id: session.user.id,
    })

    if (historyInsertErr) {
      console.error("[POST /api/players/promote] player_team_history insert error:", historyInsertErr)
      return NextResponse.json(
        { error: "Failed to record promotion history", details: historyInsertErr.message },
        { status: 500 }
      )
    }

    const { error: updateErr } = await supabase
      .from("players")
      .update({ team_id: toTeamId, updated_at: new Date().toISOString() })
      .eq("id", playerId)

    if (updateErr) {
      console.error("[POST /api/players/promote] players update error:", updateErr)
      return NextResponse.json(
        { error: "Failed to move player to new team", details: updateErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      playerId,
      fromTeamId,
      toTeamId,
      toLevel,
      toTeamName: (toTeam as { name?: string }).name ?? null,
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      console.error("[POST /api/players/promote] membership lookup failed", err)
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Head coach required")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/players/promote]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
