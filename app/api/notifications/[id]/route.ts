import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership } from "@/lib/auth/rbac"
import { markNotificationAsRead } from "@/lib/utils/notifications"
import { revalidateAppBootstrapCache } from "@/lib/app/app-bootstrap-cache"

/**
 * PATCH /api/notifications/[id]
 * Mark a notification as read
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    const supabase = getSupabaseServer()
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("id, user_id, team_id")
      .eq("id", id)
      .single()

    if (fetchError || !notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    if (notification.user_id !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const membership = await getUserMembership(notification.team_id)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    await markNotificationAsRead(id)
    revalidateAppBootstrapCache()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Mark notification read error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/[id]
 * Delete a notification
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    const supabase = getSupabaseServer()
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("id, user_id")
      .eq("id", id)
      .single()

    if (fetchError || !notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    if (notification.user_id !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    await supabase.from("notifications").delete().eq("id", id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete notification error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
