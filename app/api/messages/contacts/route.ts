import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/messages/contacts?teamId=xxx
 * Returns contacts (team members) for messaging.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    await requireTeamAccess(teamId)

    // Get team members
    const { data: members, error: membersError } = await supabase
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", teamId)
      .eq("active", true)

    if (membersError) {
      console.error("[GET /api/messages/contacts] members", membersError)
      return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 })
    }

    const userIds = (members ?? []).map((m) => m.user_id)
    if (userIds.length === 0) {
      return NextResponse.json([])
    }

    // Get user details
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", userIds)

    if (usersError) {
      console.error("[GET /api/messages/contacts] users", usersError)
      return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 })
    }

    // Get profiles for role info
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, role")
      .in("id", userIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.role]))

    // Map members to contacts
    const memberMap = new Map((members ?? []).map((m) => [m.user_id, m.role]))
    const contacts = (users ?? [])
      .map((u) => {
        const teamRole = memberMap.get(u.id) || "PLAYER"
        const profileRole = profileMap.get(u.id) || "player"
        return {
          id: u.id,
          name: u.name || u.email,
          email: u.email,
          image: null,
          role: profileRole,
          type: teamRole,
        }
      })
      .filter((c) => c.id !== session.user.id) // Exclude self

    return NextResponse.json(contacts)
  } catch (error: any) {
    console.error("[GET /api/messages/contacts]", error)
  return NextResponse.json(
      { error: error.message || "Failed to load contacts" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
  )
  }
}
