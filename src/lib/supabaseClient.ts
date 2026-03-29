import { createClient } from "@supabase/supabase-js"

/**
 * Single browser Supabase client. Use only in client components.
 * Credentials login returns tokens in JSON and calls `setSession` so `auth.getSession()` matches httpOnly cookies.
 */
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
