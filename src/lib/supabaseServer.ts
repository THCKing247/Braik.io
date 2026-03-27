import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client (RLS bypass). Each call returns a new client instance — lightweight,
 * but every API route pays client construction + TLS to `SUPABASE_URL`. Latency is dominated by
 * round-trip to the Supabase region; align Vercel (or host) region with the Supabase project region
 * in deployment config (not readable from this repo alone).
 */
export function getSupabaseServer() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing")
  }

  // Create client with service role key - this automatically bypasses RLS
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

