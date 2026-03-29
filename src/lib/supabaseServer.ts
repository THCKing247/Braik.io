import { createClient } from "@supabase/supabase-js"
import { requireSupabaseProjectUrl, requireSupabaseServiceRoleKey } from "@/src/lib/supabase-project-env"

let loggedSupabaseUrl = false

/**
 * Service-role Supabase client (RLS bypass). Each call returns a new client instance — lightweight,
 * but every API route pays client construction + TLS to the project URL.
 *
 * Logs the configured project URL once per Node process (disable with BRAIK_LOG_SUPABASE_URL=0).
 */
export function getSupabaseServer() {
  const supabaseUrl = requireSupabaseProjectUrl()
  const serviceRoleKey = requireSupabaseServiceRoleKey()

  if (!loggedSupabaseUrl && process.env.BRAIK_LOG_SUPABASE_URL !== "0") {
    loggedSupabaseUrl = true
    console.info("[braik] Supabase project URL (service-role client):", supabaseUrl)
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
