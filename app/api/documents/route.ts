import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { loadTeamDocumentsListForViewer } from "@/lib/documents/load-team-documents-list-for-viewer"
import { extractDocumentText, isExtractableMime } from "@/lib/documents/extract-text"
import {
  buildTeamDocumentStoragePath,
  sanitizeTeamDocumentFileName,
  uploadTeamDocumentToStorage,
  removeTeamDocumentFromStorage,
} from "@/lib/documents/team-documents-bucket"

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
    const documents = await loadTeamDocumentsListForViewer(supabase, teamId, session.user)
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

    const mimeRaw = file.type || ""
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    const extOk = ["pdf", "txt", "doc", "docx", "jpg", "jpeg", "png", "gif", "webp"].includes(ext)
    const mimeOk = !mimeRaw || ALLOWED_MIME.includes(mimeRaw)
    if (!mimeOk && !extOk) {
      return NextResponse.json(
        { error: "File type not supported. Use PDF, TXT, DOC/DOCX, or common images." },
        { status: 400 }
      )
    }

    const inferredFromExt: Record<string, string> = {
      pdf: "application/pdf",
      txt: "text/plain",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    }
    const mime = mimeRaw || inferredFromExt[ext] || ""

    const buffer = Buffer.from(await file.arrayBuffer())
    const supabase = getSupabaseServer()

    const { data: teamRow } = await supabase.from("teams").select("id, program_id").eq("id", teamId).maybeSingle()
    let programId: string | null = (teamRow as { program_id?: string } | null)?.program_id ?? null
    let orgId: string | null = null
    if (programId) {
      const { data: pr } = await supabase
        .from("programs")
        .select("organization_id")
        .eq("id", programId)
        .maybeSingle()
      orgId = (pr as { organization_id?: string } | null)?.organization_id ?? null
    }

    const docId = randomUUID()
    const safeName = sanitizeTeamDocumentFileName(file.name)
    const storagePath = buildTeamDocumentStoragePath({
      orgId,
      teamId,
      documentId: docId,
      safeFileName: safeName,
    })

    const contentType = mime || "application/octet-stream"
    const up = await uploadTeamDocumentToStorage(supabase, storagePath, buffer, contentType)
    if (up.error) {
      return NextResponse.json({ error: `Storage upload failed: ${up.error}` }, { status: 500 })
    }

    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        id: docId,
        team_id: teamId,
        title,
        file_name: file.name,
        file_url: null,
        file_path: storagePath,
        file_size: file.size,
        mime_type: mime || null,
        category,
        folder,
        visibility,
        created_by: session.user.id,
      })
      .select(
        "id, title, file_name, category, folder, visibility, scoped_unit, scoped_position_groups, assigned_player_ids, created_by, created_at, mime_type, public_share_token, file_path"
      )
      .single()

    if (insertErr || !doc) {
      await removeTeamDocumentFromStorage(supabase, storagePath).catch(() => undefined)
      console.error("[POST /api/documents] insert", insertErr?.message)
      return NextResponse.json({ error: "Failed to save document metadata after upload" }, { status: 500 })
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
      storageBacked: Boolean((doc as { file_path?: string | null }).file_path),
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
