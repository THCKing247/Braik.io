import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolvePlayerDocumentAccess, canSoftDeleteDocument } from "@/lib/player-documents/access"
import { removeStorageObject } from "@/lib/player-documents/storage"
import { writeDocumentAuditLog } from "@/lib/player-documents/audit"
import { logPlayerProfileActivity, PLAYER_PROFILE_ACTION_TYPES } from "@/lib/player-profile-activity"

function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]?.trim() ?? null
  return request.headers.get("x-real-ip")
}

/**
 * DELETE /api/player-documents/[documentId]?teamId=&playerId=
 * Soft-delete metadata; removes object from private storage when file_path is set.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { documentId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const playerId = searchParams.get("playerId")
    if (!documentId || !teamId || !playerId) {
      return NextResponse.json({ error: "documentId, teamId, and playerId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const access = await resolvePlayerDocumentAccess(supabase, session.user.id, playerId, teamId)
    if (!access?.canDelete) {
      return NextResponse.json({ error: "You cannot delete this document." }, { status: 403 })
    }

    const { data: player } = await supabase
      .from("players")
      .select("user_id")
      .eq("id", playerId)
      .maybeSingle()
    const playerOwnerUserId = (player as { user_id: string | null } | null)?.user_id ?? null

    const { data: doc, error: docErr } = await supabase
      .from("player_documents")
      .select("id, title, file_path, file_url, deleted_at, uploaded_by_profile_id, created_by")
      .eq("id", documentId)
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const row = doc as Record<string, unknown>
    if (row.deleted_at) {
      return NextResponse.json({ error: "Already deleted" }, { status: 410 })
    }

    const effectiveUploader =
      (row.uploaded_by_profile_id as string | null) ?? (row.created_by as string | null)
    if (
      !canSoftDeleteDocument(
        access,
        {
          uploaded_by_profile_id: effectiveUploader,
          player_id: playerId,
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
      .eq("id", documentId)

    if (upErr) {
      console.error("[DELETE player-documents]", upErr.message)
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
    }

    const path = row.file_path as string | null
    if (path) {
      await removeStorageObject(supabase, path).catch(() => undefined)
    }

    const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
    await writeDocumentAuditLog(supabase, {
      documentId,
      actorProfileId: session.user.id,
      actorRole: (prof as { role?: string } | null)?.role ?? null,
      action: "delete",
      accessMethod: "api",
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { team_id: teamId, player_id: playerId, had_storage_path: Boolean(path) },
    })

    await logPlayerProfileActivity({
      playerId,
      teamId,
      actorId: session.user.id,
      actionType: PLAYER_PROFILE_ACTION_TYPES.DOCUMENT_DELETED,
      targetType: "document",
      targetId: documentId,
      metadata: { title: (row.title as string) ?? "" },
    })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("[DELETE player-documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
