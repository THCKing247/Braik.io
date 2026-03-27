import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getUserMembership } from "@/lib/auth/rbac"
import { markAllNotificationsAsRead } from "@/lib/utils/notifications"
import { revalidateAppBootstrapCache } from "@/lib/app/app-bootstrap-cache"
import { revalidateNotificationsForUserTeam } from "@/lib/cache/lightweight-get-cache"

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for the current user in a team
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await request.json()

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    // Verify user has access to this team
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    await markAllNotificationsAsRead(session.user.id, teamId)
    revalidateNotificationsForUserTeam(session.user.id, teamId)
    revalidateAppBootstrapCache()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Mark all notifications read error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
