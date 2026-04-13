import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  syncPlayerMaxColumnsToProfile,
  getThreeLiftTotal,
  getThreeLiftBreakdown,
  getHeadCoachUserIds,
} from "@/lib/weight-room-server"
import { createNotifications } from "@/lib/utils/notifications"

/**
 * GET /api/teams/[teamId]/weight-room/maxes?playerId= optional
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    const session = await getServerSession()
    const uid = session?.user?.id

    const playerId = new URL(request.url).searchParams.get("playerId")
    const supabase = getSupabaseServer()

    const coach = canEditRoster(membership.role)
    if (!coach) {
      if (!playerId || !uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const { data: pl } = await supabase
        .from("players")
        .select("user_id")
        .eq("id", playerId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!pl || pl.user_id !== uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    let q = supabase
      .from("player_maxes")
      .select("*")
      .eq("team_id", teamId)
      .order("logged_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (!coach && playerId) q = q.eq("player_id", playerId)
    else if (coach && playerId) q = q.eq("player_id", playerId)

    const { data, error } = await q
    if (error) {
      console.error("[weight-room maxes GET]", error)
      return NextResponse.json({ error: "Failed to load" }, { status: 500 })
    }

    return NextResponse.json({ maxes: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const auth = await requireTeamAccess(teamId)
    if (!canEditRoster(auth.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const body = (await request.json()) as {
      playerId?: string
      liftType?: string
      weightLbs?: number
      loggedDate?: string
      notes?: string | null
    }

    if (!body.playerId || !body.liftType || !Number.isFinite(Number(body.weightLbs))) {
      return NextResponse.json({ error: "playerId, liftType, weightLbs required" }, { status: 400 })
    }

    const lift = String(body.liftType).toUpperCase()
    if (!["BENCH", "SQUAT", "CLEAN", "DEADLIFT"].includes(lift)) {
      return NextResponse.json({ error: "Invalid liftType" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: player } = await supabase
      .from("players")
      .select("id, first_name, last_name")
      .eq("id", body.playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

    const prevTotal = await getThreeLiftTotal(supabase, teamId, body.playerId)

    const { data: inserted, error } = await supabase
      .from("player_maxes")
      .insert({
        team_id: teamId,
        player_id: body.playerId,
        lift_type: lift,
        weight_lbs: Math.round(Number(body.weightLbs)),
        logged_date: body.loggedDate || new Date().toISOString().slice(0, 10),
        notes: body.notes?.trim() || null,
        created_by: auth.user.id,
      })
      .select("*")
      .single()

    if (error || !inserted) {
      console.error("[weight-room maxes POST]", error)
      return NextResponse.json({ error: "Failed to log max" }, { status: 500 })
    }

    await syncPlayerMaxColumnsToProfile(supabase, teamId, body.playerId)

    const newTotal = await getThreeLiftTotal(supabase, teamId, body.playerId)
    const breakdown = await getThreeLiftBreakdown(supabase, teamId, body.playerId)
    const crossedThousand = prevTotal < 1000 && newTotal >= 1000
    if (crossedThousand) {
      const heads = await getHeadCoachUserIds(supabase, teamId)
      if (heads.length > 0) {
        await createNotifications({
          type: "stats_updated",
          teamId,
          title: "1000 lb Club",
          body: `${player.first_name} ${player.last_name} reached a 1,000+ lb combined (bench + squat + clean) total.`,
          targetUserIds: heads,
          linkType: "weight_room",
          linkId: teamId,
        })
      }
    }

    return NextResponse.json({
      max: inserted,
      threeLiftTotal: newTotal,
      crossedThousand,
      threeLiftBreakdown: {
        benchLbs: breakdown.bench,
        squatLbs: breakdown.squat,
        cleanLbs: breakdown.clean,
        dateAchieved: breakdown.dateAchieved,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    console.error("[weight-room maxes POST]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
