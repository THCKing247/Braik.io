import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { loadMessageThreadsInboxPayload } from "@/lib/messaging/load-message-threads-inbox"

/**
 * GET /api/messages/threads?teamId=xxx
 * Returns threads for the team that the current user is a participant in.
 * Uses DB-side aggregates for counts/unread and latest message (no full message-table scan in Node).
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

    return NextResponse.json({
      threads: payload.threads,
      meta: payload.meta,
    })
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
