import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

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

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    // Validate file type and size (per ATTACHMENTS_IMPLEMENTATION.md)
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
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

    // Generate secure file name
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const secureFileName = `${timestamp}-${random}-${sanitizedName}`
    const fileUrl = `./uploads/messages/${secureFileName}`

    // TODO: Upload to Supabase Storage or file system
    // For now, store metadata only (actual file upload would go to Storage bucket)
    // In production, use: await supabase.storage.from('message-attachments').upload(secureFileName, file)

    // Create attachment record (message_id will be set when message is sent)
    const { data: attachment, error: attachmentError } = await supabase
      .from("message_attachments")
      .insert({
        message_id: "00000000-0000-0000-0000-000000000000", // Placeholder, will be updated when message is sent
        thread_id: threadId || "00000000-0000-0000-0000-000000000000", // Placeholder
        team_id: teamId,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: session.user.id,
      })
      .select("id, file_name, file_url, file_size, mime_type")
      .single()

    if (attachmentError || !attachment) {
      console.error("[POST /api/messages/attachments]", attachmentError)
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
