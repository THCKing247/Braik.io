import {
  lightweightCached,
  LW_TTL_NOTIFICATIONS_PREVIEW,
  tagNotificationsUserTeam,
} from "@/lib/cache/lightweight-get-cache"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUnreadNotificationCount } from "@/lib/utils/notifications"

export type NotificationApiRow = {
  id: string
  userId: string
  teamId: string
  type: string
  title: string
  body: string | null
  linkUrl: string | null
  linkType: string | null
  linkId: string | null
  metadata?: unknown
  read: boolean
  readAt: string | null
  createdAt: string
}

export type NotificationsApiPayload = {
  notifications: NotificationApiRow[]
  unreadCount: number
  hasMore: boolean
}

export async function loadNotificationsApiPayload(input: {
  userId: string
  teamId: string
  unreadOnly: boolean
  limit: number
  offset: number
  previewMode: boolean
}): Promise<NotificationsApiPayload> {
  const supabase = getSupabaseServer()

  let q = input.previewMode
    ? supabase
        .from("notifications")
        .select("id, type, title, body, link_url, link_type, link_id, read, created_at")
        .eq("user_id", input.userId)
        .eq("team_id", input.teamId)
        .order("created_at", { ascending: false })
        .range(input.offset, input.offset + input.limit - 1)
    : supabase
        .from("notifications")
        .select(
          "id, user_id, team_id, type, title, body, link_url, link_type, link_id, metadata, read, read_at, created_at"
        )
        .eq("user_id", input.userId)
        .eq("team_id", input.teamId)
        .order("created_at", { ascending: false })
        .range(input.offset, input.offset + input.limit - 1)

  if (input.unreadOnly) q = q.eq("read", false)

  const [rowsResult, unreadCount] = await Promise.all([
    q,
    getUnreadNotificationCount(input.userId, input.teamId),
  ])

  if (rowsResult.error) {
    throw new Error(rowsResult.error.message || "notifications query failed")
  }

  const rows = (rowsResult.data ?? []) as Record<string, unknown>[]
  const notifications: NotificationApiRow[] = rows.map((n) => {
    const base = {
      id: n.id as string,
      userId: (n.user_id as string) ?? input.userId,
      teamId: (n.team_id as string) ?? input.teamId,
      type: n.type as string,
      title: n.title as string,
      body: (n.body as string | null) ?? null,
      linkUrl: (n.link_url as string | null) ?? null,
      linkType: (n.link_type as string | null) ?? null,
      linkId: (n.link_id as string | null) ?? null,
      read: Boolean(n.read),
      readAt: input.previewMode ? null : ((n.read_at as string | null) ?? null),
      createdAt: n.created_at as string,
    }
    if (input.previewMode) {
      return base
    }
    return { ...base, metadata: n.metadata }
  })

  return {
    notifications,
    unreadCount,
    hasMore: notifications.length === input.limit,
  }
}

/** Per-user list; polling tolerates brief staleness (revalidate). */
export function getCachedNotificationsPayload(
  userId: string,
  teamId: string,
  unreadOnly: boolean,
  limit: number,
  offset: number,
  previewMode: boolean
): Promise<NotificationsApiPayload> {
  return lightweightCached(
    [
      "notifications-api-v1",
      userId,
      teamId,
      String(unreadOnly),
      String(limit),
      String(offset),
      previewMode ? "preview" : "full",
    ],
    {
      revalidate: LW_TTL_NOTIFICATIONS_PREVIEW,
      /** userId + teamId: rows and unread count are per recipient and team; never share across users. */
      tags: [tagNotificationsUserTeam(userId, teamId)],
    },
    () => loadNotificationsApiPayload({ userId, teamId, unreadOnly, limit, offset, previewMode })
  )
}
