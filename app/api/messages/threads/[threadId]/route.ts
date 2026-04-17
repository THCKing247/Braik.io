import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembershipForUserId, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { canAdminDeleteMessages } from "@/lib/auth/roles"
import { isAdminUserRole } from "@/lib/auth/user-roles"
import { MODERATED_MESSAGE_PLACEHOLDER } from "@/lib/messaging/moderation-copy"
import { repairThreadParticipantsFromThreadAndMessages } from "@/lib/messaging/thread-participants"
import { fetchMessagesPageForThread } from "@/lib/messaging/thread-detail-query"

const DEFAULT_MSG_LIMIT = 40
const MAX_MSG_LIMIT = 80

/** attachment query: metadata = no storage path in JSON (client loads via /attachments/[id]); full = include file_url; none = skip query */
type AttachmentsMode = "metadata" | "full" | "none"

/**
 * GET /api/messages/threads/[threadId]?limit=40&before=<messageId>&includeParticipants=0|1
 * Paginated messages (newest page first). `includeParticipants=0` skips the participants query (client may use sidebar cache).
 * Use `before` to load older pages (infinite scroll / "Load more").
 */
export async function GET(
  request: Request,
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

    const { searchParams } = new URL(request.url)
    const limitRaw = Number.parseInt(searchParams.get("limit") || String(DEFAULT_MSG_LIMIT), 10)
    const limit = Number.isFinite(limitRaw)
      ? Math.min(MAX_MSG_LIMIT, Math.max(1, limitRaw))
      : DEFAULT_MSG_LIMIT
    const beforeMessageId = searchParams.get("before")?.trim() || null
    const attachmentsParam = (searchParams.get("attachments") || "metadata").toLowerCase()
    const attachmentsMode: AttachmentsMode =
      attachmentsParam === "full" ? "full" : attachmentsParam === "none" ? "none" : "metadata"
    const includeParticipantsParam = searchParams.get("includeParticipants")
    const includeParticipants =
      includeParticipantsParam === null || includeParticipantsParam === ""
        ? true
        : !["0", "false", "no"].includes(includeParticipantsParam.toLowerCase())

    const tRoute = performance.now()
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

    const [partsRes, pageResult, mem] = await Promise.all([
      includeParticipants
        ? supabase
            .from("message_thread_participants")
            .select("user_id, joined_at, last_read_at")
            .eq("thread_id", threadId)
        : Promise.resolve({ data: [] as { user_id: string; joined_at: string; last_read_at: string | null }[], error: null }),
      fetchMessagesPageForThread(supabase, threadId, { limit, beforeMessageId }),
      getUserMembershipForUserId(thread.team_id, userId),
    ])

    const { data: participants, error: partsError } = partsRes
    if (partsError) {
      console.error("[GET /api/messages/threads/[threadId]] participants", partsError)
      return NextResponse.json({ error: "Failed to load thread" }, { status: 500 })
    }

    const messages = pageResult.messageRows

    const participantUserIds = includeParticipants ? (participants ?? []).map((p) => p.user_id) : []
    const senderIds = [...new Set(messages.map((m) => m.sender_id))]
    const userIdSet = new Set<string>([thread.created_by, ...participantUserIds, ...senderIds])
    const allUserIds = [...userIdSet].filter(Boolean)

    const { data: userRows } =
      allUserIds.length > 0
        ? await supabase.from("users").select("id, name, email").in("id", allUserIds)
        : { data: [] as { id: string; name: string | null; email: string }[] }

    const userMap = new Map((userRows ?? []).map((u) => [u.id, { id: u.id, name: u.name ?? null, email: u.email ?? "" }]))

    const creator = userMap.get(thread.created_by)
    const messageIds = messages.map((m) => m.id)
    const tAttachQuery = performance.now()
    type AttRow = {
      id: string
      message_id: string
      file_name: string
      file_url?: string
      file_size: number
      mime_type: string
    }
    const { data: attachments } =
      messageIds.length > 0 && attachmentsMode !== "none"
        ? await supabase
            .from("message_attachments")
            .select(
              attachmentsMode === "full"
                ? "id, message_id, file_name, file_url, file_size, mime_type"
                : "id, message_id, file_name, file_size, mime_type"
            )
            .in("message_id", messageIds)
        : { data: [] as AttRow[] }

    const attachmentsByMessage = new Map<
      string,
      Array<{ id: string; fileName: string; fileUrl?: string; fileSize: number; mimeType: string }>
    >()
    ;(attachments ?? []).forEach((att) => {
      const existing = attachmentsByMessage.get(att.message_id) || []
      const row = {
        id: att.id,
        fileName: att.file_name,
        fileSize: att.file_size,
        mimeType: att.mime_type,
        ...(attachmentsMode === "full" && att.file_url ? { fileUrl: att.file_url as string } : {}),
      }
      attachmentsByMessage.set(att.message_id, [...existing, row])
    })
    const attachMs = Math.round(performance.now() - tAttachQuery)

    const canModerate =
      isAdminUserRole(session.user?.role) || (mem ? canAdminDeleteMessages(mem.role) : false)

    const formattedMessages = messages.map((m) => {
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

    const formattedParticipants = includeParticipants
      ? (participants ?? [])
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
      : []

    const oldestId = formattedMessages.length > 0 ? formattedMessages[0].id : null
    const newestId = formattedMessages.length > 0 ? formattedMessages[formattedMessages.length - 1].id : null

    const totalMs = Math.round(performance.now() - tRoute)
    console.info("[GET /api/messages/threads/[threadId]] timing", {
      threadId,
      msTotal: totalMs,
      msAttachmentsQuery: messageIds.length > 0 && attachmentsMode !== "none" ? attachMs : 0,
      limit,
      before: Boolean(beforeMessageId),
      attachmentsMode,
      includeParticipants,
      messageCount: formattedMessages.length,
    })

    return NextResponse.json({
      id: thread.id,
      subject: thread.title,
      threadType: thread.thread_type.toUpperCase(),
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      creator: creator
        ? { id: creator.id, name: creator.name, email: creator.email }
        : { id: thread.created_by, name: null, email: "" },
      ...(includeParticipants ? { participants: formattedParticipants } : {}),
      messages: formattedMessages,
      _count: { messages: formattedMessages.length },
      isReadOnly: false,
      canReply: true,
      canModerate,
      pagination: {
        limit,
        hasMoreOlder: pageResult.hasMoreOlder,
        oldestMessageId: oldestId,
        newestMessageId: newestId,
        before: beforeMessageId,
      },
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
