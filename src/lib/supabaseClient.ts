import { createClient } from "@supabase/supabase-js"

/**
 * Single browser Supabase client. Use only in client components.
 * App auth is cookie-based via /api/auth/session and /api/auth/login; this client
 * is for optional client-side usage with session persistence and token refresh.
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
