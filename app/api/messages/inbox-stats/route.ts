import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { withApiDevLogging } from "@/lib/api/core/api-dev-log"

/**
 * GET /api/messages/inbox-stats?teamId=&threadIds=id1,id2,...
 * Team unread total + per-thread inbox stats (server RPC — not callable from browser).
 */
async function getHandler(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")?.trim()
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServer()
    const { user } = await requireTeamAccessWithUser(teamId, session.user)
    const userId = user.id

    const threadIdsRaw = searchParams.get("threadIds")?.trim()
    const threadIds = threadIdsRaw
      ? [...new Set(threadIdsRaw.split(",").map((s) => s.trim()).filter(Boolean))]
      : []

    const [totalResult, statsResult] = await Promise.all([
      supabase.rpc("messaging_unread_total_for_team_user", {
        p_user_id: userId,
        p_team_id: teamId,
      }),
      threadIds.length > 0
        ? supabase.rpc("message_threads_inbox_stats", {
            p_user_id: userId,
            p_thread_ids: threadIds,
          })
        : Promise.resolve({ data: [], error: null }),
    ])

    let totalUnread = Number(totalResult.data ?? 0)
    if (totalResult.error) {
      console.warn("[GET /api/messages/inbox-stats] messaging_unread_total_for_team_user", totalResult.error)
      totalUnread = 0
    }

    if (statsResult.error) {
      console.error("[GET /api/messages/inbox-stats] message_threads_inbox_stats", statsResult.error)
      return NextResponse.json({ error: "Failed to load inbox stats" }, { status: 500 })
    }

    const res = NextResponse.json({
      totalUnread,
      stats: statsResult.data ?? [],
    })
    res.headers.set("Cache-Control", "private, no-store")
    return res
  } catch (error: unknown) {
    console.error("[GET /api/messages/inbox-stats]", error)
    const msg = error instanceof Error ? error.message : "Failed to load inbox stats"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Access denied") || msg.includes("Not a member") ? 403 : 500 }
    )
  }
}

export const GET = withApiDevLogging("GET /api/messages/inbox-stats", getHandler)
