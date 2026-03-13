import { NextResponse } from "next/server"
import { unlink } from "fs/promises"
import { join } from "path"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { logPlayerProfileActivity, PLAYER_PROFILE_ACTION_TYPES } from "@/lib/player-profile-activity"

/**
 * PATCH /api/roster/[playerId]/documents/[docId]
 * Update document (e.g. visibleToPlayer). Coach only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playerId: string; docId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId, docId } = await params
    if (!playerId || !docId) {
      return NextResponse.json({ error: "playerId and docId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const teamId = (player as { team_id: string }).team_id
    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can update documents." }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as { visibleToPlayer?: boolean }
    const updates: { visible_to_player?: boolean } = {}
    if (typeof body.visibleToPlayer === "boolean") updates.visible_to_player = body.visibleToPlayer

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data: doc, error: updateErr } = await supabase
      .from("player_documents")
      .update(updates)
      .eq("id", docId)
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .select()
      .single()

    if (updateErr || !doc) {
      return NextResponse.json({ error: "Document not found or update failed" }, { status: 404 })
    }

    return NextResponse.json({
      id: doc.id,
      visibleToPlayer: (doc as { visible_to_player?: boolean }).visible_to_player !== false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[PATCH /api/roster/.../documents/...]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/roster/[playerId]/documents/[docId]
 * Delete a player document. Coach only.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ playerId: string; docId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId, docId } = await params
    if (!playerId || !docId) {
      return NextResponse.json({ error: "playerId and docId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const teamId = (player as { team_id: string }).team_id
    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can delete documents." }, { status: 403 })
    }

    const { data: doc, error: docErr } = await supabase
      .from("player_documents")
      .select("id, file_url, title")
      .eq("id", docId)
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    await logPlayerProfileActivity({
      playerId,
      teamId,
      actorId: session.user.id,
      actionType: PLAYER_PROFILE_ACTION_TYPES.DOCUMENT_DELETED,
      targetType: "document",
      targetId: docId,
      metadata: { title: (doc as { title?: string }).title ?? "" },
    })

    const fileUrl = (doc as { file_url?: string }).file_url
    if (fileUrl?.startsWith("/api/uploads/player-documents/")) {
      const fileName = fileUrl.replace("/api/uploads/player-documents/", "")
      const filePath = join(process.cwd(), "uploads", "player-documents", fileName)
      try {
        await unlink(filePath)
      } catch {
        // ignore if already missing
      }
    }

    const { error: deleteErr } = await supabase
      .from("player_documents")
      .delete()
      .eq("id", docId)

    if (deleteErr) {
      console.error("[DELETE /api/roster/.../documents/...]", deleteErr.message)
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[DELETE /api/roster/.../documents/...]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
