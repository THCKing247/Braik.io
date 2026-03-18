import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type NotificationType =
  | "announcement"
  | "event_created"
  | "event_updated"
  | "event_starting_soon"
  | "message"
  | "thread_reply"
  | "roster_change"
  | "roster_import"
  | "document_change"
  | "inventory_change"
  | "stats_updated"
  | "health_update"
  | "playbook_updated"
  | "ai_task_completed"
  | "billing_reminder"
  | "payment_reminder"
  | "account_status"

export interface NotificationPayload {
  type: NotificationType
  teamId: string
  title: string
  body?: string
  linkUrl?: string
  linkType?: string
  linkId?: string
  metadata?: Record<string, unknown>
  targetUserIds?: string[]
  excludeUserIds?: string[]
}

/**
 * Create in-app notifications (Supabase). No-op if notifications table is missing.
 */
export async function createNotifications(payload: NotificationPayload): Promise<void> {
  const { type, teamId, title, body, linkUrl, linkType, linkId, metadata, targetUserIds, excludeUserIds = [] } = payload

  let userIds: string[] = []
  if (targetUserIds && targetUserIds.length > 0) {
    userIds = targetUserIds.filter((id) => !excludeUserIds.includes(id))
  } else {
    const supabase = getSupabaseServer()
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("team_id", teamId)
    userIds = (profiles ?? []).map((p) => p.id)
  }

  if (userIds.length === 0) return

  const supabase = getSupabaseServer()
  const { error } = await supabase.from("notifications").insert(
    userIds.map((userId) => ({
      user_id: userId,
      team_id: teamId,
      type,
      title,
      body: body ?? null,
      link_url: linkUrl ?? null,
      link_type: linkType ?? null,
      link_id: linkId ?? null,
      metadata: metadata ?? null,
    }))
  )
  if (error) {
    console.warn("createNotifications:", error.message)
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const supabase = getSupabaseServer()
  await supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("id", notificationId)
}

export async function markAllNotificationsAsRead(userId: string, teamId?: string): Promise<void> {
  const supabase = getSupabaseServer()
  let q = supabase.from("notifications").update({ read: true, read_at: new Date().toISOString() }).eq("user_id", userId)
  if (teamId) q = q.eq("team_id", teamId)
  await q
}

export async function getUnreadNotificationCount(userId: string, teamId?: string): Promise<number> {
  const supabase = getSupabaseServer()
  let q = supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("read", false)
  if (teamId) q = q.eq("team_id", teamId)
  const { count } = await q
  return count ?? 0
}

export async function sendPushNotifications(_payload: NotificationPayload): Promise<void> {
  // No-op: push not implemented
}
