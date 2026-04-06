import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, MembershipLookupError } from "@/lib/auth/rbac"
import { canAdminDeleteMessages } from "@/lib/auth/roles"
import { isAdminUserRole } from "@/lib/auth/user-roles"
import { writeAuditLog } from "@/lib/audit/write-audit-log"

/**
 * POST /api/messages/moderate
 * Soft-delete a message (school admin for that team, or platform admin).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { messageId?: string; reason?: string }
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : ""
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null
    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: msg, error: msgErr } = await supabase
      .from("messages")
      .select("id, thread_id, deleted_at")
      .eq("id", messageId)
      .maybeSingle()

    if (msgErr || !msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }
    if ((msg as { deleted_at?: string | null }).deleted_at) {
      return NextResponse.json({ error: "Message already removed" }, { status: 409 })
    }

    const { data: thread, error: thErr } = await supabase
      .from("message_threads")
      .select("id, team_id")
      .eq("id", (msg as { thread_id: string }).thread_id)
      .maybeSingle()

    if (thErr || !thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const teamId = thread.team_id as string
    let membership
    try {
      membership = await getUserMembership(teamId)
    } catch (e) {
      if (e instanceof MembershipLookupError) {
        return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
      }
      throw e
    }

    const allowed =
      isAdminUserRole(session.user?.role) ||
      (membership ? canAdminDeleteMessages(membership.role) : false)
    if (!allowed) {
      return NextResponse.json({ error: "You do not have permission to moderate messages." }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { error: updErr } = await supabase
      .from("messages")
      .update({
        deleted_at: now,
        deleted_by: session.user.id,
        removal_reason: reason,
        updated_at: now,
        content: "[removed]",
      })
      .eq("id", messageId)

    if (updErr) {
      console.error("[POST /api/messages/moderate]", updErr)
      return NextResponse.json({ error: "Failed to remove message" }, { status: 500 })
    }

    await writeAuditLog({
      actorUserId: session.user.id,
      teamId,
      actionType: "message_soft_deleted",
      targetType: "message",
      targetId: messageId,
      metadata: { threadId: thread.id, reason },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[POST /api/messages/moderate]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
