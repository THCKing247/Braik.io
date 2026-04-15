import { subMonths } from "date-fns"
import {
  lightweightCached,
  LW_TTL_NOTIFICATIONS_PREVIEW,
  tagNotificationsUserTeam,
} from "@/lib/cache/lightweight-get-cache"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

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

/** Default list window for /api/notifications (badge count remains all-time unread in RPC). */
const NOTIFICATIONS_FEED_MONTHS_BACK = 6

function defaultNotificationListSinceIso(): string {
  return subMonths(new Date(), NOTIFICATIONS_FEED_MONTHS_BACK).toISOString()
}

function mapRowToApi(
  n: Record<string, unknown>,
  input: { userId: string; teamId: string; previewMode: boolean }
): NotificationApiRow {
  const base: NotificationApiRow = {
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
}

/**
 * One DB round-trip via `notifications_feed_v1` (list + unread count + hasMore).
 */
export async function loadNotificationsApiPayload(input: {
  userId: string
  teamId: string
  unreadOnly: boolean
  limit: number
  offset: number
  previewMode: boolean
  /** Inclusive lower bound on created_at for the list (not the unread total). */
  sinceIso?: string | null
}): Promise<NotificationsApiPayload> {
  const supabase = getSupabaseServer()
  const since = input.sinceIso?.trim() || defaultNotificationListSinceIso()

  const { data, error } = await supabase.rpc("notifications_feed_v1", {
    p_user_id: input.userId,
    p_team_id: input.teamId,
    p_unread_only: input.unreadOnly,
    p_limit: input.limit,
    p_offset: input.offset,
    p_since: since,
  })

  if (error) {
    throw new Error(error.message || "notifications_feed_v1 failed")
  }

  const payload = data as {
    unreadCount?: number
    hasMore?: boolean
    notifications?: Record<string, unknown>[]
  }

  const rawRows = Array.isArray(payload.notifications) ? payload.notifications : []
  const notifications: NotificationApiRow[] = rawRows.map((n) =>
    mapRowToApi(n, {
      userId: input.userId,
      teamId: input.teamId,
      previewMode: input.previewMode,
    })
  )

  return {
    notifications,
    unreadCount: typeof payload.unreadCount === "number" ? payload.unreadCount : 0,
    hasMore: Boolean(payload.hasMore),
  }
}

/** Per-user list; polling tolerates brief staleness (revalidate). */
export function getCachedNotificationsPayload(
  userId: string,
  teamId: string,
  unreadOnly: boolean,
  limit: number,
  offset: number,
  previewMode: boolean,
  sinceIso?: string | null
): Promise<NotificationsApiPayload> {
  const sinceKey = sinceIso?.trim() ?? "default"
  return lightweightCached(
    [
      "notifications-api-v2",
      userId,
      teamId,
      String(unreadOnly),
      String(limit),
      String(offset),
      previewMode ? "preview" : "full",
      sinceKey,
    ],
    {
      revalidate: LW_TTL_NOTIFICATIONS_PREVIEW,
      /** userId + teamId: rows and unread count are per recipient and team; never share across users. */
      tags: [tagNotificationsUserTeam(userId, teamId)],
    },
    () =>
      loadNotificationsApiPayload({
        userId,
        teamId,
        unreadOnly,
        limit,
        offset,
        previewMode,
        sinceIso: sinceIso ?? null,
      })
  )
}
