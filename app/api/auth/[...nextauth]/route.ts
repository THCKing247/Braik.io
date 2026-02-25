import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

// Netlify exposes URL-style env vars; mirror them into NextAuth defaults at runtime.
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.URL || process.env.DEPLOY_PRIME_URL || undefined
}

if (!process.env.NEXTAUTH_URL_INTERNAL) {
  process.env.NEXTAUTH_URL_INTERNAL = process.env.URL || undefined
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

