import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"

export type BroadcastMessagePayload = {
  id: string
  thread_id: string
  sender_id: string
  content: string | null
  created_at: string
  [key: string]: unknown
}

/**
 * Push `new_message` on Realtime topic `messages:${threadId}` using the JS client's HTTP broadcast path
 * (no channel subscribe). Uses the service-role admin client only — never `.rpc()` from this module.
 */
export async function broadcastThreadNewMessage(threadId: string, payload: BroadcastMessagePayload): Promise<void> {
  const supabaseAdmin = getSupabaseAdminClient()
  if (!supabaseAdmin) {
    console.warn("[messages:broadcast] skipped — Supabase admin client not configured")
    return
  }

  const channel = supabaseAdmin.channel(`messages:${threadId}`)

  try {
    const result = await channel.send({
      type: "broadcast",
      event: "new_message",
      payload,
    })

    if (result !== "ok") {
      console.warn("[messages:broadcast] send returned non-ok", {
        threadId,
        result,
      })
    }
  } catch (error) {
    console.error("[messages:broadcast] failed", {
      threadId,
      error,
    })
  } finally {
    await supabaseAdmin.removeChannel(channel)
  }
}
