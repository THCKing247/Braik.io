import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"

/**
 * GET /api/roster/print?teamId=xxx
 * Returns roster data formatted for printing/emailing
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      console.warn("[GET /api/roster/print] Unauthorized: no session or user id")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      console.warn("[GET /api/roster/print] Bad request: teamId is missing")
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Get team data
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, name, org, season_name, roster_template")
      .eq("id", teamId)
      .maybeSingle()

    if (teamError) {
      console.error("[GET /api/roster/print] Team lookup failed", { teamId, error: teamError })
      return NextResponse.json({ error: "Failed to load team" }, { status: 500 })
    }
    if (!team) {
      console.warn("[GET /api/roster/print] Team not found", { teamId })
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    try {
      await requireTeamAccess(teamId)
    } catch (accessErr: unknown) {
      const msg = accessErr instanceof Error ? accessErr.message : "Access denied"
      if (accessErr instanceof MembershipLookupError) {
        console.error("[GET /api/roster/print] Membership lookup failed", {
          userId: session.user.id,
          teamId,
          error: accessErr,
        })
        return NextResponse.json(
          { error: "Failed to verify team access" },
          { status: 500 }
        )
      }
      if (msg === "Unauthorized") {
        console.warn("[GET /api/roster/print] Unauthorized", { teamId })
        return NextResponse.json({ error: msg }, { status: 401 })
      }
      console.warn("[GET /api/roster/print] Access denied", {
        userId: session.user.id,
        teamId,
        reason: msg,
      })
      return NextResponse.json({ error: msg }, { status: 403 })
    }

    // Get players
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, first_name, last_name, grade, jersey_number")
      .eq("team_id", teamId)
      .eq("status", "active")
      .order("jersey_number", { ascending: true, nullsFirst: false })
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })

    if (playersError) {
      console.error("[GET /api/roster/print] Players query failed", { teamId, error: playersError })
      return NextResponse.json({ error: "Failed to load roster" }, { status: 500 })
    }

    // Get school name if team has school_id
    let schoolName: string | null = null
    try {
      const { data: teamWithSchool } = await supabase
        .from("teams")
        .select("school_id")
        .eq("id", teamId)
        .maybeSingle()

      if (teamWithSchool && (teamWithSchool as any).school_id) {
        const { data: school } = await supabase
          .from("schools")
          .select("name")
          .eq("id", (teamWithSchool as any).school_id)
          .maybeSingle()
        if (school) {
          schoolName = school.name
        }
      }
    } catch (err) {
      // Ignore if schools table doesn't exist or query fails
    }

    // Use org as fallback for school name
    if (!schoolName && (team as any).org) {
      schoolName = (team as any).org
    }

    // Get current year
    const currentYear = new Date().getFullYear()

    // Get template (with defaults)
    const template = (team as any).roster_template || {
      header: {
        showYear: true,
        showSchoolName: true,
        showTeamName: true,
        yearLabel: "Year",
        schoolNameLabel: "School",
        teamNameLabel: "Team",
      },
      body: {
        showJerseyNumber: true,
        showPlayerName: true,
        showGrade: true,
        jerseyNumberLabel: "Number",
        playerNameLabel: "Name",
        gradeLabel: "Grade",
        sortBy: "jerseyNumber",
      },
      footer: {
        showGeneratedDate: true,
        customText: "",
      },
    }

    // Format players based on template
    const formattedPlayers = (players || []).map((p) => ({
      jerseyNumber: p.jersey_number,
      name: `${p.first_name} ${p.last_name}`,
      grade: p.grade,
      gradeLabel: p.grade ? (p.grade === 9 ? "Freshman" : p.grade === 10 ? "Sophomore" : p.grade === 11 ? "Junior" : p.grade === 12 ? "Senior" : `Grade ${p.grade}`) : null,
    }))

    // Sort players based on template
    if (template.body.sortBy === "jerseyNumber") {
      formattedPlayers.sort((a, b) => {
        if (a.jerseyNumber === null && b.jerseyNumber === null) return 0
        if (a.jerseyNumber === null) return 1
        if (b.jerseyNumber === null) return -1
        return a.jerseyNumber - b.jerseyNumber
      })
    }

    return NextResponse.json({
      success: true,
      teamId: team.id,
      team: {
        id: team.id,
        name: (team as any).name,
        schoolName: schoolName,
        seasonName: (team as any).season_name,
        year: currentYear,
      },
      template,
      players: formattedPlayers,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate roster"
    console.error("[GET /api/roster/print] Unexpected error", { error, message })
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
