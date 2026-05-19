import { fetchJson } from "@/lib/api/core/fetch-json"
import type { MessageThreadInboxStatRow } from "@/lib/messaging/messaging-queries"

export type MessagingInboxStatsResponse = {
  totalUnread: number
  stats: MessageThreadInboxStatRow[]
}

/** Server-backed inbox stats (replaces browser Supabase RPC). */
export async function fetchMessagingInboxStats(
  teamId: string,
  threadIds?: string[]
): Promise<MessagingInboxStatsResponse> {
  const q = new URLSearchParams({ teamId })
  if (threadIds?.length) {
    q.set("threadIds", threadIds.join(","))
  }
  return fetchJson<MessagingInboxStatsResponse>(`/api/messages/inbox-stats?${q.toString()}`, {
    credentials: "same-origin",
  })
}
