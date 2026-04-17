import type { SupabaseClient } from "@supabase/supabase-js"

const MSG_SELECT = "id, sender_id, content, created_at, updated_at, deleted_at"

export type ThreadMessagesPageResult = {
  messageRows: Array<{
    id: string
    sender_id: string
    content: string
    created_at: string
    updated_at: string
    deleted_at: string | null
  }>
  hasMoreOlder: boolean
}

/**
 * Latest page: newest `limit` messages (chronological order in returned array).
 * Older page: messages strictly before `beforeMessageId`'s `created_at`.
 */
export async function fetchMessagesPageForThread(
  supabase: SupabaseClient,
  threadId: string,
  opts: { limit: number; beforeMessageId?: string | null }
): Promise<ThreadMessagesPageResult> {
  const limit = Math.min(100, Math.max(1, opts.limit))
  const take = limit + 1

  let beforeCreatedAt: string | null = null
  if (opts.beforeMessageId) {
    const { data: cur, error: curErr } = await supabase
      .from("messages")
      .select("created_at")
      .eq("thread_id", threadId)
      .eq("id", opts.beforeMessageId)
      .maybeSingle()
    if (curErr || !cur?.created_at) {
      return { messageRows: [], hasMoreOlder: false }
    }
    beforeCreatedAt = cur.created_at as string
  }

  let q = supabase.from("messages").select(MSG_SELECT).eq("thread_id", threadId)
  if (beforeCreatedAt) {
    q = q.lt("created_at", beforeCreatedAt)
  }
  const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(take)

  if (error) {
    throw new Error(error.message)
  }

  const batch = rows ?? []
  const hasMoreOlder = batch.length > limit
  const page = hasMoreOlder ? batch.slice(0, limit) : batch
  const chronological = [...page].reverse()

  return {
    messageRows: chronological as ThreadMessagesPageResult["messageRows"],
    hasMoreOlder,
  }
}
