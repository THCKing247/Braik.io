import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { sanitizeAnalyticsMetadata } from "@/lib/analytics/sanitize-metadata"

/**
 * Foundation only: enqueue an internal reminder signal for future workers.
 * Does not send user-facing notifications.
 */
export function enqueueInternalReminderSignal(input: {
  teamId: string
  userId?: string | null
  signalKey: string
  payload?: Record<string, unknown>
}): void {
  const admin = getSupabaseAdminClient()
  if (!admin) return
  const key = input.signalKey.trim().slice(0, 120)
  if (!key || !input.teamId) return
  const payload = sanitizeAnalyticsMetadata(input.payload ?? {})
  void admin
    .from("internal_reminder_queue")
    .insert({
      team_id: input.teamId,
      user_id: input.userId ?? null,
      signal_key: key,
      status: "pending",
      payload,
    })
    .then(({ error }) => {
      if (error) {
        console.info("[reminders] enqueue skipped:", error.message)
      }
    })
}
