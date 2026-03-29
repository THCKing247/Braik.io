import { createClient } from "@supabase/supabase-js"
import { requireSupabaseProjectUrl, requireSupabaseServiceRoleKey } from "@/src/lib/supabase-project-env"

/**
 * Service-role Supabase client (RLS bypass). Each call returns a new client instance — lightweight,
 * but every API route pays client construction + TLS to the project URL. Latency is dominated by
 * round-trip to the Supabase region; align Netlify/host region with the Supabase project region.
 */
export function getSupabaseServer() {
  const supabaseUrl = requireSupabaseProjectUrl()
  const serviceRoleKey = requireSupabaseServiceRoleKey()

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

