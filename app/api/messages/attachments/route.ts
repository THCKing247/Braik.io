import { NextResponse } from "next/server"
import sharp from "sharp"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

const STORAGE_BUCKET = "message-attachments"

/**
 * POST /api/messages/attachments
 * Uploads a file attachment for a message (before message is sent).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const teamId = formData.get("teamId") as string | null
    const threadId = formData.get("threadId") as string | null

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const { data: thread } = await supabase
      .from("message_threads")
      .select("id, team_id")
      .eq("id", threadId)
      .maybeSingle()

    if (!thread || thread.team_id !== teamId) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    const { data: participant } = await supabase
      .from("message_thread_participants")
      .select("user_id")
      .eq("thread_id", threadId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json({ error: "You are not a participant in this thread" }, { status: 403 })
    }

    // Validate file type and size (per ATTACHMENTS_IMPLEMENTATION.md)
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
    ]

    const maxSize = 100 * 1024 * 1024 // 100MB
    const maxVideoSize = 50 * 1024 * 1024 // 50MB
    const maxImageSize = 10 * 1024 * 1024 // 10MB
    const maxDocSize = 25 * 1024 * 1024 // 25MB

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
    }

    let sizeLimit = maxSize
    if (file.type.startsWith("video/")) {
      sizeLimit = maxVideoSize
    } else if (file.type.startsWith("image/")) {
      sizeLimit = maxImageSize
    } else if (file.type.includes("document") || file.type.includes("pdf") || file.type.includes("text")) {
      sizeLimit = maxDocSize
    }

    if (file.size > sizeLimit) {
      return NextResponse.json({ error: `File size exceeds limit (${sizeLimit / 1024 / 1024}MB)` }, { status: 400 })
    }

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")

    let fileBuffer = Buffer.from(await file.arrayBuffer())
    let uploadContentType = file.type || "application/octet-stream"
    let uploadFileName = sanitizedName
    let uploadSize = file.size

    // Raster photos → WebP for smaller storage (skip GIF to avoid breaking animation; WebP already optimal)
    const isRaster =
      file.type.startsWith("image/") &&
      file.type !== "image/gif" &&
      file.type !== "image/webp"
    if (isRaster) {
      try {
        const webpBuffer = await sharp(fileBuffer).webp({ quality: 85 }).toBuffer()
        fileBuffer = Buffer.from(webpBuffer)
        uploadContentType = "image/webp"
        uploadFileName = sanitizedName.replace(/\.[^.]+$/i, "") + ".webp"
        uploadSize = webpBuffer.length
      } catch (e) {
        console.error("[POST /api/messages/attachments] webp conversion failed, using original", e)
        // keep original buffer / metadata
      }
    }

    const secureFileName = `${timestamp}-${random}-${uploadFileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`
    const storagePath = `${teamId}/${threadId}/${secureFileName}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: uploadContentType,
        upsert: false,
      })

    if (uploadError) {
      console.error("[POST /api/messages/attachments] storage upload", uploadError)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    const displayFileName = isRaster && uploadContentType === "image/webp"
      ? file.name.replace(/\.[^.]+$/i, "") + ".webp"
      : file.name

    const { data: attachment, error: attachmentError } = await supabase
      .from("message_attachments")
      .insert({
        message_id: null,
        thread_id: threadId,
        team_id: teamId,
        file_name: displayFileName,
        file_url: storagePath,
        file_size: uploadSize,
        mime_type: uploadContentType,
        uploaded_by: session.user.id,
      })
      .select("id, file_name, file_url, file_size, mime_type")
      .single()

    if (attachmentError || !attachment) {
      console.error("[POST /api/messages/attachments]", attachmentError)
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {})
      return NextResponse.json({ error: "Failed to create attachment record" }, { status: 500 })
    }

    return NextResponse.json({
      id: attachment.id,
      fileName: attachment.file_name,
      fileUrl: attachment.file_url,
      fileSize: attachment.file_size,
      mimeType: attachment.mime_type,
    })
  } catch (error: any) {
    console.error("[POST /api/messages/attachments]", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload attachment" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
