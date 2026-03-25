import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { isValidParentSignupPlayerCode, normalizePlayerInviteCode } from "@/lib/parent-player-code"

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

    return NextResponse.json({ valid: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ valid: false, error: msg }, { status: 500 })
  }
}
