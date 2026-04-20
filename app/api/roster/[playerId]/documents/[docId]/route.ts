import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { resolvePlayerDocumentAccess, canSoftDeleteDocument } from "@/lib/player-documents/access"
import { removeStorageObject } from "@/lib/player-documents/storage"
import { writeDocumentAuditLog } from "@/lib/player-documents/audit"
import { logPlayerProfileActivity, PLAYER_PROFILE_ACTION_TYPES } from "@/lib/player-profile-activity"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]?.trim() ?? null
  return request.headers.get("x-real-ip")
}

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

    const { playerId: segment, docId } = await params
    if (!segment || !docId) {
      return NextResponse.json({ error: "playerId and docId are required" }, { status: 400 })
    }

    const resolvedPlayerId = await resolveRosterApiPlayerUuid(null, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", resolvedPlayerId)
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
      .eq("player_id", resolvedPlayerId)
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
 * DELETE — soft-delete via same rules as /api/player-documents/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playerId: string; docId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId: segment, docId } = await params
    if (!segment || !docId) {
      return NextResponse.json({ error: "playerId and docId are required" }, { status: 400 })
    }

    const resolvedPlayerId = await resolveRosterApiPlayerUuid(null, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", resolvedPlayerId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const teamId = (player as { team_id: string }).team_id
    const access = await resolvePlayerDocumentAccess(supabase, session.user.id, resolvedPlayerId, teamId)
    if (!access?.canDelete) {
      return NextResponse.json({ error: "You cannot delete this document." }, { status: 403 })
    }

    const { data: doc, error: docErr } = await supabase
      .from("player_documents")
      .select("id, title, file_path, file_url, deleted_at, uploaded_by_profile_id, created_by")
      .eq("id", docId)
      .eq("player_id", resolvedPlayerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const row = doc as Record<string, unknown>
    if (row.deleted_at) {
      return NextResponse.json({ error: "Already deleted" }, { status: 410 })
    }

    const playerOwnerUserId = (player as { user_id: string | null }).user_id
    if (
      !canSoftDeleteDocument(
        access,
        {
          uploaded_by_profile_id: (row.uploaded_by_profile_id as string | null) ?? (row.created_by as string | null),
          player_id: resolvedPlayerId,
        },
        playerOwnerUserId
      )
    ) {
      return NextResponse.json({ error: "You cannot delete this document." }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { error: upErr } = await supabase
      .from("player_documents")
      .update({
        deleted_at: now,
        deleted_by_profile_id: session.user.id,
        status: "deleted",
        updated_at: now,
      })
      .eq("id", docId)

    if (upErr) {
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
    }

    const path = row.file_path as string | null
    if (path) {
      await removeStorageObject(supabase, path).catch(() => undefined)
    }

    const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
    await writeDocumentAuditLog(supabase, {
      documentId: docId,
      actorProfileId: session.user.id,
      actorRole: (prof as { role?: string } | null)?.role ?? null,
      action: "delete",
      accessMethod: "api",
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { team_id: teamId, player_id: resolvedPlayerId, route: "roster_documents" },
    })

    await logPlayerProfileActivity({
      playerId: resolvedPlayerId,
      teamId,
      actorId: session.user.id,
      actionType: PLAYER_PROFILE_ACTION_TYPES.DOCUMENT_DELETED,
      targetType: "document",
      targetId: docId,
      metadata: { title: (row.title as string) ?? "" },
    })

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
