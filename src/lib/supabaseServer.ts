import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requireSupabaseProjectUrl, requireSupabaseServiceRoleKey } from "@/src/lib/supabase-project-env"

let loggedSupabaseUrl = false
let supabaseServerClient: SupabaseClient | null = null

/**
 * Service-role Supabase client (RLS bypass). Reused per Node process so API routes
 * do not repeatedly rebuild the same client for every request.
 *
 * Logs the configured project URL once per Node process (disable with BRAIK_LOG_SUPABASE_URL=0).
 */
export function getSupabaseServer() {
  if (supabaseServerClient) return supabaseServerClient

  const supabaseUrl = requireSupabaseProjectUrl()
  const serviceRoleKey = requireSupabaseServiceRoleKey()

  if (!loggedSupabaseUrl && process.env.BRAIK_LOG_SUPABASE_URL !== "0") {
    loggedSupabaseUrl = true
    console.info("[braik] Supabase project URL (service-role client):", supabaseUrl)
  }

  supabaseServerClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseServerClient
}
