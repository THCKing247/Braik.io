import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { resolveAnalyticsTeamContext } from "./resolve-team-context"
import { sanitizeAnalyticsMetadata } from "./sanitize-metadata"
import { inferEventCategory, type ProductEventCategory } from "./infer-event-category"

export type { ProductEventCategory }

export type TrackProductEventInput = {
  eventName: string
  eventCategory?: ProductEventCategory
  userId?: string | null
  teamId?: string | null
  role?: string | null
  source?: "client" | "server"
  metadata?: Record<string, unknown>
}

/**
 * Non-blocking server-side analytics. Never throws; failures are logged at info level.
 */
export function trackProductEventServer(input: TrackProductEventInput): void {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return
  }

  const eventName = typeof input.eventName === "string" ? input.eventName.trim().slice(0, 160) : ""
  if (!eventName) {
    return
  }

  const category = input.eventCategory ?? inferEventCategory(eventName)
  const meta = sanitizeAnalyticsMetadata(input.metadata ?? {})

  void (async () => {
    try {
      const ctx = await resolveAnalyticsTeamContext(admin, input.teamId ?? null)
      const { error } = await admin.from("product_events").insert({
        event_name: eventName,
        event_category: category,
        organization_id: ctx.organization_id,
        program_id: ctx.program_id,
        team_id: input.teamId ?? null,
        user_id: input.userId ?? null,
        role: input.role ? String(input.role).slice(0, 64) : null,
        source: input.source ?? "server",
        metadata: meta,
      })
      if (error) {
        console.info("[analytics] product_events insert skipped:", error.message)
      }
    } catch (e) {
      console.info("[analytics] trackProductEventServer failed:", e instanceof Error ? e.message : e)
    }
  })()
}
