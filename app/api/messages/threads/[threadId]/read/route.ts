import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"

const LOG = "[POST /api/messages/threads/[threadId]/read]"

/**
 * POST /api/messages/threads/[threadId]/read
 *
 * 1) UPDATE message_thread_participants SET last_read_at = now() WHERE thread_id AND user_id
 * 2) If 0 rows updated: INSERT (thread_id, user_id, joined_at, last_read_at) for team members, then UPDATE again on duplicate key
 * 3) Mark matching notifications read (shell badge)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const tPost = performance.now()
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

    const readAt = new Date().toISOString()

    let rowsUpdated = 0
    let lastReadAt = readAt

    const { data: updatedRows, error: updateError } = await supabase
      .from("message_thread_participants")
      .update({ last_read_at: readAt })
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .select("last_read_at")

    if (updateError) {
      console.error(`${LOG} update failed`, {
        threadId,
        userId,
        code: updateError.code,
        message: updateError.message,
      })
      return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
    }

    if (updatedRows && updatedRows.length > 0) {
      rowsUpdated = updatedRows.length
      lastReadAt =
        (updatedRows[0] as { last_read_at?: string }).last_read_at ?? readAt
    } else {
      try {
        await requireTeamAccessWithUser(thread.team_id, session.user)
      } catch {
        console.warn(`${LOG} no row + not team member`, { threadId, userId })
        return NextResponse.json({ error: "Not a participant in this thread" }, { status: 403 })
      }

      const { error: insertError } = await supabase.from("message_thread_participants").insert({
        thread_id: threadId,
        user_id: userId,
        joined_at: readAt,
        last_read_at: readAt,
      })

      if (insertError) {
        if (insertError.code === "23505") {
          const retry = await supabase
            .from("message_thread_participants")
            .update({ last_read_at: readAt })
            .eq("thread_id", threadId)
            .eq("user_id", userId)
            .select("last_read_at")

          if (retry.error) {
            console.error(`${LOG} retry update after duplicate`, {
              threadId,
              userId,
              message: retry.error.message,
            })
            return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
          }
          rowsUpdated = retry.data?.length ?? 0
          lastReadAt =
            (retry.data?.[0] as { last_read_at?: string } | undefined)?.last_read_at ?? readAt
          console.info(`${LOG} insert conflict, retry update ok`, {
            threadId,
            userId,
            rowsUpdated,
          })
        } else {
          console.error(`${LOG} insert failed`, {
            threadId,
            userId,
            code: insertError.code,
            message: insertError.message,
          })
          return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
        }
      } else {
        rowsUpdated = 1
        lastReadAt = readAt
        console.info(`${LOG} inserted participant + last_read_at`, { threadId, userId })
      }
    }

    const { data: participantRow } = await supabase
      .from("message_thread_participants")
      .select("joined_at, last_read_at")
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .maybeSingle()

    console.info(`${LOG} marked read`, {
      threadId,
      userId,
      rowsUpdated,
      lastReadAt,
      joinedAt: participantRow?.joined_at,
      at: new Date().toISOString(),
    })

    const readTimestamp = new Date().toISOString()
    const teamIdForNotifs = thread.team_id

    /**
     * Defer notification row updates — they are not needed to unblock thread UI and can add seconds on large tables.
     * Shell badge catches up via polling / other sync.
     */
    void (async () => {
      const t0 = performance.now()
      try {
        const { data: markedRows, error: notifError } = await supabase
          .from("notifications")
          .update({ read: true, read_at: readTimestamp })
          .eq("user_id", userId)
          .eq("team_id", teamIdForNotifs)
          .eq("read", false)
          .eq("link_type", "message_thread")
          .eq("link_id", threadId)
          .select("id")

        if (notifError) {
          console.error(`${LOG} notifications (async)`, { threadId, userId, message: notifError.message })
        } else {
          console.info(`${LOG} notifications (async) ok`, {
            threadId,
            userId,
            marked: markedRows?.length ?? 0,
            ms: Math.round(performance.now() - t0),
          })
        }
      } catch (e) {
        console.error(`${LOG} notifications (async) threw`, e)
      }
    })()

    console.info(`${LOG} timing`, {
      threadId,
      userId,
      ms: Math.round(performance.now() - tPost),
      rowsUpdated,
      notificationsDeferred: true,
    })

    /**
     * Fast response: skip per-request total recounts; notification count applied asynchronously above.
     */
    return NextResponse.json({
      success: true,
      lastReadAt,
      rowsUpdated,
      participant: participantRow
        ? {
            joinedAt: participantRow.joined_at,
            lastReadAt: participantRow.last_read_at,
          }
        : null,
      markedNotificationCount: 0,
    })
  } catch (error: unknown) {
    console.error(LOG, error)
    const msg = error instanceof Error ? error.message : "Failed to mark as read"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
