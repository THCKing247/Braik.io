import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { claimPlayerInviteForUser } from "@/lib/player-invite-claim"

/**
 * POST /api/player-invites/redeem
 * Body: { token?: string, code?: string }
 * Authenticated user redeems a player invite by token or code to link their account to the roster spot.
 * Falls back to `players.invite_code` when no `player_invites` row exists (Phase 6).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string; code?: string }
    const token = typeof body?.token === "string" ? body.token.trim() : ""
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : ""
    if (!token && !code) {
      return NextResponse.json({ error: "Token or code is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const userId = session.user.id

    const result = await claimPlayerInviteForUser(supabase, userId, { token: token || undefined, code: code || undefined })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      success: true,
      player_id: result.playerId,
      team_id: result.teamId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    console.error("[POST /api/player-invites/redeem]", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
