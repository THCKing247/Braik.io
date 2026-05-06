/**
 * Legacy inbox unread-from-others rule (must stay aligned with
 * `public.message_thread_inbox_stats` and GET /api/messages/threads).
 */
export function countUnreadMessagesFromOthers(
  messages: readonly { sender_id: string; created_at: string }[],
  userId: string,
  lastReadAt: string | null | undefined
): number {
  let n = 0
  for (const m of messages) {
    if (m.sender_id === userId) continue
    if (
      !lastReadAt ||
      new Date(m.created_at).getTime() > new Date(lastReadAt).getTime()
    ) {
      n++
    }
  }
  return n
}
