import { NextResponse } from "next/server"
import { unlink } from "fs/promises"
import { existsSync } from "fs"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { ROLES, type Role, canManageTeam } from "@/lib/auth/roles"
import { teamDocumentVisibleToMember } from "@/lib/documents/document-visibility"
import { getTeamDocumentDiskPath, loadTeamDocumentContent } from "@/lib/documents/team-document-storage"
import { removeTeamDocumentFromStorage } from "@/lib/documents/team-documents-bucket"

async function assertDocumentReadAccess(
  supabase: ReturnType<typeof getSupabaseServer>,
  userId: string,
  doc: { id: string; team_id: string; visibility?: string | null; assigned_player_ids?: unknown }
) {
  const { data: shareHit } = await supabase
    .from("document_shares")
    .select("id")
    .eq("document_id", doc.id)
    .eq("shared_with_user_id", userId)
    .maybeSingle()
  if (shareHit) return

  try {
    const { membership } = await requireTeamAccess(doc.team_id)
    const viewerRole = membership.role as Role
    let viewerPlayerRowIds: string[] = []
    if (viewerRole === ROLES.PLAYER) {
      const { data: playerRows } = await supabase
        .from("players")
        .select("id")
        .eq("team_id", doc.team_id)
        .eq("user_id", userId)
      viewerPlayerRowIds = (playerRows ?? []).map((p) => p.id as string)
    }
    const ok = teamDocumentVisibleToMember({
      visibility: doc.visibility,
      assignedPlayerIds: doc.assigned_player_ids,
      viewerRole,
      viewerPlayerRowIds,
    })
    if (!ok) {
      throw new Error("Access denied: Document not visible for your role")
    }
    return
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes("Not a member")) throw err
  }
  throw new Error("Access denied: No permission to view this document")
}

/**
 * GET /api/documents/[documentId]
 * Authorized file response for team members or users explicitly shared the document.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { documentId } = await params
    if (!documentId) {
      return NextResponse.json({ error: "documentId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, team_id, file_url, file_path, file_name, mime_type, visibility, assigned_player_ids")
      .eq("id", documentId)
      .maybeSingle()

    if (error || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    await assertDocumentReadAccess(supabase, session.user.id, doc)

    const file = await loadTeamDocumentContent(supabase, doc)
    if (!file) {
      return NextResponse.json(
        { error: "File not found in storage. It may not have been migrated yet — re-upload if needed." },
        { status: 404 }
      )
    }

    const disposition = `inline; filename="${encodeURIComponent(doc.file_name || "document")}"`
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Access denied")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[GET /api/documents/[documentId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/documents/[documentId]
 * Head coach only (matches DocumentsManager UI).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { documentId } = await params
    if (!documentId) {
      return NextResponse.json({ error: "documentId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, team_id, file_url, file_path")
      .eq("id", documentId)
      .maybeSingle()

    if (error || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const { membership } = await requireTeamAccess(doc.team_id)
    if (!canManageTeam(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const row = doc as { file_path?: string | null; file_url?: string | null }
    if (row.file_path?.trim()) {
      await removeTeamDocumentFromStorage(supabase, row.file_path.trim()).catch((e) =>
        console.warn("[DELETE /api/documents/[documentId]] storage remove", e)
      )
    } else {
      const diskPath = getTeamDocumentDiskPath(row.file_url)
      if (diskPath && existsSync(diskPath)) {
        try {
          await unlink(diskPath)
        } catch (unlinkErr) {
          console.warn("[DELETE /api/documents/[documentId]] file unlink", unlinkErr)
        }
      }
    }

    const { error: delErr } = await supabase.from("documents").delete().eq("id", documentId)
    if (delErr) {
      console.error("[DELETE /api/documents/[documentId]]", delErr.message)
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[DELETE /api/documents/[documentId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
