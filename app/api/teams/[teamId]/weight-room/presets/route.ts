import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

type WorkoutItemPayload = { lift?: string; reps?: string }

function normalizeItems(raw: unknown): { lift: string; reps: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => {
      const o = r as WorkoutItemPayload
      return {
        lift: typeof o?.lift === "string" ? o.lift.trim() : "",
        reps: typeof o?.reps === "string" ? o.reps.trim() : "",
      }
    })
    .filter((x) => x.lift.length > 0 || x.reps.length > 0)
}

/**
 * GET /api/teams/[teamId]/weight-room/presets
 * POST — create preset (coaches)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const session = await requireTeamAccess(teamId)
    if (!canEditRoster(session.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("workout_presets")
      .select("id, team_id, name, default_title, workout_items, created_at, updated_at")
      .eq("team_id", teamId)
      .order("name", { ascending: true })

    if (error) {
      console.error("[weight-room presets GET]", error)
      return NextResponse.json({ error: "Failed to load presets" }, { status: 500 })
    }

    return NextResponse.json({ presets: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[weight-room presets GET]", e)
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

    const session = await requireTeamAccess(teamId)
    if (!canEditRoster(session.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const body = (await request.json()) as {
      name?: string
      defaultTitle?: string | null
      workoutItems?: WorkoutItemPayload[]
    }

    if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

    const workoutItems = normalizeItems(body.workoutItems)
    if (workoutItems.length === 0) {
      return NextResponse.json({ error: "At least one lift row is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("workout_presets")
      .insert({
        team_id: teamId,
        name: body.name.trim(),
        default_title: typeof body.defaultTitle === "string" && body.defaultTitle.trim() ? body.defaultTitle.trim() : null,
        workout_items: workoutItems,
        created_by: session.user.id,
      })
      .select("id, team_id, name, default_title, workout_items, created_at, updated_at")
      .single()

    if (error) {
      console.error("[weight-room presets POST]", error)
      return NextResponse.json({ error: "Failed to save preset" }, { status: 500 })
    }

    return NextResponse.json({ preset: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[weight-room presets POST]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
