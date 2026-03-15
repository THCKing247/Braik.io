import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"

export interface ProgramDepthChartEntry {
  id: string
  unit: string
  position: string
  string: number
  playerId: string | null
  player: {
    id: string
    firstName: string
    lastName: string
    jerseyNumber: number | null
    imageUrl: string | null
  } | null
  formation: string | null
  specialTeamType: string | null
}

export interface ProgramDepthChartLevel {
  teamId: string
  teamLevel: "varsity" | "jv" | "freshman"
  teamName: string
  entries: ProgramDepthChartEntry[]
}

/**
 * GET /api/programs/[programId]/depth-chart
 * Returns depth chart aggregated across all team levels in the program (Varsity, JV, Freshman).
 * Coaches can view program-wide depth. Response groups by team level then by unit/position.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const supabase = getSupabaseServer()

    const { data: teams, error: teamsErr } = await supabase
      .from("teams")
      .select("id, name, team_level")
      .eq("program_id", programId)
      .in("team_level", ["varsity", "jv", "freshman"])
      .order("team_level", { ascending: true })

    if (teamsErr || !teams?.length) {
      return NextResponse.json(
        { levels: [], message: "No teams with level found for program" },
        { status: 200 }
      )
    }

    const levelOrder = ["varsity", "jv", "freshman"] as const
    const sortedTeams = [...teams].sort(
      (a, b) =>
        levelOrder.indexOf((a.team_level ?? "").toLowerCase() as (typeof levelOrder)[number]) -
        levelOrder.indexOf((b.team_level ?? "").toLowerCase() as (typeof levelOrder)[number])
    )

    const levels: ProgramDepthChartLevel[] = []

    for (const team of sortedTeams) {
      const teamLevel = (team.team_level ?? "varsity").toLowerCase() as "varsity" | "jv" | "freshman"
      const { data: entries, error: entriesErr } = await supabase
        .from("depth_chart_entries")
        .select("id, unit, position, string, player_id, formation, special_team_type")
        .eq("team_id", team.id)
        .order("unit")
        .order("position")
        .order("string")

      if (entriesErr) {
        console.error("[GET /api/programs/[programId]/depth-chart] entries error:", entriesErr)
        levels.push({
          teamId: team.id,
          teamLevel,
          teamName: (team as { name?: string }).name ?? "",
          entries: [],
        })
        continue
      }

      const playerIds = [...new Set((entries ?? []).filter((e) => e.player_id).map((e) => e.player_id!))]
      let playersMap = new Map<
        string,
        { id: string; firstName: string; lastName: string; jerseyNumber: number | null; imageUrl: string | null }
      >()
      if (playerIds.length > 0) {
        const { data: players } = await supabase
          .from("players")
          .select("id, first_name, last_name, jersey_number, image_url")
          .in("id", playerIds)
        if (players) {
          playersMap = new Map(
            players.map((p) => [
              p.id,
              {
                id: p.id,
                firstName: p.first_name ?? "",
                lastName: p.last_name ?? "",
                jerseyNumber: p.jersey_number ?? null,
                imageUrl: normalizePlayerImageUrl(p.image_url) ?? null,
              },
            ])
          )
        }
      }

      const formatted: ProgramDepthChartEntry[] = (entries ?? []).map((e) => ({
        id: e.id,
        unit: e.unit,
        position: e.position,
        string: e.string,
        playerId: e.player_id,
        player: e.player_id ? playersMap.get(e.player_id) || null : null,
        formation: e.formation ?? null,
        specialTeamType: e.special_team_type ?? null,
      }))

      levels.push({
        teamId: team.id,
        teamLevel,
        teamName: (team as { name?: string }).name ?? "",
        entries: formatted,
      })
    }

    return NextResponse.json({ levels })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      console.error("[GET /api/programs/[programId]/depth-chart] membership lookup failed", err)
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a coach")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/programs/[programId]/depth-chart]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
