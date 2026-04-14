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

/** PATCH — replace preset workout from current editor (coaches). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; presetId: string }> }
) {
  try {
    const { teamId, presetId } = await params
    if (!teamId || !presetId) return NextResponse.json({ error: "Invalid" }, { status: 400 })

    const session = await requireTeamAccess(teamId)
    if (!canEditRoster(session.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const body = (await request.json()) as {
      name?: string
      defaultTitle?: string | null
      workoutItems?: WorkoutItemPayload[]
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim()
    if ("defaultTitle" in body) {
      patch.default_title =
        typeof body.defaultTitle === "string" && body.defaultTitle.trim() ? body.defaultTitle.trim() : null
    }
    if (Array.isArray(body.workoutItems)) {
      const workoutItems = normalizeItems(body.workoutItems)
      if (workoutItems.length === 0) {
        return NextResponse.json({ error: "At least one lift row is required" }, { status: 400 })
      }
      patch.workout_items = workoutItems
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("workout_presets")
      .update(patch)
      .eq("id", presetId)
      .eq("team_id", teamId)
      .select("id, team_id, name, default_title, workout_items, created_at, updated_at")
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }
    return NextResponse.json({ preset: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    console.error("[PATCH weight-room preset]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; presetId: string }> }
) {
  try {
    const { teamId, presetId } = await params
    if (!teamId || !presetId) return NextResponse.json({ error: "Invalid" }, { status: 400 })

    const session = await requireTeamAccess(teamId)
    if (!canEditRoster(session.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const { error } = await supabase.from("workout_presets").delete().eq("id", presetId).eq("team_id", teamId)

    if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
