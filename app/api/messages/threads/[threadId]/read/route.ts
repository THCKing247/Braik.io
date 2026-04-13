import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUnreadNotificationCount } from "@/lib/utils/notifications"

/**
 * POST /api/messages/threads/[threadId]/read
 * Marks a thread as read by updating last_read_at for the current user (per-participant),
 * and marks matching in-app notifications for this thread as read so the shell badge updates.
 *
 * Unread counts for threads (RPC `message_threads_inbox_stats`) only include messages from
 * others (`sender_id <> viewer`); `last_read_at` is per user in `message_thread_participants`.
 */
export async function POST(
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

    const { data: thread } = await supabase
      .from("message_threads")
      .select("team_id")
      .eq("id", threadId)
      .maybeSingle()

    if (!thread?.team_id) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    // Verify user is a participant
    const { data: participant } = await supabase
      .from("message_thread_participants")
      .select("user_id")
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json({ error: "Not a participant in this thread" }, { status: 403 })
    }

    const { data: lastMessage } = await supabase
      .from("messages")
      .select("created_at")
      .eq("thread_id", threadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const readAt = lastMessage?.created_at ?? new Date().toISOString()

    const { error: updateError } = await supabase
      .from("message_thread_participants")
      .update({ last_read_at: readAt })
      .eq("thread_id", threadId)
      .eq("user_id", userId)

    if (updateError) {
      console.error("[POST /api/messages/threads/[threadId]/read]", updateError)
      return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
    }

    const readTimestamp = new Date().toISOString()
    const { data: markedRows, error: notifError } = await supabase
      .from("notifications")
      .update({ read: true, read_at: readTimestamp })
      .eq("user_id", userId)
      .eq("team_id", thread.team_id)
      .eq("read", false)
      .eq("link_type", "message_thread")
      .eq("link_id", threadId)
      .select("id")

    if (notifError) {
      console.error("[POST /api/messages/threads/[threadId]/read] notifications", notifError)
    }

    const markedNotificationCount = markedRows?.length ?? 0
    const unreadNotifications = await getUnreadNotificationCount(userId, thread.team_id)

    return NextResponse.json({
      success: true,
      markedNotificationCount,
      unreadNotifications,
    })
  } catch (error: unknown) {
    console.error("[POST /api/messages/threads/[threadId]/read]", error)
    const msg = error instanceof Error ? error.message : "Failed to mark as read"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
