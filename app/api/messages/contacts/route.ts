import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/messages/contacts?teamId=xxx
 * Returns contacts (team members) for messaging.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const { user } = await requireTeamAccess(teamId)

    // Get team members (coaches, etc.)
    const { data: members, error: membersError } = await supabase
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", teamId)
      .eq("active", true)

    if (membersError) {
      console.error("[GET /api/messages/contacts] members", membersError)
      return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 })
    }

    // Get players with user accounts (players who have signed up)
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("user_id, first_name, last_name, email")
      .eq("team_id", teamId)
      .eq("status", "active")
      .not("user_id", "is", null)

    if (playersError) {
      console.error("[GET /api/messages/contacts] players", playersError)
      // Non-fatal - continue with team members only
    }

    // Combine user IDs from both sources
    const memberUserIds = (members ?? []).map((m) => m.user_id)
    const playerUserIds = (players ?? []).map((p) => p.user_id).filter((id): id is string => id !== null)
    const allUserIds = [...new Set([...memberUserIds, ...playerUserIds])]

    if (allUserIds.length === 0) {
      return NextResponse.json([])
    }

    // Get user details
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", allUserIds)

    if (usersError) {
      console.error("[GET /api/messages/contacts] users", usersError)
      return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 })
    }

    // Get profiles for role info
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, role")
      .in("id", allUserIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.role]))

    // Create maps for team roles
    const memberMap = new Map((members ?? []).map((m) => [m.user_id, m.role]))
    const playerMap = new Map(
      (players ?? [])
        .filter((p) => p.user_id !== null)
        .map((p) => [p.user_id!, { firstName: p.first_name, lastName: p.last_name, email: p.email }])
    )

    // Build contacts list
    const contacts = (users ?? [])
      .map((u) => {
        // Check if user is a team member (coach, etc.) or a player
        const teamRole = memberMap.get(u.id) || "PLAYER"
        const profileRole = profileMap.get(u.id) || "player"
        const playerInfo = playerMap.get(u.id)
        
        // Use player name if available, otherwise use user name
        const displayName = playerInfo 
          ? `${playerInfo.firstName} ${playerInfo.lastName}`.trim()
          : (u.name || u.email)
        
        return {
          id: u.id,
          name: displayName,
          email: u.email || playerInfo?.email || "",
          image: null,
          role: profileRole,
          type: teamRole,
        }
      })
      .filter((c) => c.id !== user.id) // Exclude self

    return NextResponse.json(contacts)
  } catch (error: unknown) {
    console.error("[GET /api/messages/contacts]", error)
    const msg = error instanceof Error ? error.message : "Failed to load contacts"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Access denied") || msg.includes("Not a member") ? 403 : 500 }
    )
  }
}
