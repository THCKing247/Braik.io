const required = [
  "DATABASE_URL",
  // Accept either NEXTAUTH_SECRET or AUTH_SECRET for compatibility.
  "NEXTAUTH_SECRET_OR_AUTH_SECRET",
  "SUPABASE_URL_OR_NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY_OR_NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const

function isSet(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
}

function verify() {
  const missing: string[] = []

  for (const key of required) {
    if (key === "NEXTAUTH_SECRET_OR_AUTH_SECRET") {
      if (!isSet(process.env.NEXTAUTH_SECRET) && !isSet(process.env.AUTH_SECRET)) {
        missing.push("NEXTAUTH_SECRET (or AUTH_SECRET)")
      }
      continue
    }
    if (key === "SUPABASE_URL_OR_NEXT_PUBLIC_SUPABASE_URL") {
      if (!isSet(process.env.SUPABASE_URL) && !isSet(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
        missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")
      }
      continue
    }
    if (key === "SUPABASE_ANON_KEY_OR_NEXT_PUBLIC_SUPABASE_ANON_KEY") {
      if (!isSet(process.env.SUPABASE_ANON_KEY) && !isSet(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
        missing.push("SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)")
      }
      continue
    }

    if (!isSet(process.env[key])) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    console.error("Build blocked: missing required environment variables:")
    for (const item of missing) {
      console.error(`- ${item}`)
    }
    process.exit(1)
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

