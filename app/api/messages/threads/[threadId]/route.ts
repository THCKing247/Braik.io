import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembershipForUserId, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { canAdminDeleteMessages } from "@/lib/auth/roles"
import { isAdminUserRole } from "@/lib/auth/user-roles"
import { MODERATED_MESSAGE_PLACEHOLDER } from "@/lib/messaging/moderation-copy"
import { repairThreadParticipantsFromThreadAndMessages } from "@/lib/messaging/thread-participants"

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
    const userId = session.user.id

    const [threadRes, selfParticipantRes] = await Promise.all([
      supabase
        .from("message_threads")
        .select("id, team_id, title, thread_type, created_by, created_at, updated_at")
        .eq("id", threadId)
        .maybeSingle(),
      supabase
        .from("message_thread_participants")
        .select("user_id")
        .eq("thread_id", threadId)
        .eq("user_id", userId)
        .maybeSingle(),
    ])

    const { data: thread, error: threadError } = threadRes
    if (threadError || !thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    if (!selfParticipantRes.data) {
      try {
        await requireTeamAccessWithUser(thread.team_id, session.user)
      } catch {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
      const repair = await repairThreadParticipantsFromThreadAndMessages(
        supabase,
        threadId,
        [userId],
        "getThread:repairMissingParticipants"
      )
      if (repair.error) {
        console.error("[GET /api/messages/threads/[threadId]] participant repair", {
          threadId,
          userId,
          message: repair.error.message,
        })
        return NextResponse.json({ error: "Failed to load thread" }, { status: 500 })
      }
      console.info("[GET /api/messages/threads/[threadId]] repaired participants", {
        threadId,
        userId,
        upsertedUserIds: repair.userIds,
      })
    }

    const [partsRes, msgsRes, mem] = await Promise.all([
      supabase
        .from("message_thread_participants")
        .select("user_id, joined_at, last_read_at")
        .eq("thread_id", threadId),
      supabase
        .from("messages")
        .select("id, sender_id, content, created_at, updated_at, deleted_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true }),
      getUserMembershipForUserId(thread.team_id, userId),
    ])

    const { data: participants, error: partsError } = partsRes
    if (partsError) {
      console.error("[GET /api/messages/threads/[threadId]] participants", partsError)
      return NextResponse.json({ error: "Failed to load thread" }, { status: 500 })
    }

    const { data: messages, error: messagesError } = msgsRes
    if (messagesError) {
      console.error("[GET /api/messages/threads/[threadId]] messages", messagesError)
      return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
    }

    const participantUserIds = (participants ?? []).map((p) => p.user_id)
    const senderIds = [...new Set((messages ?? []).map((m) => m.sender_id))]
    const userIdSet = new Set<string>([thread.created_by, ...participantUserIds, ...senderIds])
    const allUserIds = [...userIdSet].filter(Boolean)

    const { data: userRows } =
      allUserIds.length > 0
        ? await supabase.from("users").select("id, name, email").in("id", allUserIds)
        : { data: [] as { id: string; name: string | null; email: string }[] }

    const userMap = new Map((userRows ?? []).map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }]))

    const creator = userMap.get(thread.created_by)
    const messageIds = (messages ?? []).map((m) => m.id)
    const { data: attachments } =
      messageIds.length > 0
        ? await supabase
            .from("message_attachments")
            .select("id, message_id, file_name, file_url, file_size, mime_type")
            .in("message_id", messageIds)
        : { data: [] as { id: string; message_id: string; file_name: string; file_url: string; file_size: number; mime_type: string }[] }

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

    const canModerate =
      isAdminUserRole(session.user?.role) ||
      (mem ? canAdminDeleteMessages(mem.role) : false)

    const formattedMessages = (messages ?? []).map((m) => {
      const sender = userMap.get(m.sender_id) || { id: m.sender_id, name: null, email: "" }
      const removed = !!(m as { deleted_at?: string | null }).deleted_at
      return {
        id: m.id,
        body: removed ? MODERATED_MESSAGE_PLACEHOLDER : m.content,
        attachments: removed ? [] : attachmentsByMessage.get(m.id) || [],
        createdAt: m.created_at,
        creator: sender,
        isRemoved: removed,
      }
    })

    const formattedParticipants = (participants ?? [])
      .map((p) => {
        const user = userMap.get(p.user_id)
        return user
          ? {
              id: `${threadId}-${p.user_id}`,
              userId: p.user_id,
              user,
              readOnly: false,
            }
          : null
      })
      .filter(Boolean)

    return NextResponse.json({
      id: thread.id,
      subject: thread.title,
      threadType: thread.thread_type.toUpperCase(),
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      creator: creator
        ? { id: creator.id, name: creator.name, email: creator.email }
        : { id: thread.created_by, name: null, email: "" },
      participants: formattedParticipants,
      messages: formattedMessages,
      _count: { messages: formattedMessages.length },
      isReadOnly: false,
      canReply: true,
      canModerate,
    })
  } catch (error: unknown) {
    console.error("[GET /api/messages/threads/[threadId]]", error)
    const msg = error instanceof Error ? error.message : ""
    return NextResponse.json(
      { error: msg || "Failed to load thread" },
      { status: msg.includes("Access denied") ? 403 : 500 }
    )
  }
}
