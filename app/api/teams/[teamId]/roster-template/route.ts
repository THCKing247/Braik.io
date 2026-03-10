import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

/**
 * GET /api/teams/[teamId]/roster-template
 * Returns the roster template for a team
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team, error } = await supabase
      .from("teams")
      .select("roster_template")
      .eq("id", teamId)
      .maybeSingle()

    if (error || !team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "manage")

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
        showPosition: true,
        showWeight: true,
        showHeight: true,
        jerseyNumberLabel: "Number",
        playerNameLabel: "Name",
        gradeLabel: "Grade",
        positionLabel: "Position",
        weightLabel: "Weight",
        heightLabel: "Height",
        sortBy: "jerseyNumber",
      },
      footer: {
        showGeneratedDate: true,
        customText: "",
      },
    }

    return NextResponse.json({ template })
  } catch (error: any) {
    console.error("[GET /api/teams/.../roster-template]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load template" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/teams/[teamId]/roster-template
 * Updates the roster template for a team
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const body = await request.json()
    const { template } = body

    if (!template) {
      return NextResponse.json({ error: "template is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage")

    const supabase = getSupabaseServer()
    const { error } = await supabase
      .from("teams")
      .update({ roster_template: template })
      .eq("id", teamId)

    if (error) {
      console.error("[PATCH /api/teams/.../roster-template]", error)
      return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[PATCH /api/teams/.../roster-template]", error)
    return NextResponse.json(
      { error: error.message || "Failed to update template" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
