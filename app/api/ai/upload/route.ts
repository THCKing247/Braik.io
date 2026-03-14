import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUploadRoot } from "@/lib/upload-path"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { extractDocumentText, isExtractableMime } from "@/lib/documents/extract-text"

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

      const uploadsDir = join(getUploadRoot(), "uploads", "player-documents")
      await mkdir(uploadsDir, { recursive: true })
      const filePath = join(uploadsDir, secureName)
      await writeFile(filePath, buffer)
      const fileUrl = `/api/uploads/player-documents/${secureName}`

      const { data: doc, error: insertErr } = await supabase
        .from("player_documents")
        .insert({
          player_id: playerId,
          team_id: teamId,
          title: file.name,
          file_name: file.name,
          file_url: fileUrl,
          file_size: file.size,
          mime_type: mime || null,
          category: "other",
          created_by: session.user.id,
          visible_to_player: false,
        })
        .select("id")
        .single()

      if (insertErr) {
        console.error("[POST /api/ai/upload] player_documents insert", insertErr.message)
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
