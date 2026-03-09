import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { MembershipLookupError } from "@/lib/auth/rbac"

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
      firstName?: string | null
      lastName?: string | null
      grade?: number | string | null
      jerseyNumber?: number | string | null
      positionGroup?: string | null
      notes?: string | null
      status?: string
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
    if (typeof body.firstName === "string") {
      updates.first_name = body.firstName.trim() || null
    }
    if (typeof body.lastName === "string") {
      updates.last_name = body.lastName.trim() || null
    }
    if (body.grade !== undefined) {
      const g = body.grade
      updates.grade = g == null || g === "" ? null : Number(g)
    }
    if (body.jerseyNumber !== undefined) {
      const j = body.jerseyNumber
      updates.jersey_number = j == null || j === "" ? null : Number(j)
    }
    if (body.positionGroup !== undefined) {
      updates.position_group = typeof body.positionGroup === "string" ? body.positionGroup.trim() || null : null
    }
    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === "string" ? body.notes.trim() || null : null
    }
    if (body.status === "active" || body.status === "inactive") {
      updates.status = body.status
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
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      console.error("[PATCH /api/roster/[playerId]] membership lookup failed (DB/schema)", err.message)
      return NextResponse.json({ error: "Failed to update player" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[PATCH /api/roster/[playerId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/roster/[playerId] - Remove a player from the roster.
 */
export async function DELETE(
  _request: Request,
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

    const { error: deleteErr } = await supabase.from("players").delete().eq("id", playerId)

    if (deleteErr) {
      console.error("[DELETE /api/roster/[playerId]]", deleteErr.message)
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      console.error("[DELETE /api/roster/[playerId]] membership lookup failed (DB/schema)", err.message)
      return NextResponse.json({ error: "Failed to delete player" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[DELETE /api/roster/[playerId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
