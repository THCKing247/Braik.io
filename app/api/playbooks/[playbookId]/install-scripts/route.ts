import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/playbooks/[playbookId]/install-scripts
 * List install scripts for the playbook.
 */
export async function GET(
  _request: Request,
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

    const { data: playbook } = await supabase
      .from("playbooks")
      .select("id, team_id")
      .eq("id", playbookId)
      .maybeSingle()

    if (!playbook) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 })
    }

    await requireTeamAccess(playbook.team_id)

    const { data: rows, error } = await supabase
      .from("install_scripts")
      .select("id, playbook_id, team_id, name, created_at")
      .eq("playbook_id", playbookId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[GET /api/playbooks/[playbookId]/install-scripts]", error)
      return NextResponse.json({ error: "Failed to load install scripts" }, { status: 500 })
    }

    const list = (rows ?? []).map((r) => ({
      id: r.id,
      playbookId: r.playbook_id,
      teamId: r.team_id,
      name: r.name,
      createdAt: r.created_at,
    }))

    return NextResponse.json(list)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/playbooks/[playbookId]/install-scripts]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load install scripts" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/playbooks/[playbookId]/install-scripts
 * Create a new install script.
 */
export async function POST(
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

    const body = (await request.json().catch(() => ({}))) as { name?: string }
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Install script"

    const supabase = getSupabaseServer()

    const { data: playbook } = await supabase
      .from("playbooks")
      .select("id, team_id")
      .eq("id", playbookId)
      .maybeSingle()

    if (!playbook) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 })
    }

    await requireTeamAccess(playbook.team_id)

    const { data: script, error } = await supabase
      .from("install_scripts")
      .insert({
        playbook_id: playbookId,
        team_id: playbook.team_id,
        name,
      })
      .select("id, playbook_id, team_id, name, created_at")
      .single()

    if (error || !script) {
      console.error("[POST /api/playbooks/[playbookId]/install-scripts]", error)
      return NextResponse.json({ error: "Failed to create install script" }, { status: 500 })
    }

    return NextResponse.json({
      id: script.id,
      playbookId: script.playbook_id,
      teamId: script.team_id,
      name: script.name,
      createdAt: script.created_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[POST /api/playbooks/[playbookId]/install-scripts]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to create install script" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
