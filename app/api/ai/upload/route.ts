import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUploadRoot } from "@/lib/upload-path"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { COACH_B_PLUS_UNAVAILABLE_USER_MESSAGE, isCoachBPlusEntitled } from "@/lib/braik-ai/coach-b-plus-entitlement"
import { extractDocumentText, isExtractableMime } from "@/lib/documents/extract-text"
import { PLAYER_DOCUMENT_CONSENT_TEXT } from "@/lib/player-documents/constants"
import {
  buildPlayerDocumentStoragePath,
  sanitizeFileName,
  uploadPlayerDocumentToStorage,
} from "@/lib/player-documents/storage"

const ALLOWED_MIME = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]
const MAX_SIZE = 15 * 1024 * 1024 // 15MB

/**
 * POST /api/ai/upload
 * Body: FormData with "file" and "teamId". Optional "playerId" to create a player document.
 * Extracts text from PDF, TXT, or DOCX; stores file and creates a document record with extracted_text.
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
    const playerId = (formData.get("playerId") as string)?.trim() || null

    if (!file || !teamId) {
      return NextResponse.json(
        { error: "file and teamId are required" },
        { status: 400 }
      )
    }

    await requireTeamAccess(teamId)

    const entitled = await isCoachBPlusEntitled(getSupabaseServer(), teamId, session.user.id, {
      isPlatformOwner: session.user.isPlatformOwner === true,
    })
    if (!entitled) {
      return NextResponse.json(
        { error: COACH_B_PLUS_UNAVAILABLE_USER_MESSAGE, code: "coach_b_plus_required" },
        { status: 403 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 15MB limit" },
        { status: 400 }
      )
    }

    const mime = file.type || ""
    if (!ALLOWED_MIME.includes(mime)) {
      return NextResponse.json(
        { error: "File type not supported. Use PDF, TXT, or DOCX." },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const secureName = `${timestamp}-${random}-${sanitized}`

    const supabase = getSupabaseServer()

    if (playerId) {
      const { data: player } = await supabase.from("players").select("id, team_id").eq("id", playerId).eq("team_id", teamId).maybeSingle()
      if (!player) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 })
      }

      const { data: team } = await supabase.from("teams").select("program_id").eq("id", teamId).maybeSingle()
      let programId: string | null = (team as { program_id?: string } | null)?.program_id ?? null
      let orgId: string | null = null
      if (programId) {
        const { data: pr } = await supabase.from("programs").select("organization_id").eq("id", programId).maybeSingle()
        orgId = (pr as { organization_id?: string } | null)?.organization_id ?? null
      }

      const docId = randomUUID()
      const safeName = sanitizeFileName(file.name)
      const storagePath = buildPlayerDocumentStoragePath({
        orgId,
        teamId,
        playerId,
        documentType: "other",
        documentId: docId,
        safeFileName: safeName,
      })
      const up = await uploadPlayerDocumentToStorage(supabase, storagePath, buffer, mime || "application/octet-stream")
      if (up.error) {
        return NextResponse.json({ error: up.error }, { status: 500 })
      }

      const uploadedAt = new Date().toISOString()
      const retentionDays = 365
      const expiresAt = new Date(new Date(uploadedAt).getTime() + retentionDays * 86400000).toISOString()
      const consentNote = `${PLAYER_DOCUMENT_CONSENT_TEXT} (File processed via Braik AI assistant by authorized staff.)`

      const { data: doc, error: insertErr } = await supabase
        .from("player_documents")
        .insert({
          id: docId,
          player_id: playerId,
          team_id: teamId,
          org_id: orgId,
          program_id: programId,
          title: file.name,
          file_name: file.name,
          file_path: storagePath,
          file_url: null,
          file_size: file.size,
          file_size_bytes: file.size,
          mime_type: mime || null,
          category: "other",
          document_type: "other",
          created_by: session.user.id,
          uploaded_by_profile_id: session.user.id,
          consent_acknowledged: true,
          consent_text: consentNote,
          retention_days: retentionDays,
          expires_at: expiresAt,
          uploaded_at: uploadedAt,
          status: "active",
          visible_to_player: false,
        })
        .select("id")
        .single()

      if (insertErr) {
        console.error("[POST /api/ai/upload] player_documents insert", insertErr.message)
        await supabase.storage.from("player-documents").remove([storagePath]).catch(() => undefined)
        return NextResponse.json({ error: "Failed to save document" }, { status: 500 })
      }

      let extractedText = ""
      if (isExtractableMime(mime)) {
        const result = await extractDocumentText(buffer, mime, file.name)
        if ("text" in result && result.text) {
          extractedText = result.text
          await supabase.from("player_documents").update({ extracted_text: result.text }).eq("id", doc.id)
        } else if ("error" in result) {
          extractedText = `(Extraction failed: ${result.error})`
        }
      }

      return NextResponse.json({
        extractedText: extractedText || "File saved. Text extraction not supported for this type.",
        documentId: doc.id,
      })
    }

    const uploadsDir = join(getUploadRoot(), "uploads", "team-documents")
    await mkdir(uploadsDir, { recursive: true })
    const filePath = join(uploadsDir, secureName)
    await writeFile(filePath, buffer)
    const fileUrl = `/api/uploads/team-documents/${secureName}`

    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        team_id: teamId,
        title: file.name,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: mime || null,
        category: "other",
        created_by: session.user.id,
      })
      .select("id")
      .single()

    if (insertErr) {
      console.error("[POST /api/ai/upload] documents insert", insertErr.message)
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 })
    }

    let extractedText = ""
    if (isExtractableMime(mime)) {
      const result = await extractDocumentText(buffer, mime, file.name)
      if ("text" in result && result.text) {
        extractedText = result.text
        await supabase.from("documents").update({ extracted_text: result.text }).eq("id", doc.id)
      } else if ("error" in result) {
        extractedText = `(Extraction failed: ${result.error})`
      }
    }

    return NextResponse.json({
      extractedText: extractedText || "File saved. Text extraction not supported for this type.",
      documentId: doc.id,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[POST /api/ai/upload]", err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
