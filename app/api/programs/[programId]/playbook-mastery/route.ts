import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

export interface PlaybookMasteryRow {
  playerId: string
  playerName: string
  teamLevel: string | null
  completedCount: number
  viewedCount: number
  totalAssigned: number
  masteryPct: number
}

/**
 * GET /api/programs/[programId]/playbook-mastery
 * Returns per-player playbook mastery summary for the program. Coaches only.
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

    const { data: teams } = await supabase
      .from("teams")
      .select("id, team_level")
      .eq("program_id", programId)

    if (!teams?.length) {
      return NextResponse.json({ players: [] })
    }

    const teamIds = teams.map((t) => t.id)
    const teamLevelById = new Map(teams.map((t) => [t.id, (t.team_level ?? "").toLowerCase()]))

    const { data: players } = await supabase
      .from("players")
      .select("id, first_name, last_name, team_id")
      .in("team_id", teamIds)

    if (!players?.length) {
      return NextResponse.json({ players: [] })
    }

    const { data: assignments } = await supabase
      .from("play_assignments")
      .select("id, team_level")
      .eq("program_id", programId)

    const totalByLevel = new Map<string, number>()
    for (const a of assignments ?? []) {
      const level = (a.team_level ?? "").toLowerCase()
      totalByLevel.set(level, (totalByLevel.get(level) ?? 0) + 1)
    }

    const { data: knowledge } = await supabase
      .from("player_play_knowledge")
      .select("player_id, status")
      .eq("program_id", programId)

    const completedByPlayer = new Map<string, number>()
    const viewedByPlayer = new Map<string, number>()
    for (const k of knowledge ?? []) {
      if (!k.player_id) continue
      if (k.status === "quiz_passed" || k.status === "completed") {
        completedByPlayer.set(k.player_id, (completedByPlayer.get(k.player_id) ?? 0) + 1)
      } else if (k.status === "viewed") {
        viewedByPlayer.set(k.player_id, (viewedByPlayer.get(k.player_id) ?? 0) + 1)
      }
    }

    const playersList: PlaybookMasteryRow[] = players.map((p) => {
      const level = teamLevelById.get((p as { team_id: string }).team_id) ?? null
      const totalAssigned = level ? totalByLevel.get(level) ?? 0 : 0
      const completed = completedByPlayer.get(p.id) ?? 0
      const viewed = viewedByPlayer.get(p.id) ?? 0
      const masteryPct = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0
      return {
        playerId: p.id,
        playerName: `${(p as { first_name?: string }).first_name ?? ""} ${(p as { last_name?: string }).last_name ?? ""}`.trim() || "Unknown",
        teamLevel: level || null,
        completedCount: completed,
        viewedCount: viewed,
        totalAssigned,
        masteryPct,
      }
    })

    playersList.sort((a, b) => b.masteryPct - a.masteryPct)

    return NextResponse.json({ players: playersList })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/programs/[programId]/playbook-mastery]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
