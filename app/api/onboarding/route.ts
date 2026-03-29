import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"
import { setPrimaryHeadCoach } from "@/lib/team-members-sync"
import { isSupabaseServerConfigured } from "@/src/lib/supabase-project-env"

function normalizeProfileRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase().replace(/-/g, "_")
}

export async function POST(request: Request) {
  let programIdForRollback: string | null = null
  let adoptedTeamIdForRollback: string | null = null

  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const normalizedRole = normalizeProfileRole(session.user.role)
    if (normalizedRole !== "head_coach") {
      return NextResponse.json(
        { error: "Only head coaches can complete team setup here.", code: "ONBOARDING_ROLE" },
        { status: 403 }
      )
    }

    if (!isSupabaseServerConfigured()) {
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
    const seasonLabel =
      typeof body.seasonName === "string" && body.seasonName.trim() ? body.seasonName.trim() : null
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

    const { data: existingHcProgram } = await supabase
      .from("program_members")
      .select("program_id")
      .eq("user_id", session.user.id)
      .in("role", ["head_coach", "director_of_football"])
      .eq("active", true)
      .maybeSingle()

    if (existingHcProgram?.program_id) {
      return NextResponse.json(
        {
          error:
            "Your account already has a program. Open the dashboard to manage your team, or contact support if you need a new organization.",
          code: "ALREADY_ONBOARDED",
        },
        { status: 409 }
      )
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", session.user.id)
      .maybeSingle()

    let adoptTeamId: string | null = null
    if (profileRow?.team_id) {
      const { data: candidate } = await supabase
        .from("teams")
        .select("id, program_id, created_by")
        .eq("id", profileRow.team_id)
        .maybeSingle()
      const createdBy = (candidate as { created_by?: string } | null)?.created_by
      const progId = (candidate as { program_id?: string | null } | null)?.program_id
      if (candidate?.id && !progId && createdBy === session.user.id) {
        adoptTeamId = candidate.id as string
      }
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

    programIdForRollback = program.id as string

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

    async function rollbackProgram(): Promise<void> {
      if (!programIdForRollback) return
      const supa = getSupabaseServer()
      if (adoptedTeamIdForRollback) {
        await supa.from("teams").update({ program_id: null }).eq("id", adoptedTeamIdForRollback)
      }
      await supa.from("programs").delete().eq("id", programIdForRollback)
    }

    for (const level of teamsToCreate) {
      const name = level === "varsity" ? teamName : teamLevelNames[level] ?? teamName

      if (level === "varsity" && adoptTeamId) {
        adoptedTeamIdForRollback = adoptTeamId
        const adoptPayload = {
          program_id: program.id,
          name,
          team_level: "varsity",
          plan_type: "head_coach",
          roster_creation_mode: rosterCreationMode,
          sport,
          ...(seasonLabel ? { season: seasonLabel } : {}),
        }
        console.info("[onboarding] teams.update (adopt existing)", JSON.stringify({ teamId: adoptTeamId, ...adoptPayload }))

        const { error: adoptErr } = await supabase.from("teams").update(adoptPayload).eq("id", adoptTeamId)

        if (adoptErr) {
          await rollbackProgram()
          return NextResponse.json(
            { error: adoptErr.message ?? "Failed to link your existing team to the new program" },
            { status: 500 }
          )
        }
        createdTeamIds.push(adoptTeamId)
        primaryTeamId = adoptTeamId
        continue
      }

      const newTeamPayload = {
        program_id: program.id,
        name,
        created_by: session.user.id,
        team_level: level,
        plan_type: "head_coach",
        roster_creation_mode: rosterCreationMode,
        sport,
        ...(seasonLabel ? { season: seasonLabel } : {}),
      }
      console.info("[onboarding] teams.insert", JSON.stringify(newTeamPayload))

      const { data: team, error: teamError } = await supabase.from("teams").insert(newTeamPayload).select("id").single()

      if (teamError || !team?.id) {
        await rollbackProgram()
        return NextResponse.json(
          { error: teamError?.message ?? "Failed to create team" },
          { status: 500 }
        )
      }
      createdTeamIds.push(team.id)
      if (level === "varsity") primaryTeamId = team.id
    }

    if (!primaryTeamId) primaryTeamId = createdTeamIds[0]

    const programMemberRole = sport.toLowerCase() === "football" ? "director_of_football" : "head_coach"

    // Program membership: football program director (varsity HC) or legacy head_coach for other sports
    const { error: pmError } = await supabase.from("program_members").upsert(
      {
        program_id: program.id,
        user_id: session.user.id,
        role: programMemberRole,
        active: true,
      },
      { onConflict: "program_id,user_id" }
    )

    if (pmError) {
      await rollbackProgram()
      return NextResponse.json(
        { error: pmError.message ?? "Failed to save program membership" },
        { status: 500 }
      )
    }

    // Set profile so user is head coach for primary (varsity) team
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ team_id: primaryTeamId })
      .eq("id", session.user.id)

    if (profileError) {
      await rollbackProgram()
      return NextResponse.json(
        { error: profileError.message ?? "Failed to update your profile" },
        { status: 500 }
      )
    }

    for (const tid of createdTeamIds) {
      const { error: tmErr } = await setPrimaryHeadCoach(supabase, tid, session.user.id, {
        source: "onboarding",
      })
      if (tmErr) {
        await rollbackProgram()
        return NextResponse.json(
          { error: tmErr.message ?? "Failed to save team staff membership" },
          { status: 500 }
        )
      }
    }

    programIdForRollback = null
    adoptedTeamIdForRollback = null

    trackProductEventServer({
      eventName: BRAIK_EVENTS.onboarding.completed,
      userId: session.user.id,
      teamId: primaryTeamId,
      role: session.user.role ?? null,
      metadata: {
        program_id: program.id,
        team_count: createdTeamIds.length,
        team_levels: teamLevels,
        adopted_existing_team: Boolean(adoptTeamId),
      },
    })

    return NextResponse.json({
      success: true,
      teamId: primaryTeamId,
      programId: program.id,
      teamIds: createdTeamIds,
    })
  } catch (e) {
    if (programIdForRollback) {
      const supa = getSupabaseServer()
      if (adoptedTeamIdForRollback) {
        await supa.from("teams").update({ program_id: null }).eq("id", adoptedTeamIdForRollback)
      }
      await supa.from("programs").delete().eq("id", programIdForRollback)
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Onboarding failed" },
      { status: 500 }
    )
  }
}
