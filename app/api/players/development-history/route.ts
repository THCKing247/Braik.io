import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

const MAX_ENTRIES = 50

/**
 * GET /api/players/development-history?playerId=xxx&limit=12
 * Returns timeline of development metrics for a player.
 * Allowed: coach with team/program access, or player viewing own profile (same team), or parent of player.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get("playerId")
    const limit = Math.min(MAX_ENTRIES, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10)) || 12)

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const teamId = (player as { team_id: string }).team_id
    const playerUserId = (player as { user_id?: string }).user_id

    const isOwnProfile = playerUserId === session.user.id
    if (isOwnProfile) {
      await requireTeamAccess(teamId)
    } else {
      const { data: team } = await supabase
        .from("teams")
        .select("program_id")
        .eq("id", teamId)
        .maybeSingle()
      const programId = (team as { program_id?: string } | null)?.program_id
      let allowed = false
      if (programId) {
        try {
          await requireProgramCoach(programId)
          allowed = true
        } catch {
          // not a coach
        }
      }
      if (!allowed) {
        const { data: teamAccess } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
        if (teamAccess) {
          try {
            await requireTeamAccess(teamId)
            allowed = true
          } catch {
            // not team member
          }
        }
      }
      if (!allowed) {
        const { data: parentLink } = await supabase
          .from("parent_player_links")
          .select("id")
          .eq("player_id", playerId)
          .eq("parent_user_id", session.user.id)
          .maybeSingle()
        if (!parentLink) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }
      }
    }

    const { data, error } = await supabase
      .from("player_development_metrics")
      .select("id, player_id, program_id, strength_score, speed_score, football_iq_score, leadership_score, discipline_score, coach_notes, created_at")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[GET /api/players/development-history]", error)
      return NextResponse.json({ error: "Failed to load development history" }, { status: 500 })
    }

    const history = (data ?? []).map((r) => ({
      id: r.id,
      playerId: r.player_id,
      programId: r.program_id,
      strength: r.strength_score,
      speed: r.speed_score,
      footballIQ: r.football_iq_score,
      leadership: r.leadership_score,
      discipline: r.discipline_score,
      notes: r.coach_notes,
      createdAt: r.created_at,
    }))

    return NextResponse.json({ history })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/players/development-history]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
