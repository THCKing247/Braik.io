import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUnreadNotificationCount } from "@/lib/utils/notifications"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { ensureUserThreadParticipant } from "@/lib/messaging/thread-participants"

const LOG = "[POST /api/messages/threads/[threadId]/read]"

/**
 * POST /api/messages/threads/[threadId]/read
 * Ensures a participant row exists, sets last_read_at = now() for the current user,
 * marks matching in-app notifications read (shell badge), returns updated timestamps.
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

    const { data: thread, error: threadErr } = await supabase
      .from("message_threads")
      .select("team_id")
      .eq("id", threadId)
      .maybeSingle()

    if (threadErr || !thread?.team_id) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from("message_thread_participants")
      .select("user_id, last_read_at")
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .maybeSingle()

    if (!existing) {
      try {
        await requireTeamAccessWithUser(thread.team_id, session.user)
      } catch {
        console.warn(`${LOG} denied`, { threadId, userId, reason: "not_participant_not_team" })
        return NextResponse.json({ error: "Not a participant in this thread" }, { status: 403 })
      }
      const ensured = await ensureUserThreadParticipant(supabase, threadId, userId, "markRead:repairTeamMember")
      if (ensured.error) {
        console.error(`${LOG} ensure participant failed`, {
          threadId,
          userId,
          message: ensured.error.message,
        })
        return NextResponse.json({ error: "Failed to join thread" }, { status: 500 })
      }
      console.info(`${LOG} repaired missing participant row`, { threadId, userId })
    }

    const readAt = new Date().toISOString()

    const { data: updatedRows, error: updateError } = await supabase
      .from("message_thread_participants")
      .update({ last_read_at: readAt })
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .select("last_read_at")

    if (updateError) {
      console.error(`${LOG} last_read_at update`, {
        threadId,
        userId,
        code: updateError.code,
        message: updateError.message,
      })
      return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
    }

    const lastReadAt = (updatedRows?.[0] as { last_read_at?: string } | undefined)?.last_read_at ?? readAt

    console.info(`${LOG} marked read`, {
      threadId,
      userId,
      rowsUpdated: updatedRows?.length ?? 0,
      lastReadAt,
    })

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
      console.error(`${LOG} notifications`, { threadId, userId, message: notifError.message })
    }

    const markedNotificationCount = markedRows?.length ?? 0
    const unreadNotifications = await getUnreadNotificationCount(userId, thread.team_id)

    console.info(`${LOG} inbox_notifications`, {
      threadId,
      userId,
      markedNotificationCount,
      unreadNotifications,
    })

    return NextResponse.json({
      success: true,
      lastReadAt,
      markedNotificationCount,
      unreadNotifications,
    })
  } catch (error: unknown) {
    console.error(LOG, error)
    const msg = error instanceof Error ? error.message : "Failed to mark as read"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
