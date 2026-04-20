import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { logPlayerProfileActivity } from "@/lib/player-profile-activity"
import { revalidateTeamCalendar } from "@/lib/cache/lightweight-get-cache"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

/**
 * PATCH /api/roster/[playerId]/follow-ups/[followUpId]
 * Update follow-up (resolve or edit note). Coach only. Body: { status?: 'resolved', note?: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playerId: string; followUpId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId: segment, followUpId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!segment || !followUpId || !teamId) {
      return NextResponse.json({ error: "playerId, followUpId, and teamId are required" }, { status: 400 })
    }

    const resolvedPlayerId = await resolveRosterApiPlayerUuid(teamId, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const supabase = getSupabaseServer()
    const { data: existing, error: fetchErr } = await supabase
      .from("player_follow_ups")
      .select("id, player_id, team_id, category, status")
      .eq("id", followUpId)
      .eq("player_id", resolvedPlayerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Follow-up not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can update follow-ups." }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as { status?: string; note?: string }
    const row = existing as { id: string; player_id: string; team_id: string; category: string; status: string }
    const updates: { status?: string; note?: string | null; updated_at: string; resolved_at?: string | null } = {
      updated_at: new Date().toISOString(),
    }

    if (body.status === "resolved" && row.status !== "resolved") {
      updates.status = "resolved"
      updates.resolved_at = new Date().toISOString()
    }
    if (typeof body.note === "string") {
      updates.note = body.note.trim() || null
    }

    const { data: updated, error } = await supabase
      .from("player_follow_ups")
      .update(updates)
      .eq("id", followUpId)
      .select("id, status, resolved_at, note")
      .single()

    if (error) {
      console.error("[PATCH /api/roster/.../follow-ups/...]", error.message)
      return NextResponse.json({ error: "Failed to update follow-up" }, { status: 500 })
    }

    if (updates.status === "resolved") {
      const { data: linkedEv } = await supabase
        .from("events")
        .select("id, title, description")
        .eq("linked_follow_up_id", followUpId)
        .eq("team_id", teamId)
        .maybeSingle()

      if (linkedEv) {
        const ev = linkedEv as { id: string; title: string; description: string | null }
        const newTitle = ev.title.startsWith("[Resolved]") ? ev.title : `[Resolved] ${ev.title}`
        const resolvedLine = `Resolved: ${new Date().toISOString()}`
        const desc = (ev.description ?? "").trim()
        const newDesc = desc ? `${desc}\n\n${resolvedLine}` : resolvedLine
        const { error: evUpdErr } = await supabase.from("events").update({ title: newTitle, description: newDesc }).eq("id", ev.id)
        if (evUpdErr) {
          console.warn("[PATCH /api/roster/.../follow-ups/...] calendar update failed", evUpdErr.message)
        }
      }

      await logPlayerProfileActivity({
        playerId: row.player_id,
        teamId: row.team_id,
        actorId: session.user.id,
        actionType: "follow_up_resolved",
        targetType: "follow_up",
        targetId: row.id,
        metadata: { category: row.category },
      })
    }

    revalidateTeamCalendar(teamId)

    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[PATCH /api/roster/.../follow-ups/...]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
