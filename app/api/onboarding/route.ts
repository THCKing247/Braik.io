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
      rosterCreationMode?: "coach_precreated" | "player_self_create"
      teamLevels?: ("varsity" | "jv" | "freshman")[]
    }

    const teamName = String(body.teamName ?? "").trim()
    if (!teamName) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()
    const sport = String(body.sport ?? "football").trim() || "football"
    const rosterCreationMode = body.rosterCreationMode ?? "coach_precreated"
    const teamLevels = Array.isArray(body.teamLevels) ? body.teamLevels : ["varsity"]

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

    // Create program (head coach standalone)
    const { data: program, error: programError } = await supabase
      .from("programs")
      .insert({
        created_by_user_id: session.user.id,
        program_name: teamName,
        sport,
        plan_type: "head_coach",
      })
      .select("id")
      .single()

    if (programError || !program?.id) {
      return NextResponse.json(
        { error: programError?.message ?? "Failed to create program" },
        { status: 500 }
      )
    }

    // Create varsity team (and optionally JV/Freshman) linked to program
    const teamLevelNames: Record<string, string> = {
      varsity: teamName,
      jv: `JV ${teamName}`,
      freshman: `Freshman ${teamName}`,
    }
    const teamsToCreate = teamLevels.includes("varsity")
      ? teamLevels
      : ["varsity", ...teamLevels.filter((l) => l !== "varsity")]
    const createdTeamIds: string[] = []
    let primaryTeamId: string | null = null

    for (const level of teamsToCreate) {
      const name = level === "varsity" ? teamName : teamLevelNames[level] ?? teamName
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({
          program_id: program.id,
          name,
          created_by: session.user.id,
          team_level: level,
          plan_type: "head_coach",
          roster_creation_mode: rosterCreationMode,
          sport,
        })
        .select("id")
        .single()

      if (teamError || !team?.id) {
        // Rollback: delete program (cascade will remove nothing else yet)
        await supabase.from("programs").delete().eq("id", program.id)
        return NextResponse.json(
          { error: teamError?.message ?? "Failed to create team" },
          { status: 500 }
        )
      }
      createdTeamIds.push(team.id)
      if (level === "varsity") primaryTeamId = team.id
    }

    if (!primaryTeamId) primaryTeamId = createdTeamIds[0]

    // Program membership: head coach
    await supabase.from("program_members").upsert(
      {
        program_id: program.id,
        user_id: session.user.id,
        role: "head_coach",
        active: true,
      },
      { onConflict: "program_id,user_id" }
    )

    // Set profile so user is head coach for primary (varsity) team
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ team_id: primaryTeamId })
      .eq("id", session.user.id)

    if (profileError) {
      await supabase.from("programs").delete().eq("id", program.id)
      return NextResponse.json(
        { error: profileError.message ?? "Failed to update your profile" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      teamId: primaryTeamId,
      programId: program.id,
      teamIds: createdTeamIds,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Onboarding failed" },
      { status: 500 }
    )
  }
}
