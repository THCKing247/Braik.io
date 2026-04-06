import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

const STORAGE_BUCKET = "message-attachments"

/**
 * GET /api/messages/attachments/[attachmentId]
 * Serves an attachment file (with access control).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { attachmentId } = await params
    if (!attachmentId) {
      return NextResponse.json({ error: "attachmentId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: attachment, error: attachmentError } = await supabase
      .from("message_attachments")
      .select("id, thread_id, team_id, file_name, file_url, file_size, mime_type")
      .eq("id", attachmentId)
      .maybeSingle()

    if (attachmentError || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    await requireTeamAccess(attachment.team_id)

    const { data: participant } = await supabase
      .from("message_thread_participants")
      .select("user_id")
      .eq("thread_id", attachment.thread_id)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!participant) {
      const { data: user } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle()

      if (user?.role !== "admin") {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(attachment.file_url)

    if (dlErr || !fileBlob) {
      console.error("[GET /api/messages/attachments/[attachmentId]] storage download", dlErr)
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 })
    }

    const arrayBuffer = await fileBlob.arrayBuffer()
    const contentType = attachment.mime_type || "application/octet-stream"
    const safeName = attachment.file_name.replace(/[\r\n"]/g, "_")

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(arrayBuffer.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error: any) {
    console.error("[GET /api/messages/attachments/[attachmentId]]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load attachment" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
