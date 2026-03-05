import { NextResponse } from "next/server"

/** Clear impersonation cookie. */
export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.headers.set(
    "Set-Cookie",
    "braik_support_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  )
  return response
}
