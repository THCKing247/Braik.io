/**
 * GET /api/stats/template?teamId=xxx
 * Optional: &withRoster=1 for roster-prefilled rows.
 *
 * CSV columns match STATS_WEEKLY_IMPORT_HEADERS (weekly/game import is the only supported stats import).
 * players.season_stats on the All Stats page is a derived aggregate; coaches edit data via weekly rows + Add dialog.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { STATS_WEEKLY_IMPORT_HEADERS, STAT_IMPORT_FIELDS } from "@/lib/stats-import-fields"

function escapeCsvCell(val: string | number): string {
  const s = String(val)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function buildWeeklyRosterRow(
  p: { id: string; first_name?: string | null; last_name?: string | null; jersey_number?: number | null; position_group?: string | null }
): string[] {
  const values: (string | number)[] = [
    p.id ?? "",
    p.first_name ?? "",
    p.last_name ?? "",
    p.jersey_number ?? "",
    p.position_group ?? "",
    "",
    "",
    "",
    "",
    "",
  ]
  for (let i = 0; i < STAT_IMPORT_FIELDS.length; i++) values.push("")
  return values.map((v) => String(v))
}

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

    const withRoster = searchParams.get("withRoster") === "1" || searchParams.get("withRoster") === "true"

    const headerLine = STATS_WEEKLY_IMPORT_HEADERS.map(escapeCsvCell).join(",")
    const lines: string[] = [headerLine]

    if (withRoster) {
      const { data: players, error } = await supabase
        .from("players")
        .select("id, first_name, last_name, jersey_number, position_group")
        .eq("team_id", teamId)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true })

      if (!error && players?.length) {
        for (const p of players) {
          const prow = p as { id: string; first_name?: string | null; last_name?: string | null; jersey_number?: number | null; position_group?: string | null }
          const row = buildWeeklyRosterRow(prow)
          lines.push(row.map(escapeCsvCell).join(","))
        }
      }
    }

    const csv = lines.join("\n")
    const filename = withRoster ? "weekly-stats-import-with-roster.csv" : "weekly-stats-import-template.csv"

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[GET /api/stats/template] membership lookup failed", { error: err.message })
      return NextResponse.json({ error: "Failed to generate template" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json(
        { error: "You don't have access to this team's stats.", code: "TEAM_ACCESS_DENIED" },
        { status: 403 }
      )
    }
    console.error("[GET /api/stats/template]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
