import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * POST /api/player-invites/redeem
 * Body: { token: string }
 * Authenticated user redeems a player invite token to link their account to the roster spot.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string }
    const token = typeof body?.token === "string" ? body.token.trim() : ""
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const userId = session.user.id

    const { data: invite, error: inviteErr } = await supabase
      .from("player_invites")
      .select("id, player_id, team_id, status, expires_at")
      .eq("token", token)
      .maybeSingle()

    if (inviteErr || !invite) {
      return NextResponse.json({ error: "Invite not found or invalid." }, { status: 404 })
    }

    if ((invite as { status: string }).status !== "pending") {
      return NextResponse.json({ error: "This invite has already been used or revoked." }, { status: 400 })
    }

    const expiresAt = (invite as { expires_at: string | null }).expires_at
    if (expiresAt) {
      const exp = new Date(expiresAt)
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        return NextResponse.json({ error: "This invite has expired." }, { status: 400 })
      }
    }

    const playerId = (invite as { player_id: string }).player_id
    const teamId = (invite as { team_id: string }).team_id

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, user_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player record not found." }, { status: 404 })
    }

    if ((player as { user_id: string | null }).user_id) {
      return NextResponse.json(
        { error: "This roster spot is already linked to another account." },
        { status: 400 }
      )
    }

    const { error: updatePlayerErr } = await supabase
      .from("players")
      .update({
        user_id: userId,
        claimed_at: new Date().toISOString(),
        invite_status: "joined",
      })
      .eq("id", playerId)

    if (updatePlayerErr) {
      console.error("[POST /api/player-invites/redeem] player update", updatePlayerErr)
      return NextResponse.json({ error: "Failed to link profile" }, { status: 500 })
    }

    const { error: updateInviteErr } = await supabase
      .from("player_invites")
      .update({
        status: "claimed",
        claimed_by_user_id: userId,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", (invite as { id: string }).id)

    if (updateInviteErr) {
      console.error("[POST /api/player-invites/redeem] player_invites update", updateInviteErr)
      // Player already updated; don't fail the request
    }

    return NextResponse.json({
      success: true,
      player_id: playerId,
      team_id: teamId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    console.error("[POST /api/player-invites/redeem]", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
