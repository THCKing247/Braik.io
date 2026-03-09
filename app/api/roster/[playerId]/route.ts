import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * PATCH /api/roster/[playerId] - Update a player (e.g. invite_code, invite_status).
 * Used when coach "sends invite" to a coach-created player: set invite_code and invite_status = 'invited'.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId } = await params
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const { requireTeamPermission } = await import("@/lib/auth/rbac")
    const supabase = getSupabaseServer()

    const { data: player, error: fetchErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (fetchErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamPermission(player.team_id, "edit_roster")

    const body = (await request.json()) as {
      inviteCode?: string | null
      inviteStatus?: "not_invited" | "invited" | "joined"
      email?: string | null
      [key: string]: unknown
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.inviteCode === "string" && body.inviteCode.trim()) {
      updates.invite_code = body.inviteCode.trim()
    }
    if (body.inviteStatus === "not_invited" || body.inviteStatus === "invited" || body.inviteStatus === "joined") {
      updates.invite_status = body.inviteStatus
    }
    if (body.email !== undefined) {
      updates.email = typeof body.email === "string" ? body.email.trim().toLowerCase() || null : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from("players")
      .update(updates)
      .eq("id", playerId)
      .select()
      .single()

    if (error) {
      console.error("[PATCH /api/roster/[playerId]]", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const p = updated as {
      id: string
      first_name: string
      last_name: string
      grade: number | null
      jersey_number: number | null
      position_group: string | null
      status: string
      notes: string | null
      image_url: string | null
      user_id: string | null
      email?: string | null
      invite_code?: string | null
      invite_status?: string
      claimed_at?: string | null
    }
    return NextResponse.json({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      grade: p.grade ?? null,
      jerseyNumber: p.jersey_number ?? null,
      positionGroup: p.position_group ?? null,
      status: p.status ?? "active",
      notes: p.notes ?? null,
      imageUrl: p.image_url ?? null,
      email: p.email ?? null,
      inviteCode: p.invite_code ?? null,
      inviteStatus: (p.invite_status ?? "not_invited") as "not_invited" | "invited" | "joined",
      claimedAt: p.claimed_at ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[PATCH /api/roster/[playerId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
