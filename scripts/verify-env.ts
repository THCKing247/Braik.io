/**
 * Pre-build guard: required Supabase vars for Braik (Next.js + Netlify).
 * Canonical trio only — server uses NEXT_PUBLIC_* for URL + anon (same project as the browser).
 */

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const

function isSet(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
}

function verify() {
  const missing: string[] = []

  for (const key of required) {
    if (!isSet(process.env[key])) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    console.error("Build blocked: missing required environment variables:")
    for (const item of missing) {
      console.error(`- ${item}`)
    }
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your Supabase project, and SUPABASE_SERVICE_ROLE_KEY on the server only."
    )
    process.exit(1)
  }

  if (!isSet(process.env.AUTH_SECRET)) {
    console.warn("Warning: AUTH_SECRET is not set. Configure it in production for stronger session signing hygiene.")
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (url) {
    try {
      console.log("[braik-env] Build will use Supabase host:", new URL(url).host)
    } catch {
      console.warn("[braik-env] NEXT_PUBLIC_SUPABASE_URL is set but not a valid URL.")
    }
  }
  console.log("Environment verification passed.")
}

// Enforce on CI/Netlify builds and production builds.
const shouldEnforce =
  process.env.NETLIFY === "true" ||
  process.env.CI === "true" ||
  process.env.NODE_ENV === "production"

if (shouldEnforce) {
  verify()
} else {
  console.log("Skipping env verification outside CI/production context.")
}
