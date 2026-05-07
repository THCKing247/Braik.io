import { fetchJson } from "@/lib/api/core/fetch-json"
import type { MessageThreadWireItem } from "@/lib/messaging/thread-list-wire"

export type MessagesThreadsListData = {
  threads: MessageThreadWireItem[]
  meta: { totalUnread: number }
}

/** GET /api/messages/threads — sidebar list + unread meta (same merge target as dashboard deferred-core inbox snapshot). */
export async function fetchMessagesThreadsList(teamId: string): Promise<MessagesThreadsListData> {
  const raw = await fetchJson<{ threads?: MessageThreadWireItem[]; meta?: { totalUnread?: number } }>(
    `/api/messages/threads?teamId=${encodeURIComponent(teamId)}`,
    { credentials: "same-origin" }
  )
  return {
    threads: raw.threads ?? [],
    meta: { totalUnread: Number(raw.meta?.totalUnread ?? 0) },
  }
}

/** GET /api/messages/contacts — compose UI for staff messaging. */
export async function fetchMessagesContacts(teamId: string): Promise<unknown> {
  return fetchJson(`/api/messages/contacts?teamId=${encodeURIComponent(teamId)}`, {
    credentials: "same-origin",
  })
}
