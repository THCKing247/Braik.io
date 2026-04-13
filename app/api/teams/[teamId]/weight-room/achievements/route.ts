import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getHeadCoachUserIds, getThreeLiftBreakdown, getThreeLiftTotal } from "@/lib/weight-room-server"

/**
 * GET — 1000 lb club members + recent PR flags (maxes where weight > prior best for that lift)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()

    const { data: teamRow } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
    const teamName = (teamRow as { name?: string | null } | null)?.name?.trim() ?? ""

    const headIds = await getHeadCoachUserIds(supabase, teamId)
    let headCoachName = ""
    if (headIds[0]) {
      const { data: u } = await supabase.from("users").select("name").eq("id", headIds[0]).maybeSingle()
      headCoachName = String((u as { name?: string | null } | null)?.name ?? "").trim()
    }

    const { data: players } = await supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number, position_group")
      .eq("team_id", teamId)
      .neq("status", "inactive")

    const club: {
      playerId: string
      name: string
      jerseyNumber: number | null
      positionGroup: string | null
      benchLbs: number
      squatLbs: number
      cleanLbs: number
      combinedThree: number
      dateAchieved: string
    }[] = []
    for (const p of players ?? []) {
      const t = await getThreeLiftTotal(supabase, teamId, p.id)
      if (t >= 1000) {
        const bd = await getThreeLiftBreakdown(supabase, teamId, p.id)
        club.push({
          playerId: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          jerseyNumber: (p as { jersey_number?: number | null }).jersey_number ?? null,
          positionGroup: (p as { position_group?: string | null }).position_group ?? null,
          benchLbs: bd.bench,
          squatLbs: bd.squat,
          cleanLbs: bd.clean,
          combinedThree: t,
          dateAchieved: bd.dateAchieved,
        })
      }
    }
    club.sort((a, b) => b.combinedThree - a.combinedThree)

    const { data: recentMaxes } = await supabase
      .from("player_maxes")
      .select("id, player_id, lift_type, weight_lbs, logged_date, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(80)

    const prFlags: { playerId: string; liftType: string; weightLbs: number; loggedDate: string }[] = []
    for (const m of recentMaxes ?? []) {
      const { data: prior } = await supabase
        .from("player_maxes")
        .select("weight_lbs")
        .eq("team_id", teamId)
        .eq("player_id", m.player_id)
        .eq("lift_type", m.lift_type)
        .lt("created_at", m.created_at)
        .order("weight_lbs", { ascending: false })
        .limit(1)
        .maybeSingle()

      const prevBest = prior?.weight_lbs ?? 0
      if (m.weight_lbs > prevBest) {
        prFlags.push({
          playerId: m.player_id,
          liftType: m.lift_type,
          weightLbs: m.weight_lbs,
          loggedDate: m.logged_date,
        })
      }
    }

    return NextResponse.json({
      thousandLbClub: club,
      recentPRs: prFlags.slice(0, 30),
      teamName,
      headCoachName,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
