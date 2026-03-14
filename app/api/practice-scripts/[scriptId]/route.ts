import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

type PeriodEntry = { id: string; name: string; notes: string; playIds: string[] }

/**
 * GET /api/practice-scripts/[scriptId]
 * Get a single practice script with periods.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { scriptId } = await params
    if (!scriptId) {
      return NextResponse.json({ error: "scriptId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: script, error } = await supabase
      .from("practice_scripts")
      .select("id, playbook_id, team_id, name, periods, created_at, updated_at")
      .eq("id", scriptId)
      .maybeSingle()

    if (error) {
      console.error("[GET /api/practice-scripts/[scriptId]]", error)
      return NextResponse.json({ error: "Failed to load script" }, { status: 500 })
    }

    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 })
    }

    await requireTeamAccess(script.team_id)

    return NextResponse.json({
      id: script.id,
      playbookId: script.playbook_id,
      teamId: script.team_id,
      name: script.name,
      periods: script.periods ?? [],
      createdAt: script.created_at,
      updatedAt: script.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/practice-scripts/[scriptId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load script" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/practice-scripts/[scriptId]
 * Update script name and/or periods (full replace).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { scriptId } = await params
    if (!scriptId) {
      return NextResponse.json({ error: "scriptId is required" }, { status: 400 })
    }

    const body = (await request.json()).catch(() => ({})) as { name?: string; periods?: PeriodEntry[] }

    const supabase = getSupabaseServer()

    const { data: existing } = await supabase
      .from("practice_scripts")
      .select("id, team_id")
      .eq("id", scriptId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 })
    }

    await requireTeamAccess(existing.team_id)

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim()
    if (Array.isArray(body.periods)) update.periods = body.periods

    const { data: script, error } = await supabase
      .from("practice_scripts")
      .update(update)
      .eq("id", scriptId)
      .select("id, playbook_id, team_id, name, periods, created_at, updated_at")
      .single()

    if (error) {
      console.error("[PATCH /api/practice-scripts/[scriptId]]", error)
      return NextResponse.json({ error: "Failed to update script" }, { status: 500 })
    }

    return NextResponse.json({
      id: script.id,
      playbookId: script.playbook_id,
      teamId: script.team_id,
      name: script.name,
      periods: script.periods ?? [],
      createdAt: script.created_at,
      updatedAt: script.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[PATCH /api/practice-scripts/[scriptId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to update script" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/practice-scripts/[scriptId]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { scriptId } = await params
    if (!scriptId) {
      return NextResponse.json({ error: "scriptId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: existing } = await supabase
      .from("practice_scripts")
      .select("id, team_id")
      .eq("id", scriptId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 })
    }

    await requireTeamAccess(existing.team_id)

    const { error } = await supabase.from("practice_scripts").delete().eq("id", scriptId)

    if (error) {
      console.error("[DELETE /api/practice-scripts/[scriptId]]", error)
      return NextResponse.json({ error: "Failed to delete script" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[DELETE /api/practice-scripts/[scriptId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete script" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
