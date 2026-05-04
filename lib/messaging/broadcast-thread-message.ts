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
 */
export async function broadcastThreadNewMessage(
  supabase: SupabaseClient,
  payload: NewMessageBroadcastPayload
): Promise<void> {
  const topic = `messages:${payload.thread_id}`
  const channel = supabase.channel(topic)

  await new Promise<void>((resolve, reject) => {
    const timeoutMs = 8000
    const t = setTimeout(() => {
      void supabase.removeChannel(channel)
      reject(new Error(`realtime broadcast subscribe timeout (${topic})`))
    }, timeoutMs)

    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        void channel
          .send({
            type: "broadcast",
            event: "new_message",
            payload,
          })
          .then(() => {
            clearTimeout(t)
            void supabase.removeChannel(channel)
            resolve()
          })
          .catch((e) => {
            clearTimeout(t)
            void supabase.removeChannel(channel)
            reject(e)
          })
        return
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        clearTimeout(t)
        void supabase.removeChannel(channel)
        reject(err ?? new Error(`realtime subscribe ${String(status)}`))
      }
    })
  })
}
