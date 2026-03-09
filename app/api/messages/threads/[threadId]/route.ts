import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/messages/threads/[threadId]
 * Returns thread details with messages and participants.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { threadId } = await params
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Get thread
    const { data: thread, error: threadError } = await supabase
      .from("message_threads")
      .select("id, team_id, title, thread_type, created_by, created_at, updated_at")
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

    // Get creator
    const { data: creator } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", thread.created_by)
      .maybeSingle()

    // Get participants
    const { data: participants } = await supabase
      .from("message_thread_participants")
      .select("user_id, joined_at, last_read_at")
      .eq("thread_id", threadId)

    const participantUserIds = (participants ?? []).map((p) => p.user_id)
    const { data: participantUsers } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", participantUserIds)

    const participantUserMap = new Map((participantUsers ?? []).map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }]))

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at, updated_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })

    if (messagesError) {
      console.error("[GET /api/messages/threads/[threadId]] messages", messagesError)
      return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
    }

    // Get message senders
    const senderIds = [...new Set((messages ?? []).map((m) => m.sender_id))]
    const { data: senders } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", senderIds)

    const senderMap = new Map((senders ?? []).map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }]))

    // Get attachments for messages
    const messageIds = (messages ?? []).map((m) => m.id)
    const { data: attachments } = await supabase
      .from("message_attachments")
      .select("id, message_id, file_name, file_url, file_size, mime_type")
      .in("message_id", messageIds)

    const attachmentsByMessage = new Map<string, Array<{ id: string; fileName: string; fileUrl: string; fileSize: number; mimeType: string }>>()
    ;(attachments ?? []).forEach((att) => {
      const existing = attachmentsByMessage.get(att.message_id) || []
      attachmentsByMessage.set(att.message_id, [
        ...existing,
        {
          id: att.id,
          fileName: att.file_name,
          fileUrl: att.file_url,
          fileSize: att.file_size,
          mimeType: att.mime_type,
        },
      ])
    })

    // Format response
    const formattedMessages = (messages ?? []).map((m) => {
      const sender = senderMap.get(m.sender_id) || { id: m.sender_id, name: null, email: "" }
      return {
        id: m.id,
        body: m.content,
        attachments: attachmentsByMessage.get(m.id) || [],
        createdAt: m.created_at,
        creator: sender,
      }
    })

    const formattedParticipants = (participants ?? []).map((p) => {
      const user = participantUserMap.get(p.user_id)
      return user
        ? {
            id: `${threadId}-${p.user_id}`,
            userId: p.user_id,
            user,
            readOnly: false,
          }
        : null
    }).filter(Boolean)

    return NextResponse.json({
      id: thread.id,
      subject: thread.title,
      threadType: thread.thread_type.toUpperCase(),
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : { id: thread.created_by, name: null, email: "" },
      participants: formattedParticipants,
      messages: formattedMessages,
      _count: { messages: formattedMessages.length },
      isReadOnly: false,
      canReply: true,
    })
  } catch (error: any) {
    console.error("[GET /api/messages/threads/[threadId]]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load thread" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
