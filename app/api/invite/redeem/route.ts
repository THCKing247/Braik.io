import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { findInviteCode, consumeInviteCode } from "@/lib/invites/invite-codes"

export const runtime = "nodejs"

/**
 * POST /api/invite/redeem
 * Body: { code: string }
 * Authenticated player redeems an invite code to link their account to a roster player record.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { code?: string }
    const code = body?.code?.trim()
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    const normalizedCode = code.toUpperCase()
    const supabase = getSupabaseServer()
    const userId = session.user.id

    // 1. Try typed invite_codes (player_claim_invite), only unclaimed
    const typedCode = await findInviteCode(supabase, normalizedCode, ["player_claim_invite"])
    if (typedCode) {
      const { data: inviteRow } = await supabase
        .from("invite_codes")
        .select("id, claimed_at, target_player_id")
        .eq("id", typedCode.id)
        .single()

      if (inviteRow?.claimed_at == null && inviteRow?.target_player_id) {
        const { data: player, error: playerErr } = await supabase
          .from("players")
          .select("id, team_id")
          .eq("id", inviteRow.target_player_id)
          .is("user_id", null)
          .maybeSingle()

        if (playerErr || !player) {
          return NextResponse.json(
            { error: "This roster spot is already linked to another account." },
            { status: 400 }
          )
        }

        const { error: updateErr } = await supabase
          .from("players")
          .update({
            user_id: userId,
            claimed_at: new Date().toISOString(),
            invite_status: "joined",
          })
          .eq("id", player.id)

        if (updateErr) {
          console.error("[POST /api/invite/redeem] player update", updateErr)
          return NextResponse.json({ error: "Failed to link profile" }, { status: 500 })
        }

        const consume = await consumeInviteCode(supabase, typedCode.id, userId)
        if (consume.error) {
          console.error("[POST /api/invite/redeem] consume invite", consume.error)
        }

        return NextResponse.json({ success: true, player_id: player.id, team_id: player.team_id })
      }
    }

    // 2. Fallback: players.invite_code (legacy roster invite)
    const { data: existingPlayer, error: playerLookupErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("invite_code", normalizedCode)
      .is("user_id", null)
      .maybeSingle()

    if (!playerLookupErr && existingPlayer) {
      const { error: linkErr } = await supabase
        .from("players")
        .update({
          user_id: userId,
          claimed_at: new Date().toISOString(),
          invite_status: "joined",
        })
        .eq("id", existingPlayer.id)

      if (linkErr) {
        console.error("[POST /api/invite/redeem] player link", linkErr)
        return NextResponse.json({ error: "Failed to link profile" }, { status: 500 })
      }

      return NextResponse.json({ success: true, player_id: existingPlayer.id, team_id: existingPlayer.team_id })
    }

    return NextResponse.json(
      { error: "Invalid, expired, or already used code. Check the code and try again." },
      { status: 400 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    console.error("[POST /api/invite/redeem]", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
