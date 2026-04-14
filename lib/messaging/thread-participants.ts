import type { SupabaseClient } from "@supabase/supabase-js"

const LOG_PREFIX = "[messaging:participants]"

export type ParticipantUpsertResult = {
  userIds: string[]
  error: Error | null
}

/**
 * Upsert participant rows (on conflict do nothing — no duplicate rows).
 * Rely on PK (thread_id, user_id).
 */
export async function upsertThreadParticipants(
  supabase: SupabaseClient,
  threadId: string,
  userIds: string[],
  op: string
): Promise<ParticipantUpsertResult> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) {
    return { userIds: [], error: null }
  }

  const joinedAt = new Date().toISOString()
  const rows = unique.map((user_id) => ({
    thread_id: threadId,
    user_id,
    joined_at: joinedAt,
  }))

  const { error } = await supabase.from("message_thread_participants").upsert(rows, {
    onConflict: "thread_id,user_id",
    ignoreDuplicates: true,
  })

  if (error) {
    console.error(`${LOG_PREFIX} upsert failed`, {
      op,
      threadId,
      userIds: unique,
      code: error.code,
      message: error.message,
      details: error.details,
    })
    return { userIds: unique, error: new Error(error.message) }
  }

  console.info(`${LOG_PREFIX} upsert ok`, {
    op,
    threadId,
    rowCount: unique.length,
    userIds: unique,
  })
  return { userIds: unique, error: null }
}

/**
 * Collect user ids that should have a participant row: thread creator + all non-deleted message senders.
 */
export async function collectUserIdsFromThreadAndMessages(
  supabase: SupabaseClient,
  threadId: string
): Promise<string[]> {
  const { data: thread } = await supabase
    .from("message_threads")
    .select("created_by")
    .eq("id", threadId)
    .maybeSingle()

  const { data: senders } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("thread_id", threadId)
    .is("deleted_at", null)

  const ids = new Set<string>()
  if (thread?.created_by) ids.add(thread.created_by)
  for (const row of senders ?? []) {
    if (row.sender_id) ids.add(row.sender_id)
  }
  return [...ids]
}

/**
 * Ensure creator + message senders + extra ids (e.g. current sender before first insert) are participants.
 */
export async function repairThreadParticipantsFromThreadAndMessages(
  supabase: SupabaseClient,
  threadId: string,
  extraUserIds: string[] = [],
  op = "repairThreadParticipantsFromThreadAndMessages"
): Promise<ParticipantUpsertResult> {
  const fromDb = await collectUserIdsFromThreadAndMessages(supabase, threadId)
  const merged = [...new Set([...fromDb, ...extraUserIds])]
  console.info(`${LOG_PREFIX} repair gather`, {
    op,
    threadId,
    fromThreadAndMessages: fromDb.length,
    extra: extraUserIds.length,
    total: merged.length,
  })
  return upsertThreadParticipants(supabase, threadId, merged, op)
}

/** Single-user upsert (e.g. team member opening a thread they were missing from). */
export async function ensureUserThreadParticipant(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
  op: string
): Promise<ParticipantUpsertResult> {
  return upsertThreadParticipants(supabase, threadId, [userId], op)
}
