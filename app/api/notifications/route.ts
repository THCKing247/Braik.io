import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership } from "@/lib/auth/rbac"
import { getUnreadNotificationCount } from "@/lib/utils/notifications"

/**
 * GET /api/notifications
 * Get notifications for the current user in a team
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    // Verify user has access to this team
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    let q = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)
    if (unreadOnly) {
      q = q.eq("read", false)
    }
    const { data: rows } = await q
    const notifications = (rows ?? []).map((n) => ({
      id: n.id,
      userId: n.user_id,
      teamId: n.team_id,
      type: n.type,
      title: n.title,
      body: n.body,
      linkUrl: n.link_url,
      linkType: n.link_type,
      linkId: n.link_id,
      metadata: n.metadata,
      read: n.read,
      readAt: n.read_at,
      createdAt: n.created_at,
    }))

    // Get unread count
    const unreadCount = await getUnreadNotificationCount(session.user.id, teamId)

    return NextResponse.json({
      notifications,
      unreadCount,
      hasMore: notifications.length === limit,
    })
  } catch (error: any) {
    console.error("Get notifications error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
