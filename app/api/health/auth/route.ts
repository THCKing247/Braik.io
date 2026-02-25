import { NextResponse } from "next/server"

function isSet(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
}

export async function GET() {
  const env = {
    NEXTAUTH_SECRET: isSet(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
    NEXTAUTH_URL: isSet(process.env.NEXTAUTH_URL || process.env.URL || process.env.DEPLOY_PRIME_URL),
    DATABASE_URL: isSet(process.env.DATABASE_URL),
    SUPABASE_URL: isSet(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: isSet(process.env.SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: isSet(process.env.SUPABASE_SERVICE_ROLE_KEY),
  }

  const missing = Object.entries(env)
    .filter(([, configured]) => !configured)
    .map(([key]) => key)

  return NextResponse.json(
    {
      ok: missing.length === 0,
      env,
      missing,
    },
    { status: missing.length === 0 ? 200 : 500 }
  )
}

