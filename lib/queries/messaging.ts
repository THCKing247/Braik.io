/** Barrel — messaging React Query helpers (`lib/messaging/messaging-queries.ts`). */
export {
  MESSAGING_UNREAD_TOTAL_QUERY_KEY,
  MESSAGE_THREAD_INBOX_STATS_QUERY_KEY,
  MESSAGES_THREADS_QUERY_KEY,
  messagingUnreadTotalQueryKey,
  normalizeThreadIds,
  messageThreadInboxStatsQueryKey,
  useMessagingUnreadTotalQuery,
  useMessageThreadInboxStatsQuery,
  messagesThreadsQueryKey,
  fetchMessagesThreadsList,
  useMessagesThreadsQuery,
  invalidateMessagesThreads,
  invalidateMessagingUnreadTotal,
  invalidateMessageThreadInboxStatsForUser,
  type MessagesThreadsQueryData,
  type MessageThreadInboxStatRow,
} from "@/lib/messaging/messaging-queries"
