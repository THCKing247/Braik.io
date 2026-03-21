import { NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { ROLES, type Role } from "@/lib/auth/roles"
import { teamDocumentVisibleToMember } from "@/lib/documents/document-visibility"
import { getUploadRoot } from "@/lib/upload-path"
import { extractDocumentText, isExtractableMime } from "@/lib/documents/extract-text"

const ALLOWED_MIME = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]
const MAX_SIZE = 15 * 1024 * 1024 // 15MB

/**
 * GET /api/documents?teamId=xxx
 * Returns documents for the team. Shape matches DocumentsManager.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const { membership } = await requireTeamAccess(teamId)
    const viewerRole = membership.role as Role

    let viewerPlayerRowIds: string[] = []
    if (viewerRole === ROLES.PLAYER) {
      const { data: playerRows } = await supabase
        .from("players")
        .select("id")
        .eq("team_id", teamId)
        .eq("user_id", session.user.id)
      viewerPlayerRowIds = (playerRows ?? []).map((p) => p.id as string)
    }

    const { data: rows, error } = await supabase
      .from("documents")
      .select(
        "id, title, file_name, category, folder, visibility, scoped_unit, scoped_position_groups, assigned_player_ids, created_by, created_at, mime_type, public_share_token"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[GET /api/documents]", error.message, error)
      return NextResponse.json({ error: "Failed to load documents" }, { status: 500 })
    }

    const creatorIds = [...new Set((rows ?? []).map((r) => r.created_by))]
    let creatorMap = new Map<string, { name: string | null; email: string }>()
    if (creatorIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, name, email").in("id", creatorIds)
      creatorMap = new Map((users ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }]))
    }

    const docIds = (rows ?? []).map((r) => r.id)
    let acksMap = new Map<string, Array<{ id: string }>>()
    if (docIds.length > 0) {
      const { data: acks } = await supabase
        .from("document_acknowledgements")
        .select("id, document_id")
        .in("document_id", docIds)
      acks?.forEach((a) => {
        const list = acksMap.get(a.document_id) ?? []
        list.push({ id: a.id })
        acksMap.set(a.document_id, list)
      })
    }

    let sharesByDoc = new Map<string, Array<{ id: string; name: string | null; email: string }>>()
    if (docIds.length > 0) {
      const { data: shareRows } = await supabase
        .from("document_shares")
        .select("document_id, shared_with_user_id")
        .in("document_id", docIds)

      const shareUserIds = [...new Set((shareRows ?? []).map((s) => s.shared_with_user_id))]
      let shareUsersMap = new Map<string, { name: string | null; email: string }>()
      if (shareUserIds.length > 0) {
        const { data: urows } = await supabase.from("users").select("id, name, email").in("id", shareUserIds)
        shareUsersMap = new Map((urows ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }]))
      }
      shareRows?.forEach((s) => {
        const u = shareUsersMap.get(s.shared_with_user_id)
        const entry = { id: s.shared_with_user_id, name: u?.name ?? null, email: u?.email ?? "" }
        const list = sharesByDoc.get(s.document_id) ?? []
        list.push(entry)
        sharesByDoc.set(s.document_id, list)
      })
    }

    const rawList = rows ?? []
    const visibleRows = rawList.filter((d) => {
      const shared = (sharesByDoc.get(d.id) ?? []).some((s) => s.id === session.user.id)
      if (shared) return true
      return teamDocumentVisibleToMember({
        visibility: d.visibility as string,
        assignedPlayerIds: d.assigned_player_ids,
        viewerRole,
        viewerPlayerRowIds,
      })
    })

    const documents = visibleRows.map((d) => {
      const creator = creatorMap.get(d.created_by)
      return {
        id: d.id,
        title: d.title ?? "",
        fileName: d.file_name ?? "",
        category: d.category ?? "other",
        folder: d.folder ?? null,
        visibility: d.visibility ?? "all",
        scopedUnit: d.scoped_unit ?? null,
        scopedPositionGroups: d.scoped_position_groups ?? null,
        assignedPlayerIds: d.assigned_player_ids ?? null,
        createdAt: d.created_at,
        mimeType: d.mime_type ?? null,
        publicShareToken: d.public_share_token ?? null,
        sharedWith: sharesByDoc.get(d.id) ?? [],
        creator: creator ? { name: creator.name, email: creator.email } : { name: null, email: "" },
        acknowledgements: acksMap.get(d.id) ?? [],
      }
    })

    return NextResponse.json(documents)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/documents — FormData: file, teamId, title, category, visibility, folder (optional)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const teamId = (formData.get("teamId") as string)?.trim()
    const titleRaw = (formData.get("title") as string)?.trim()
    const category = ((formData.get("category") as string) || "other").trim() || "other"
    const visibility = ((formData.get("visibility") as string) || "all").trim() || "all"
    const folderField = formData.get("folder")
    const folder =
      typeof folderField === "string" && folderField.trim() ? folderField.trim() : null

    if (!file || !teamId) {
      return NextResponse.json({ error: "file and teamId are required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)

    const title =
      titleRaw ||
      file.name.replace(/\.[^/.]+$/, "") ||
      file.name ||
      "Document"

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 15MB limit" }, { status: 400 })
    }

    const mime = file.type || ""
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    const extOk = ["pdf", "txt", "doc", "docx", "jpg", "jpeg", "png", "gif", "webp"].includes(ext)
    const mimeOk = !mime || ALLOWED_MIME.includes(mime)
    if (!mimeOk && !extOk) {
      return NextResponse.json(
        { error: "File type not supported. Use PDF, TXT, DOC/DOCX, or common images." },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const secureName = `${timestamp}-${random}-${sanitized}`

    const uploadsDir = join(getUploadRoot(), "uploads", "team-documents")
    await mkdir(uploadsDir, { recursive: true })
    const filePath = join(uploadsDir, secureName)
    await writeFile(filePath, buffer)
    const fileUrl = `/api/uploads/team-documents/${secureName}`

    const supabase = getSupabaseServer()
    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        team_id: teamId,
        title,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: mime || null,
        category,
        folder,
        visibility,
        created_by: session.user.id,
      })
      .select(
        "id, title, file_name, category, folder, visibility, scoped_unit, scoped_position_groups, assigned_player_ids, created_by, created_at, mime_type, public_share_token"
      )
      .single()

    if (insertErr || !doc) {
      console.error("[POST /api/documents] insert", insertErr?.message)
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 })
    }

    if (isExtractableMime(mime)) {
      const result = await extractDocumentText(buffer, mime, file.name)
      if ("text" in result && result.text) {
        await supabase.from("documents").update({ extracted_text: result.text }).eq("id", doc.id)
      }
    }

    const { data: creatorRow } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", doc.created_by)
      .maybeSingle()

    const newDocument = {
      id: doc.id,
      title: doc.title ?? "",
      fileName: doc.file_name ?? "",
      category: doc.category ?? "other",
      folder: doc.folder ?? null,
      visibility: doc.visibility ?? "all",
      scopedUnit: doc.scoped_unit ?? null,
      scopedPositionGroups: doc.scoped_position_groups ?? null,
      assignedPlayerIds: doc.assigned_player_ids ?? null,
      createdAt: doc.created_at,
      mimeType: doc.mime_type ?? null,
      publicShareToken: doc.public_share_token ?? null,
      sharedWith: [] as Array<{ id: string; name: string | null; email: string }>,
      creator: creatorRow
        ? { name: creatorRow.name ?? null, email: creatorRow.email ?? "" }
        : { name: null, email: "" },
      acknowledgements: [] as Array<{ id: string }>,
    }

    return NextResponse.json(newDocument)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[POST /api/documents]", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
