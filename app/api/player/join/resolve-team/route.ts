import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { isPublicSignupAllowed } from "@/lib/config/public-signup"
import { resolveTeamByPlayerJoinCode } from "@/lib/players/player-claim"

/**
 * POST /api/player/join/resolve-team
 * Validates a team player join code and returns the team display name (no roster data).
 */
export async function POST(request: Request) {
  try {
    if (!isPublicSignupAllowed()) {
      return NextResponse.json({ error: "Signup is not available." }, { status: 403 })
    }

    const body = (await request.json()) as { joinCode?: string }
    const joinCode = typeof body.joinCode === "string" ? body.joinCode.trim() : ""
    if (!joinCode) {
      return NextResponse.json({ error: "Join code is required." }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
    }

    const resolved = await resolveTeamByPlayerJoinCode(supabase, joinCode)
    if (!resolved) {
      return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, teamId: resolved.teamId, teamName: resolved.teamName })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[POST /api/player/join/resolve-team]", msg)
    return NextResponse.json({ error: "Could not validate join code." }, { status: 500 })
  }
}
