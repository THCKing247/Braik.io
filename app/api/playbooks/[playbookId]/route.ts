import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

/**
 * GET /api/playbooks/[playbookId]
 * Returns a single playbook.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playbookId } = await params
    if (!playbookId) {
      return NextResponse.json({ error: "playbookId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: playbook, error } = await supabase
      .from("playbooks")
      .select("id, team_id, name, visibility, created_at, updated_at")
      .eq("id", playbookId)
      .maybeSingle()

    if (error) {
      console.error("[GET /api/playbooks/[playbookId]]", error)
      return NextResponse.json({ error: "Failed to load playbook" }, { status: 500 })
    }

    if (!playbook) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 })
    }

    await requireTeamAccess(playbook.team_id)

    return NextResponse.json({
      id: playbook.id,
      teamId: playbook.team_id,
      name: playbook.name,
      visibility: playbook.visibility ?? "team",
      createdAt: playbook.created_at,
      updatedAt: playbook.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/playbooks/[playbookId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load playbook" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/playbooks/[playbookId]
 * Updates a playbook.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playbookId } = await params
    if (!playbookId) {
      return NextResponse.json({ error: "playbookId is required" }, { status: 400 })
    }

    const body = (await request.json()) as { name?: string; visibility?: string }
    const supabase = getSupabaseServer()

    const { data: existing } = await supabase
      .from("playbooks")
      .select("id, team_id")
      .eq("id", playbookId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 })
    }

    await requireTeamAccess(existing.team_id)

    const updates: { name?: string; visibility?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }
    if (body.name != null && typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim()
    }
    if (
      body.visibility != null &&
      ["team", "offense", "defense", "special_teams"].includes(body.visibility)
    ) {
      updates.visibility = body.visibility
    }

    const { data: playbook, error } = await supabase
      .from("playbooks")
      .update(updates)
      .eq("id", playbookId)
      .select("id, team_id, name, visibility, created_at, updated_at")
      .single()

    if (error || !playbook) {
      console.error("[PATCH /api/playbooks/[playbookId]]", error)
      return NextResponse.json({ error: "Failed to update playbook" }, { status: 500 })
    }

    trackProductEventServer({
      eventName: BRAIK_EVENTS.playbook.updated,
      userId: session.user.id,
      teamId: playbook.team_id,
      role: session.user.role ?? null,
      metadata: { playbook_id: playbookId },
    })

    return NextResponse.json({
      id: playbook.id,
      teamId: playbook.team_id,
      name: playbook.name,
      visibility: playbook.visibility ?? "team",
      createdAt: playbook.created_at,
      updatedAt: playbook.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[PATCH /api/playbooks/[playbookId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to update playbook" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/playbooks/[playbookId]
 * Deletes a playbook (formations and plays are set to playbook_id = null via schema).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playbookId } = await params
    if (!playbookId) {
      return NextResponse.json({ error: "playbookId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: existing } = await supabase
      .from("playbooks")
      .select("id, team_id")
      .eq("id", playbookId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 })
    }

    await requireTeamAccess(existing.team_id)

    const { error } = await supabase.from("playbooks").delete().eq("id", playbookId)

    if (error) {
      console.error("[DELETE /api/playbooks/[playbookId]]", error)
      return NextResponse.json({ error: "Failed to delete playbook" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[DELETE /api/playbooks/[playbookId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete playbook" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
