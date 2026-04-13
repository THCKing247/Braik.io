import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getHeadCoachUserIds } from "@/lib/weight-room-server"

type MaxRow = {
  id: string
  player_id: string
  lift_type: string
  weight_lbs: number
  logged_date: string
  created_at: string
}

function isThreeLift(lt: string): lt is "BENCH" | "SQUAT" | "CLEAN" {
  return lt === "BENCH" || lt === "SQUAT" || lt === "CLEAN"
}

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

    const { data: allMaxRowsRaw } = await supabase
      .from("player_maxes")
      .select("id, player_id, lift_type, weight_lbs, logged_date, created_at")
      .eq("team_id", teamId)

    const allMaxRows = (allMaxRowsRaw ?? []) as MaxRow[]

    /** Max weight per lift (1000 club uses max per lift, summed). */
    const bestByLift = new Map<string, Record<string, number>>()
    const dateForBest = new Map<string, Record<string, string>>()

    for (const m of allMaxRows) {
      const lt = String(m.lift_type)
      if (!isThreeLift(lt)) continue
      const w = Number(m.weight_lbs) || 0
      const ld = String(m.logged_date ?? "").slice(0, 10)
      const lifts = bestByLift.get(m.player_id) ?? {}
      const dates = dateForBest.get(m.player_id) ?? {}
      const prevW = lifts[lt]
      if (prevW === undefined || w > prevW) {
        lifts[lt] = w
        dates[lt] = ld
        bestByLift.set(m.player_id, lifts)
        dateForBest.set(m.player_id, dates)
      } else if (w === prevW && w > 0 && ld > (dates[lt] ?? "")) {
        dates[lt] = ld
        dateForBest.set(m.player_id, dates)
      }
    }

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
      const lifts = bestByLift.get(p.id) ?? {}
      const bench = lifts["BENCH"] ?? 0
      const squat = lifts["SQUAT"] ?? 0
      const clean = lifts["CLEAN"] ?? 0
      const combined = bench + squat + clean
      if (combined < 1000) continue

      const dates = dateForBest.get(p.id) ?? {}
      const dateAchieved =
        [dates["BENCH"], dates["SQUAT"], dates["CLEAN"]].filter(Boolean).sort().pop() ??
        new Date().toISOString().slice(0, 10)

      club.push({
        playerId: p.id,
        name: `${(p as { first_name?: string }).first_name ?? ""} ${(p as { last_name?: string }).last_name ?? ""}`.trim() || "Player",
        jerseyNumber: (p as { jersey_number?: number | null }).jersey_number ?? null,
        positionGroup: (p as { position_group?: string | null }).position_group ?? null,
        benchLbs: bench,
        squatLbs: squat,
        cleanLbs: clean,
        combinedThree: combined,
        dateAchieved,
      })
    }
    club.sort((a, b) => b.combinedThree - a.combinedThree)

    const pk = (pid: string, lt: string) => `${pid}|${lt}`
    const byPlayerLift = new Map<string, MaxRow[]>()
    for (const r of allMaxRows) {
      const k = pk(r.player_id, r.lift_type)
      const arr = byPlayerLift.get(k) ?? []
      arr.push(r)
      byPlayerLift.set(k, arr)
    }
    for (const arr of byPlayerLift.values()) {
      arr.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    }

    const priorBeforeMax = new Map<string, number[]>()
    for (const [k, arr] of byPlayerLift) {
      const prefix: number[] = []
      let run = 0
      for (let i = 0; i < arr.length; i++) {
        prefix[i] = run
        run = Math.max(run, arr[i].weight_lbs)
      }
      priorBeforeMax.set(k, prefix)
    }

    const recentSorted = [...allMaxRows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    const recentMaxes = recentSorted.slice(0, 80)

    const prFlags: { playerId: string; liftType: string; weightLbs: number; loggedDate: string }[] = []
    for (const m of recentMaxes) {
      const arr = byPlayerLift.get(pk(m.player_id, m.lift_type))
      if (!arr?.length) continue
      const idx = arr.findIndex((r) => r.id === m.id)
      if (idx < 0) continue
      const priorMax = priorBeforeMax.get(pk(m.player_id, m.lift_type))?.[idx] ?? 0
      if (m.weight_lbs > priorMax) {
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
