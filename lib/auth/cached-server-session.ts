import { cache } from "react"
import { getServerSessionOrSupabase, type SessionResult } from "@/lib/auth/server-auth"

/**
 * Resolves the Supabase session once per React server request.
 * Layout and child server components that both need auth will share one round-trip
 * (profile + users queries inside getServerSessionOrSupabase).
 */
export const getCachedServerSession: () => Promise<SessionResult | null> = cache(async () =>
  getServerSessionOrSupabase()
)
