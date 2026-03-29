import { NextResponse } from "next/server"

function isSet(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
}

/** Deployment check: canonical Braik Supabase env (no duplicate SUPABASE_URL / SUPABASE_ANON_KEY). */
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: isSet(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: isSet(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: isSet(process.env.SUPABASE_SERVICE_ROLE_KEY),
    AUTH_SECRET: isSet(process.env.AUTH_SECRET),
  }

  const requiredSupabase = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const
  const missing = requiredSupabase.filter((k) => !isSet(process.env[k]))

  const optionalMissing = !isSet(process.env.AUTH_SECRET) ? ["AUTH_SECRET"] : []

  return NextResponse.json(
    {
      ok: missing.length === 0,
      env,
      missing,
      optionalMissing,
      /** Non-secret: which host the app is configured to call (debug migrations / wrong project). */
      supabaseUrlHost: (() => {
        const u = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
        if (!u) return null
        try {
          return new URL(u).host
        } catch {
          return "invalid URL"
        }
      })(),
    },
    { status: missing.length === 0 ? 200 : 500 }
  )
}
