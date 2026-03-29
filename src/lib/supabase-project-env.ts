/**
 * Single source for Supabase configuration. Do not hardcode URLs or keys.
 *
 * Required (canonical):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY (server only; never NEXT_PUBLIC_*)
 *
 * Server-side API routes use the same project URL and anon key as the browser (NEXT_PUBLIC_*).
 */

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t || undefined
}

/** Project API URL for server clients, token refresh, and admin helpers. */
export function getSupabaseProjectUrl(): string | undefined {
  return trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/** Anon key for server flows that must use the public Supabase client (e.g. password verify). */
export function getSupabaseAnonKey(): string | undefined {
  return trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(getSupabaseProjectUrl() && getSupabaseServiceRoleKey())
}

export function requireSupabaseProjectUrl(): string {
  const url = getSupabaseProjectUrl()
  if (!url) {
    throw new Error(
      "Braik Supabase: missing NEXT_PUBLIC_SUPABASE_URL. Set it to your project https://<ref>.supabase.co URL and rebuild."
    )
  }
  return url
}

export function requireSupabaseServiceRoleKey(): string {
  const key = getSupabaseServiceRoleKey()
  if (!key) {
    throw new Error("Braik Supabase: missing SUPABASE_SERVICE_ROLE_KEY (server-only; never expose to the client).")
  }
  return key
}

/** Browser `createClient` — inlined at build time from NEXT_PUBLIC_*. */
export function requireNextPublicSupabaseUrl(): string {
  const url = getSupabaseProjectUrl()
  if (!url) {
    throw new Error(
      "Braik Supabase: missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env / Netlify and rebuild the app."
    )
  }
  return url
}

export function requireNextPublicSupabaseAnonKey(): string {
  const key = getSupabaseAnonKey()
  if (!key) {
    throw new Error(
      "Braik Supabase: missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Add it to .env / Netlify and rebuild the app."
    )
  }
  return key
}
