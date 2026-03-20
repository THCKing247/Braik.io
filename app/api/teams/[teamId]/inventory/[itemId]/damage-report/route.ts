import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

const MAX_LEN = 2000

/**
 * POST /api/teams/[teamId]/inventory/[itemId]/damage-report
 * Assigned player only: submit damage / issue note on equipment assigned to them.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string; itemId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, itemId } = await params
    if (!teamId || !itemId) {
      return NextResponse.json({ error: "teamId and itemId are required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)

    let body: { message?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const message = (body.message ?? "").trim()
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }
    if (message.length > MAX_LEN) {
      return NextResponse.json({ error: `Message must be at most ${MAX_LEN} characters` }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: item, error: itemErr } = await supabase
      .from("inventory_items")
      .select("id, team_id, assigned_to_player_id")
      .eq("id", itemId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (itemErr || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const assignedId = item.assigned_to_player_id as string | null
    if (!assignedId) {
      return NextResponse.json(
        { error: "This item is not assigned to a player." },
        { status: 403 }
      )
    }

    const { data: player, error: pErr } = await supabase
      .from("players")
      .select("id, user_id")
      .eq("id", assignedId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (pErr || !player || player.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "You can only report damage on equipment assigned to you." },
        { status: 403 }
      )
    }

    const { error: upErr } = await supabase
      .from("inventory_items")
      .update({
        damage_report_text: message,
        damage_reported_at: new Date().toISOString(),
        damage_reported_by_player_id: assignedId,
      })
      .eq("id", itemId)
      .eq("team_id", teamId)

    if (upErr) {
      console.error("[POST damage-report]", upErr)
      return NextResponse.json({ error: "Failed to save report" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST damage-report]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
