import { createClient } from "@supabase/supabase-js"
import { requireNextPublicSupabaseAnonKey, requireNextPublicSupabaseUrl } from "@/src/lib/supabase-project-env"

/**
 * Single browser Supabase client. Use only in client components.
 * Credentials login returns tokens in JSON and calls `setSession` so `auth.getSession()` matches httpOnly cookies.
 */
export const supabaseClient = createClient(
  requireNextPublicSupabaseUrl(),
  requireNextPublicSupabaseAnonKey(),
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
