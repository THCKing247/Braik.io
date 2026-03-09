import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server is not configured for onboarding" },
        { status: 500 }
      )
    }

    const body = (await request.json()) as {
      orgName?: string
      orgType?: string
      city?: string
      schoolName?: string | null
      teamName?: string
      sport?: string
      primaryColor?: string
      secondaryColor?: string
      seasonName?: string
      seasonStart?: string
      seasonEnd?: string
      rosterCap?: number
      duesAmount?: number
      duesDueDate?: string
    }

    const teamName = String(body.teamName ?? "").trim()
    if (!teamName) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    const userRole = profileRoleToUserRole(session.user.role)
    try {
      await supabase
        .from("users")
        .upsert(
          {
            id: session.user.id,
            email: session.user.email ?? "",
            name: session.user.name ?? null,
            role: userRole,
            status: "active",
          },
          { onConflict: "id" }
        )
        .select()
        .single()
    } catch {
      // ignore upsert errors (e.g. user already exists)
    }

    // Create team; set created_by so RBAC recognizes the creator (no team_members table in production)
    const teamInsert: Record<string, unknown> = {
      name: teamName,
      created_by: session.user.id,
    }
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert(teamInsert)
      .select("id")
      .single()

    if (teamError || !team?.id) {
      return NextResponse.json(
        { error: teamError?.message ?? "Failed to create team" },
        { status: 500 }
      )
    }

    // Set profile so user is head coach for this team (production source of truth)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ team_id: team.id })
      .eq("id", session.user.id)

    if (profileError) {
      await supabase.from("teams").delete().eq("id", team.id)
      return NextResponse.json(
        { error: profileError.message ?? "Failed to update your profile" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, teamId: team.id })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Onboarding failed" },
      { status: 500 }
    )
  }
}
