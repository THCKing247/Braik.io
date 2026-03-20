import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { BRAIK_PERSIST_SESSION_COOKIE } from "@/lib/auth/persist-session-cookie"

export const runtime = "nodejs"

export async function POST() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ success: false, error: "Server auth is not configured" }, { status: 500 })
  }

  const supabaseServerClient = getSupabaseServer()
  await supabaseServerClient.auth.signOut()
  const response = NextResponse.json({ success: true })
  response.cookies.set("sb-access-token", "", { path: "/", maxAge: 0 })
  response.cookies.set("sb-refresh-token", "", { path: "/", maxAge: 0 })
  response.cookies.set(BRAIK_PERSIST_SESSION_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}

