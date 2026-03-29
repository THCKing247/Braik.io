/**
 * Single place to resolve Supabase project URL and keys from environment.
 * Never hardcode project URLs, refs, or keys in application source.
 *
 * Server / service-role: URL may be `SUPABASE_URL` (optional duplicate) or fall back to
 * `NEXT_PUBLIC_SUPABASE_URL` so one URL can drive both browser and Node when desired.
 * Service role must always be `SUPABASE_SERVICE_ROLE_KEY` (never NEXT_PUBLIC_*).
 *
 * Browser bundle: only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist at runtime.
 */

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t || undefined
}

/** Project API URL for server-side clients (service role, refresh, admin helpers). */
export function getSupabaseProjectUrl(): string | undefined {
  return trimEnv(process.env.SUPABASE_URL) ?? trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/** Anon key for server flows that must behave as the public client (e.g. password verify). */
export function getSupabaseAnonKey(): string | undefined {
  return trimEnv(process.env.SUPABASE_ANON_KEY) ?? trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(getSupabaseProjectUrl() && getSupabaseServiceRoleKey())
}

export function requireSupabaseProjectUrl(): string {
  const url = getSupabaseProjectUrl()
  if (!url) {
    throw new Error(
      "Braik Supabase: missing project URL. Set SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_URL to your project https://<ref>.supabase.co URL."
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

/** Used by the browser `createClient` — must be present at build time for Next.js. */
export function requireNextPublicSupabaseUrl(): string {
  const url = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!url) {
    throw new Error(
      "Braik Supabase: missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env / Netlify and rebuild the app."
    )
  }
  return url
}

export function requireNextPublicSupabaseAnonKey(): string {
  const key = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!key) {
    throw new Error(
      "Braik Supabase: missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Add it to .env / Netlify and rebuild the app."
    )
  }
  return key
}
