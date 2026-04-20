import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  normalizePlayerInviteCode,
  resolveParentAccessCodeForPreview,
} from "@/lib/parent-player-code"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import {
  BRAIK_SIGNUP_SESSION_COOKIE,
  BRAIK_SIGNUP_SESSION_MAX_AGE_SEC,
} from "@/lib/auth/signup-session-cookie"

export const runtime = "nodejs"

/**
 * Public: validates a parent link code (players.invite_code or typed parent_link invite)
 * before account creation. Requires the athlete to have completed signup.
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
    const resolved = await resolveParentAccessCodeForPreview(supabase, code)
    if (!resolved.ok) {
      return NextResponse.json({ valid: false, error: resolved.error }, { status: 400 })
    }

    const res = NextResponse.json({
      valid: true,
      playerDisplayName: resolved.playerDisplayName,
      teamName: resolved.teamName,
    })
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
