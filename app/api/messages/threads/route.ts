import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { loadMessageThreadsInboxPayload } from "@/lib/messaging/load-message-threads-inbox"
import { mapLegacyFormattedThreadsToWire } from "@/lib/messaging/thread-list-wire"

/**
 * GET /api/messages/threads?teamId=xxx
 * Returns a **wire** thread list (threadId, lastMessage preview, participants, unread, updatedAt) —
 * no full message history. Maps server-side from the same inbox loader used by bootstrap (legacy shape).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const limitRaw = Number.parseInt(searchParams.get("limit") || "50", 10)
    const offsetRaw = Number.parseInt(searchParams.get("offset") || "0", 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServer()
    const { user } = await requireTeamAccessWithUser(teamId, session.user)
    const payload = await loadMessageThreadsInboxPayload(supabase, teamId, user.id, { limit, offset })
    const threadsWire = mapLegacyFormattedThreadsToWire(payload.threads)

    const res = NextResponse.json({
      threads: threadsWire,
      meta: payload.meta,
    })
    /** Shared edge hint: short TTL; authenticated payload — use private, not public CDN cache. */
    res.headers.set(
      "Cache-Control",
      "private, s-maxage=10, stale-while-revalidate=60"
    )
    return res
  } catch (error: unknown) {
    console.error("[GET /api/messages/threads]", error)
    const msg = error instanceof Error ? error.message : "Failed to load threads"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Access denied") || msg.includes("Not a member") ? 403 : 500 }
    )
  }
}
