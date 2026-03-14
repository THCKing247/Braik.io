import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

type PeriodEntry = { id: string; name: string; notes: string; playIds: string[] }

/**
 * GET /api/playbooks/[playbookId]/practice-scripts
 * List practice scripts for the playbook.
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
      .from("practice_scripts")
      .select("id, playbook_id, team_id, name, periods, created_at, updated_at")
      .eq("playbook_id", playbookId)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("[GET /api/playbooks/[playbookId]/practice-scripts]", error)
      return NextResponse.json({ error: "Failed to load scripts" }, { status: 500 })
    }

    const list = (rows ?? []).map((r) => ({
      id: r.id,
      playbookId: r.playbook_id,
      teamId: r.team_id,
      name: r.name,
      periodCount: Array.isArray(r.periods) ? (r.periods as PeriodEntry[]).length : 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))

    return NextResponse.json(list)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/playbooks/[playbookId]/practice-scripts]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load scripts" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/playbooks/[playbookId]/practice-scripts
 * Create a new practice script.
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

    const body = (await request.json()).catch(() => ({})) as { name?: string }
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Practice script"

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
      .from("practice_scripts")
      .insert({
        playbook_id: playbookId,
        team_id: playbook.team_id,
        name,
        periods: [],
        updated_at: new Date().toISOString(),
      })
      .select("id, playbook_id, team_id, name, periods, created_at, updated_at")
      .single()

    if (error || !script) {
      console.error("[POST /api/playbooks/[playbookId]/practice-scripts]", error)
      return NextResponse.json({ error: "Failed to create script" }, { status: 500 })
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
    console.error("[POST /api/playbooks/[playbookId]/practice-scripts]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to create script" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
