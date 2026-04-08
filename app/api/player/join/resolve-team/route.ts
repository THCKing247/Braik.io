import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { normalizePlayerJoinCode } from "@/lib/players/join-code-normalize"
import { resolveTeamByPlayerJoinCode } from "@/lib/players/player-claim"

const DEV = process.env.NODE_ENV === "development"

/**
 * POST /api/player/join/resolve-team
 * Validates teams.player_code and returns minimal team info (no roster). Not gated by BRAIK_ALLOW_PUBLIC_SIGNUP — the code is the credential.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { joinCode?: string }
    const raw = typeof body.joinCode === "string" ? body.joinCode : ""
    const joinCode = normalizePlayerJoinCode(raw)

    if (!joinCode) {
      return NextResponse.json({ error: "Join code is required.", code: "missing_code" }, { status: 400 })
    }

    if (DEV) {
      console.info("[POST /api/player/join/resolve-team] normalized join code length:", joinCode.length)
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      if (DEV) console.error("[POST /api/player/join/resolve-team] Supabase admin client unavailable")
      return NextResponse.json({ error: "Server configuration error.", code: "config" }, { status: 500 })
    }

    const resolved = await resolveTeamByPlayerJoinCode(supabase, joinCode)
    if (DEV && !resolved) {
      console.info("[POST /api/player/join/resolve-team] no team matched teams.player_code after normalize + eq/ilike")
    }
    if (!resolved) {
      return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, teamId: resolved.teamId, teamName: resolved.teamName })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[POST /api/player/join/resolve-team]", msg)
    return NextResponse.json({ error: "Could not validate join code.", code: "server_error" }, { status: 500 })
  }
}
