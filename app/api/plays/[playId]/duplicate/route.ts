import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

const VALID_PLAY_TYPES = ["run", "pass", "rpo", "screen"] as const

function safePlayType(raw: unknown): (typeof VALID_PLAY_TYPES)[number] | null {
  if (typeof raw !== "string" || !VALID_PLAY_TYPES.includes(raw as (typeof VALID_PLAY_TYPES)[number])) return null
  return raw as (typeof VALID_PLAY_TYPES)[number]
}

function safeTags(raw: unknown): string[] | null {
  if (raw == null) return null
  if (!Array.isArray(raw)) return null
  return raw.filter((x): x is string => typeof x === "string" && x.trim() !== "")
}

/**
 * POST /api/plays/[playId]/duplicate
 * Creates a new play with the same parent scope, name + " Copy", canvas data, routes, tags, etc.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ playId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playId } = await params
    if (!playId) {
      return NextResponse.json({ error: "playId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: source, error: fetchError } = await supabase
      .from("plays")
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, canvas_data, play_type, tags")
      .eq("id", playId)
      .maybeSingle()

    if (fetchError || !source) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    const row = source as Record<string, unknown>
    await requireTeamAccess(row.team_id as string)
    const side = (row.side as string) || "offense"
    if (side === "offense") {
      await requireTeamPermission(row.team_id as string, "edit_offense_plays")
    } else if (side === "defense") {
      await requireTeamPermission(row.team_id as string, "edit_defense_plays")
    } else {
      await requireTeamPermission(row.team_id as string, "edit_special_teams_plays")
    }

    const newName = `${String(row.name ?? "").trim()} Copy`
    const insertPayload: Record<string, unknown> = {
      team_id: row.team_id,
      playbook_id: row.playbook_id ?? null,
      formation_id: row.formation_id ?? null,
      sub_formation_id: row.sub_formation_id ?? null,
      side: row.side,
      formation: row.formation ?? "",
      subcategory: row.subcategory ?? null,
      name: newName,
      canvas_data: row.canvas_data ?? null,
    }
    if (row.play_type != null && safePlayType(row.play_type)) {
      insertPayload.play_type = row.play_type
    }
    const tags = safeTags(row.tags)
    if (tags && tags.length > 0) {
      insertPayload.tags = tags
    }

    const { data: play, error: insertError } = await supabase
      .from("plays")
      .insert(insertPayload)
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, canvas_data, play_type, tags, order_index, created_at, updated_at")
      .single()

    if (insertError || !play) {
      console.error("[POST /api/plays/[playId]/duplicate]", insertError)
      return NextResponse.json({ error: "Failed to duplicate play" }, { status: 500 })
    }

    const p = play as Record<string, unknown>
    const subFormationId = p.sub_formation_id ?? null
    let subFormationName: string | null = null
    if (subFormationId) {
      const { data: subRow } = await supabase.from("sub_formations").select("name").eq("id", subFormationId).maybeSingle()
      subFormationName = subRow?.name?.trim() ?? null
    }

    const res = NextResponse.json({
      id: p.id,
      teamId: p.team_id,
      playbookId: p.playbook_id ?? null,
      formationId: p.formation_id ?? null,
      subFormationId,
      side: p.side,
      formation: p.formation,
      subFormation: subFormationName,
      subcategory: p.subcategory ?? null,
      name: p.name,
      playType: safePlayType(p.play_type),
      canvasData: p.canvas_data ?? null,
      tags: Array.isArray(p.tags) ? p.tags : null,
      orderIndex: p.order_index ?? null,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[POST /api/plays/[playId]/duplicate]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to duplicate play" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
