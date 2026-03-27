import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { isValidParentSignupPlayerCode, normalizePlayerInviteCode } from "@/lib/parent-player-code"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import {
  BRAIK_SIGNUP_SESSION_COOKIE,
  BRAIK_SIGNUP_SESSION_MAX_AGE_SEC,
} from "@/lib/auth/signup-session-cookie"

export const runtime = "nodejs"

/**
 * Public: checks that a string is a valid personal player code (not a team-wide player join code).
 * Used by /parent/join before account creation.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { code?: string }
    const raw = typeof body.code === "string" ? body.code : ""
    const code = normalizePlayerInviteCode(raw)
    if (!code) {
      return NextResponse.json({ valid: false, error: "Enter a player code." }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const valid = await isValidParentSignupPlayerCode(supabase, code)
    if (!valid) {
      return NextResponse.json({
        valid: false,
        error: "That code is not a valid player code. Ask your coach for your child's personal code.",
      })
    }

    const res = NextResponse.json({ valid: true })
    if (isWaitlistMode()) {
      const isProd = process.env.NODE_ENV === "production"
      res.cookies.set(BRAIK_SIGNUP_SESSION_COOKIE, "1", {
        path: "/",
        maxAge: BRAIK_SIGNUP_SESSION_MAX_AGE_SEC,
        sameSite: "lax",
        secure: isProd,
        httpOnly: true,
      })
    }
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ valid: false, error: msg }, { status: 500 })
  }
}
