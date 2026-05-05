"use client"

import { useMemo } from "react"
import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabaseClient"

export const MESSAGING_UNREAD_TOTAL_QUERY_KEY = "messaging-unread-total" as const
export const MESSAGE_THREAD_INBOX_STATS_QUERY_KEY = "message-thread-inbox-stats" as const

export function messagingUnreadTotalQueryKey(userId: string, teamId: string) {
  return [MESSAGING_UNREAD_TOTAL_QUERY_KEY, userId, teamId] as const
}

export function normalizeThreadIds(threadIds: string[]) {
  return Array.from(new Set(threadIds.filter(Boolean))).sort()
}

export function messageThreadInboxStatsQueryKey(userId: string, visibleThreadIds: readonly string[]) {
  return [MESSAGE_THREAD_INBOX_STATS_QUERY_KEY, userId, ...visibleThreadIds] as const
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
  return queryClient.invalidateQueries({ queryKey: [MESSAGE_THREAD_INBOX_STATS_QUERY_KEY, userId] })
}
