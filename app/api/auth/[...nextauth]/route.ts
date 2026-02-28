import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

// Netlify exposes URL-style env vars; mirror them into NextAuth defaults at runtime.
const inferredExternalUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
if (!process.env.NEXTAUTH_URL && inferredExternalUrl) {
  process.env.NEXTAUTH_URL = inferredExternalUrl
}

if (!process.env.NEXTAUTH_URL_INTERNAL && process.env.URL) {
  process.env.NEXTAUTH_URL_INTERNAL = process.env.URL
}

const handler = NextAuth(authOptions)

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export { handler as GET, handler as POST }

