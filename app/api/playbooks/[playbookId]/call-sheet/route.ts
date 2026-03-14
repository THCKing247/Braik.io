import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { DEFAULT_CALL_SHEET_CONFIG, type CallSheetConfig } from "@/lib/constants/call-sheet-sections"

/**
 * GET /api/playbooks/[playbookId]/call-sheet
 * Returns call sheet config for the playbook (sections and play IDs). Creates default if missing.
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

    const { data: row } = await supabase
      .from("call_sheets")
      .select("config")
      .eq("playbook_id", playbookId)
      .maybeSingle()

    const config: CallSheetConfig = row?.config ?? DEFAULT_CALL_SHEET_CONFIG
    return NextResponse.json(config)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/playbooks/[playbookId]/call-sheet]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load call sheet" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/playbooks/[playbookId]/call-sheet
 * Upserts call sheet config (full sections array with playIds).
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

    const body = (await request.json()) as { config?: CallSheetConfig }
    if (!body.config || !Array.isArray(body.config.sections)) {
      return NextResponse.json({ error: "config.sections is required" }, { status: 400 })
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

    const { error } = await supabase
      .from("call_sheets")
      .upsert(
        {
          playbook_id: playbookId,
          team_id: playbook.team_id,
          config: body.config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "playbook_id" }
      )

    if (error) {
      console.error("[PATCH /api/playbooks/[playbookId]/call-sheet]", error)
      return NextResponse.json({ error: "Failed to save call sheet" }, { status: 500 })
    }

    return NextResponse.json(body.config)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[PATCH /api/playbooks/[playbookId]/call-sheet]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to save call sheet" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
