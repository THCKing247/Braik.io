import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"

/**
 * Default roster template when teams.roster_template column is missing or unavailable.
 * Used to avoid 500s during rolling migrations or in environments where the column
 * has not been added yet.
 */
const DEFAULT_ROSTER_TEMPLATE = {
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
    sortBy: "jerseyNumber" as const,
  },
  footer: {
    showGeneratedDate: true,
    customText: "",
  },
}

/**
 * GET /api/roster/print?teamId=xxx
 * Returns roster data formatted for printing/emailing.
 * Uses only guaranteed team columns first; optional fields (season_name, roster_template,
 * school_id/schools) are loaded separately so production schema mismatches during
 * rolling migrations do not cause 500s.
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

    // --- Stage: team base lookup (id only to avoid any missing-column 500s) ---
    // Only "id" is selected so production schemas missing name/org/season_name/roster_template
    // cannot cause PostgREST to fail on this first query.
    const { data: teamRow, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("id", teamId)
      .maybeSingle()

    if (teamError) {
      console.error("[GET /api/roster/print] Team base lookup failed", { teamId, error: teamError })
      return NextResponse.json(
        { error: "Failed to load team", stage: "team_base" },
        { status: 500 }
      )
    }
    if (!teamRow) {
      console.warn("[GET /api/roster/print] Team not found", { teamId })
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // --- Optional: team display fields (name, org) ---
    // Loaded separately so missing columns do not crash the endpoint; use defaults if unavailable.
    let teamName = "Team"
    let teamOrg: string | null = null
    try {
      const { data: display, error: displayError } = await supabase
        .from("teams")
        .select("name, org")
        .eq("id", teamId)
        .maybeSingle()
      if (displayError) {
        console.warn("[GET /api/roster/print] Optional team display (name, org) lookup failed", {
          teamId,
          error: displayError,
        })
      } else if (display) {
        const d = display as { name?: string | null; org?: string | null }
        if (d.name != null && d.name !== "") teamName = d.name
        if (d.org != null && d.org !== "") teamOrg = d.org
      }
    } catch (displayErr) {
      console.warn("[GET /api/roster/print] Optional team display lookup threw", { teamId, error: displayErr })
    }

    // --- Stage: access check ---
    try {
      await requireTeamAccess(teamId)
    } catch (accessErr: unknown) {
      const msg = accessErr instanceof Error ? accessErr.message : "Access denied"
      if (accessErr instanceof MembershipLookupError) {
        console.error("[GET /api/roster/print] Membership lookup failed (access check)", {
          userId: session.user.id,
          teamId,
          error: accessErr,
        })
        return NextResponse.json(
          { error: "Failed to verify team access", stage: "access_check" },
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

    // --- Stage: players lookup (required for roster) ---
    // Include position_group, weight, height for official game roster submission (optional columns via add-if-not-exists migration)
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, first_name, last_name, grade, jersey_number, position_group, weight, height")
      .eq("team_id", teamId)
      .eq("status", "active")
      .order("jersey_number", { ascending: true, nullsFirst: false })
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })

    if (playersError) {
      console.error("[GET /api/roster/print] Players lookup failed", { teamId, error: playersError })
      return NextResponse.json(
        {
          error: "Failed to load roster",
          details: playersError.message,
          stage: "players",
        },
        { status: 500 }
      )
    }

    // --- Stage: optional team metadata (season_name, roster_template) ---
    // Loaded in a separate query so missing columns in production do not crash the endpoint.
    let seasonName: string | null = null
    let rosterTemplate: typeof DEFAULT_ROSTER_TEMPLATE | null = null
    try {
      const { data: meta, error: metaError } = await supabase
        .from("teams")
        .select("season_name, roster_template")
        .eq("id", teamId)
        .maybeSingle()

      if (metaError) {
        console.warn("[GET /api/roster/print] Optional team metadata lookup failed (column may not exist)", {
          teamId,
          error: metaError,
        })
      } else if (meta) {
        seasonName = (meta as { season_name?: string | null }).season_name ?? null
        const raw = (meta as { roster_template?: unknown }).roster_template
        if (raw && typeof raw === "object" && raw !== null) {
          rosterTemplate = raw as typeof DEFAULT_ROSTER_TEMPLATE
        }
      }
    } catch (metaErr) {
      console.warn("[GET /api/roster/print] Optional team metadata lookup threw", {
        teamId,
        error: metaErr,
      })
    }

    // --- Stage: optional school lookup ---
    // school_id / schools table may not exist in all environments.
    let schoolName: string | null = null
    try {
      const { data: teamWithSchool, error: schoolIdError } = await supabase
        .from("teams")
        .select("school_id")
        .eq("id", teamId)
        .maybeSingle()

      if (schoolIdError) {
        console.warn("[GET /api/roster/print] Optional school_id lookup failed (column may not exist)", {
          teamId,
          error: schoolIdError,
        })
      } else if (teamWithSchool && (teamWithSchool as { school_id?: string | null }).school_id) {
        const schoolId = (teamWithSchool as { school_id: string }).school_id
        const { data: school } = await supabase
          .from("schools")
          .select("name")
          .eq("id", schoolId)
          .maybeSingle()
        if (school && (school as { name?: string }).name) {
          schoolName = (school as { name: string }).name
        }
      }
    } catch (schoolErr) {
      console.warn("[GET /api/roster/print] Optional school lookup threw (table/column may not exist)", {
        teamId,
        error: schoolErr,
      })
    }

    // Fallback: use org as school name when school lookup unavailable or empty
    if (!schoolName && teamOrg) {
      schoolName = teamOrg
    }

    const currentYear = new Date().getFullYear()
    const template = {
      ...DEFAULT_ROSTER_TEMPLATE,
      ...rosterTemplate,
      header: { ...DEFAULT_ROSTER_TEMPLATE.header, ...(rosterTemplate?.header ?? {}) },
      body: {
        ...DEFAULT_ROSTER_TEMPLATE.body,
        ...(rosterTemplate?.body ?? {}),
      },
      footer: { ...DEFAULT_ROSTER_TEMPLATE.footer, ...(rosterTemplate?.footer ?? {}) },
    }

    const formattedPlayers = (players || []).map((p) => {
      const row = p as {
        first_name: string
        last_name: string
        grade: number | null
        jersey_number: number | null
        position_group?: string | null
        weight?: number | null
        height?: string | null
      }
      return {
        jerseyNumber: row.jersey_number,
        name: `${row.first_name} ${row.last_name}`,
        grade: row.grade,
        gradeLabel: row.grade
          ? row.grade === 9
            ? "Freshman"
            : row.grade === 10
              ? "Sophomore"
              : row.grade === 11
                ? "Junior"
                : row.grade === 12
                  ? "Senior"
                  : `Grade ${row.grade}`
          : null,
        position: row.position_group ?? null,
        weight: row.weight != null ? row.weight : null,
        height: row.height ?? null,
      }
    })

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
      teamId: teamRow.id,
      team: {
        id: teamRow.id,
        name: teamName,
        schoolName,
        seasonName,
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
      { error: message, stage: "unexpected" },
      { status: 500 }
    )
  }
}
