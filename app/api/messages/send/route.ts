import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * POST /api/messages/send
 * Sends a message to a thread.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      threadId?: string
      body?: string
      attachments?: Array<{ id?: string; fileName?: string; fileUrl?: string }>
    }

    const { threadId, body: messageBody, attachments = [] } = body

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 })
    }

    if (!messageBody || !messageBody.trim()) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Get thread to verify access
    const { data: thread, error: threadError } = await supabase
      .from("message_threads")
      .select("id, team_id")
      .eq("id", threadId)
      .maybeSingle()

    if (threadError || !thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    await requireTeamAccess(thread.team_id)

    // Verify user is a participant
    const { data: participant } = await supabase
      .from("message_thread_participants")
      .select("user_id")
      .eq("thread_id", threadId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Create message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_id: session.user.id,
        content: messageBody.trim(),
      })
      .select("id, sender_id, content, created_at, updated_at")
      .single()

    if (messageError || !message) {
      console.error("[POST /api/messages/send] message", messageError)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    // Link attachments if provided
    if (attachments.length > 0) {
      const attachmentUpdates = attachments.map((att) => ({
        message_id: message.id,
        thread_id: threadId,
        team_id: thread.team_id,
        uploaded_by: session.user.id,
      }))

      // Update existing attachments to link to this message
      const attachmentIds = attachments.filter((a) => a.id).map((a) => a.id!)
      if (attachmentIds.length > 0) {
        const { error: attachError } = await supabase
          .from("message_attachments")
          .update({ message_id: message.id })
          .in("id", attachmentIds)

        if (attachError) {
          console.error("[POST /api/messages/send] attachments", attachError)
          // Non-fatal - message is sent, attachments just not linked
        }
      }
    }

    // Get sender info
    const { data: sender } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", session.user.id)
      .maybeSingle()

    // Get message attachments
    const { data: messageAttachments } = await supabase
      .from("message_attachments")
      .select("id, file_name, file_url, file_size, mime_type")
      .eq("message_id", message.id)

    return NextResponse.json({
      id: message.id,
      body: message.content,
      attachments: (messageAttachments ?? []).map((att) => ({
        id: att.id,
        fileName: att.file_name,
        fileUrl: att.file_url,
        fileSize: att.file_size,
        mimeType: att.mime_type,
      })),
      createdAt: message.created_at,
      creator: sender ? { id: sender.id, name: sender.name, email: sender.email } : { id: session.user.id, name: null, email: "" },
    })
  } catch (error: any) {
    console.error("[POST /api/messages/send]", error)
    return NextResponse.json(
      { error: error.message || "Failed to send message" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
