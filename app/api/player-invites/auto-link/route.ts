import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { normalizePhone, samePhone } from "@/lib/player-invite-auto-link"
import { upsertStaffTeamMember } from "@/lib/team-members-sync"

/**
 * POST /api/player-invites/auto-link
 * When the user has no linked player profile, check for a single pending invite matching
 * their email (and optionally phone). If exactly one match, claim it and return success.
 * Never auto-link by name only; never auto-link when multiple invites match (user must choose).
 */
export async function POST() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServer()
    const userId = session.user.id
    const email = session.user.email.trim().toLowerCase()

    const { data: existingPlayer } = await supabase
      .from("players")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    if (existingPlayer) {
      return NextResponse.json({ linked: false, reason: "already_linked" })
    }

    const now = new Date().toISOString()
    const { data: byEmail } = await supabase
      .from("player_invites")
      .select("id, player_id, team_id, email, phone, expires_at")
      .eq("status", "pending")
      .or(`expires_at.is.null,expires_at.gte.${now}`)

    const pendingInvites = (byEmail ?? []) as Array<{
      id: string
      player_id: string
      team_id: string
      email: string | null
      phone: string | null
    }>

    const matchingByEmail = pendingInvites.filter(
      (inv) => inv.email && inv.email.toLowerCase() === email
    )

    if (matchingByEmail.length > 1) {
      return NextResponse.json({
        linked: false,
        reason: "multiple",
        inviteIds: matchingByEmail.map((i) => i.id),
      })
    }

    if (matchingByEmail.length === 1) {
      const invite = matchingByEmail[0]
      const claimErr = await claimInvite(supabase, invite.id, invite.player_id, invite.team_id, userId)
      if (claimErr) {
        return NextResponse.json({ error: claimErr }, { status: 500 })
      }
      return NextResponse.json({
        linked: true,
        playerId: invite.player_id,
        teamId: invite.team_id,
      })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .maybeSingle()

    const userPhone =
      (profile as { phone?: string | null } | null)?.phone?.trim()
    const normalizedUserPhone = userPhone ? normalizePhone(userPhone) : null

    if (!normalizedUserPhone || normalizedUserPhone.length < 10) {
      return NextResponse.json({ linked: false, reason: "none" })
    }

    const matchingByPhone = pendingInvites.filter(
      (inv) => inv.phone && samePhone(inv.phone, normalizedUserPhone)
    )

    if (matchingByPhone.length > 1) {
      return NextResponse.json({
        linked: false,
        reason: "multiple",
        inviteIds: matchingByPhone.map((i) => i.id),
      })
    }

    if (matchingByPhone.length === 1) {
      const invite = matchingByPhone[0]
      const claimErr = await claimInvite(supabase, invite.id, invite.player_id, invite.team_id, userId)
      if (claimErr) {
        return NextResponse.json({ error: claimErr }, { status: 500 })
      }
      return NextResponse.json({
        linked: true,
        playerId: invite.player_id,
        teamId: invite.team_id,
      })
    }

    return NextResponse.json({ linked: false, reason: "none" })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    console.error("[POST /api/player-invites/auto-link]", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function claimInvite(
  supabase: ReturnType<typeof getSupabaseServer>,
  inviteId: string,
  playerId: string,
  teamId: string,
  userId: string
): Promise<string | null> {
  const { data: player, error: playerErr } = await supabase
    .from("players")
    .select("id, user_id")
    .eq("id", playerId)
    .maybeSingle()

  if (playerErr || !player) return "Player not found"
  if ((player as { user_id: string | null }).user_id) return "Already linked"

  const { error: updatePlayerErr } = await supabase
    .from("players")
    .update({
      user_id: userId,
      claimed_at: new Date().toISOString(),
      invite_status: "joined",
    })
    .eq("id", playerId)

  if (updatePlayerErr) {
    console.error("[auto-link] player update", updatePlayerErr)
    return "Failed to link profile"
  }

  await supabase
    .from("player_invites")
    .update({
      status: "claimed",
      claimed_by_user_id: userId,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", inviteId)

  const { error: tmErr } = await upsertStaffTeamMember(supabase, teamId, userId, "player", {
    source: "api_player_invites_auto_link",
  })
  if (tmErr) {
    console.error("[auto-link] team_members", tmErr)
    return "Failed to save team membership"
  }

  return null
}
