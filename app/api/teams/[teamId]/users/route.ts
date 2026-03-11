import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

export const runtime = "nodejs"

/**
 * GET /api/teams/[teamId]/users
 * Returns all users connected to the team, organized by role
 */
export async function GET(request: Request, { params }: { params: { teamId: string } }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    // Only head coaches can view the users list
    await requireTeamPermission(teamId, "manage")

    const supabase = getSupabaseServer()

    // Get all profiles for this team
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, coordinator_role, position_coach_roles, team_id")
      .eq("team_id", teamId)

    if (profilesError) {
      console.error("[GET /api/teams/[teamId]/users]", profilesError)
      return NextResponse.json({ error: "Failed to load users" }, { status: 500 })
    }

    // Get user details from users table
    const userIds = (profiles || []).map((p) => p.id)
    const { data: usersData } = await supabase
      .from("users")
      .select("id, email, name")
      .in("id", userIds)

    const usersMap = new Map((usersData || []).map((u) => [u.id, u]))

    // Get player relations for parents
    const { data: players } = await supabase
      .from("players")
      .select("id, first_name, last_name, user_id")
      .eq("team_id", teamId)
      .not("user_id", "is", null)

    const playersMap = new Map((players || []).map((p) => [p.user_id, p]))

    // Get guardian links for parents
    const parentIds = (profiles || [])
      .filter((p) => p.role === "parent" || p.role === "PARENT")
      .map((p) => p.id)

    let guardianLinks: Array<{ guardian_id: string; player_id: string }> = []
    let guardiansMap = new Map<string, string>()
    
    if (parentIds.length > 0) {
      const { data: guardians } = await supabase
        .from("guardians")
        .select("id, user_id")
        .in("user_id", parentIds)

      guardiansMap = new Map((guardians || []).map((g) => [g.user_id, g.id]))
      const guardianIds = (guardians || []).map((g) => g.id)
      
      if (guardianIds.length > 0) {
        const { data: links } = await supabase
          .from("guardian_links")
          .select("guardian_id, player_id")
          .in("guardian_id", guardianIds)

        guardianLinks = links || []
      }
    }

    const guardianToPlayerMap = new Map<string, string>()
    guardianLinks.forEach((link) => {
      // Find the user_id for this guardian
      for (const [userId, guardianId] of guardiansMap.entries()) {
        if (guardianId === link.guardian_id) {
          guardianToPlayerMap.set(userId, link.player_id)
          break
        }
      }
    })

    // Build user list with coaching structure and player relations
    const users = (profiles || []).map((profile) => {
      const userData = usersMap.get(profile.id)
      const playerRelation = guardianToPlayerMap.get(profile.id)
        ? (() => {
            const playerId = guardianToPlayerMap.get(profile.id)!
            const player = playersMap.get(playerId) || players?.find((p) => p.id === playerId)
            return player
              ? {
                  playerId: player.id,
                  playerName: `${player.first_name} ${player.last_name}`,
                }
              : undefined
          })()
        : undefined

      return {
        id: profile.id,
        email: userData?.email || profile.email || "",
        name: userData?.name || profile.full_name,
        role: profile.role,
        coordinatorRole: profile.coordinator_role,
        positionCoachRoles: (profile.position_coach_roles || []) as string[],
        playerRelation,
      }
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error("[GET /api/teams/[teamId]/users]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load users" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
