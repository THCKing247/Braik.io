import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/roster/print?teamId=xxx
 * Returns roster data formatted for printing/emailing
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
    
    // Get team data
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, name, org, season_name, roster_template")
      .eq("id", teamId)
      .maybeSingle()

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

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
      console.error("[GET /api/roster/print]", playersError)
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
  } catch (error: any) {
    console.error("[GET /api/roster/print]", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate roster" },
      { status: 500 }
    )
  }
}
