import type { SupabaseClient } from "@supabase/supabase-js"

export type NewMessageBroadcastPayload = {
  id: string
  thread_id: string
  sender_id: string
  content: string
  created_at: string
}

/**
 * Publish a Realtime broadcast on topic `messages:${threadId}` so clients subscribed with
 * `.on('broadcast', { event: 'new_message' }, ...)` receive updates without postgres_changes.
 *
 * Uses broadcast REST-style send (no server `.subscribe()`), then removes the ephemeral channel.
 */
export async function broadcastThreadNewMessage(
  supabase: SupabaseClient,
  payload: NewMessageBroadcastPayload
): Promise<void> {
  const topic = `messages:${payload.thread_id}`
  const channel = supabase.channel(topic)
  try {
    const status = await channel.send({
      type: "broadcast",
      event: "new_message",
      payload,
    })
    if (status !== "ok") {
      throw new Error(`realtime broadcast send failed: ${status}`)
    }
  } finally {
    await supabase.removeChannel(channel)
  }
}
