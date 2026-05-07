"use client"

import { useMemo } from "react"
import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query"
import type { MessageThreadWireItem } from "@/lib/messaging/thread-list-wire"
import { supabase } from "@/lib/supabaseClient"
import { fetchMessagesThreadsList as fetchMessagesThreadsListApi } from "@/lib/api/messaging/threads"
import { messagingQueryRoot, queryKeys } from "@/lib/queries/keys"

/** @deprecated Prefer `messagingQueryRoot.unreadTotal` — kept for invalidation filters that referenced the string literal. */
export const MESSAGING_UNREAD_TOTAL_QUERY_KEY = messagingQueryRoot.unreadTotal

/** @deprecated Prefer `messagingQueryRoot.inboxStats`. */
export const MESSAGE_THREAD_INBOX_STATS_QUERY_KEY = messagingQueryRoot.inboxStats

export function messagingUnreadTotalQueryKey(userId: string, teamId: string) {
  return queryKeys.messaging.unreadTotal(userId, teamId)
}

export function normalizeThreadIds(threadIds: string[]) {
  return Array.from(new Set(threadIds.filter(Boolean))).sort()
}

export function messageThreadInboxStatsQueryKey(userId: string, visibleThreadIds: readonly string[]) {
  return queryKeys.messaging.inboxStats(userId, visibleThreadIds)
}

export function useMessagingUnreadTotalQuery(opts: { userId: string; teamId: string }) {
  const { userId, teamId } = opts
  return useQuery({
    queryKey: messagingUnreadTotalQueryKey(userId, teamId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("messaging_unread_total_for_team_user", {
        p_user_id: userId,
        p_team_id: teamId,
      })
      if (error) throw error
      return Number(data ?? 0)
    },
    enabled: Boolean(userId && teamId),
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}

export type MessageThreadInboxStatRow = {
  thread_id: string
  message_count: number | string
  unread_count: number | string
  last_message_id: string | null
  last_message_content: string | null
  last_message_created_at: string | null
  last_sender_id: string | null
}

export function useMessageThreadInboxStatsQuery(opts: { userId: string; visibleThreadIds: string[] }) {
  const { userId, visibleThreadIds } = opts
  const stableThreadIds = useMemo(
    () => normalizeThreadIds(visibleThreadIds),
    [visibleThreadIds.join("\u0000")]
  )

  return useQuery({
    queryKey: messageThreadInboxStatsQueryKey(userId, stableThreadIds),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("message_threads_inbox_stats", {
        p_user_id: userId,
        p_thread_ids: stableThreadIds,
      })
      if (error) throw error
      return (data ?? []) as MessageThreadInboxStatRow[]
    },
    enabled: Boolean(userId && stableThreadIds.length),
    staleTime: 10_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}

export function invalidateMessagingUnreadTotal(queryClient: QueryClient, userId: string, teamId: string) {
  return queryClient.invalidateQueries({ queryKey: messagingUnreadTotalQueryKey(userId, teamId) })
}

export function invalidateMessageThreadInboxStatsForUser(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: [messagingQueryRoot.inboxStats, userId] })
}

/** @deprecated Prefer `messagingQueryRoot.threadsList`. */
export const MESSAGES_THREADS_QUERY_KEY = messagingQueryRoot.threadsList

export type MessagesThreadsQueryData = {
  threads: MessageThreadWireItem[]
  meta: { totalUnread: number }
}

export function messagesThreadsQueryKey(teamId: string) {
  return queryKeys.messaging.threadsList(teamId)
}

export async function fetchMessagesThreadsList(teamId: string): Promise<MessagesThreadsQueryData> {
  return fetchMessagesThreadsListApi(teamId)
}

export function useMessagesThreadsQuery(opts: { teamId: string; enabled: boolean }) {
  const { teamId, enabled } = opts
  return useQuery({
    queryKey: messagesThreadsQueryKey(teamId),
    queryFn: () => fetchMessagesThreadsList(teamId),
    enabled: Boolean(teamId && enabled),
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  })
}

export function invalidateMessagesThreads(queryClient: QueryClient, teamId: string) {
  return queryClient.invalidateQueries({ queryKey: messagesThreadsQueryKey(teamId) })
}
