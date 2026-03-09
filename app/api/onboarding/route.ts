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

    // Ensure user exists in public.users (for team_members FK)
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

    // Create team (only name — org/plan_tier/status may not exist in all envs)
    const teamInsert: Record<string, unknown> = { name: teamName }
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

    // Add current user as head coach
    const { error: memberError } = await supabase.from("team_members").insert({
      team_id: team.id,
      user_id: session.user.id,
      role: "HEAD_COACH",
      active: true,
    })

    if (memberError) {
      await supabase.from("teams").delete().eq("id", team.id)
      return NextResponse.json(
        { error: memberError.message ?? "Failed to add you to the team" },
        { status: 500 }
      )
    }

    // Set default team on profile so dashboard/team switcher works
    try {
      await supabase
        .from("profiles")
        .update({ team_id: team.id })
        .eq("id", session.user.id)
    } catch {
      // ignore profile update errors
    }

    return NextResponse.json({ success: true, teamId: team.id })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Onboarding failed" },
      { status: 500 }
    )
  }
}
