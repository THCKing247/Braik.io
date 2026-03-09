import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/messages/attachments/serve?fileUrl=xxx
 * Serves an attachment by file URL (backward compatibility).
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileUrl = searchParams.get("fileUrl")
    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Find attachment by file_url
    const { data: attachment, error: attachmentError } = await supabase
      .from("message_attachments")
      .select("id, thread_id, team_id, file_name, file_url, file_size, mime_type")
      .eq("file_url", fileUrl)
      .maybeSingle()

    if (attachmentError || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    await requireTeamAccess(attachment.team_id)

    // Verify user is a participant in the thread
    const { data: participant } = await supabase
      .from("message_thread_participants")
      .select("user_id")
      .eq("thread_id", attachment.thread_id)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!participant) {
      // Check if user is admin
      const { data: user } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle()

      if (user?.role !== "admin") {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    // TODO: Serve file from Supabase Storage or file system
    // For now, return file info
    return NextResponse.json({
      id: attachment.id,
      fileName: attachment.file_name,
      fileUrl: attachment.file_url,
      fileSize: attachment.file_size,
      mimeType: attachment.mime_type,
    })
  } catch (error: any) {
    console.error("[GET /api/messages/attachments/serve]", error)
    return NextResponse.json(
      { error: error.message || "Failed to serve attachment" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
