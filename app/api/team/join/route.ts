import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { findInviteCode, consumeInviteCode } from "@/lib/invites/invite-codes"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "You must be signed in to join a team." }, { status: 401 })
    }

    const { code } = (await request.json()) as { code?: string }
    const normalizedCode = code?.trim().toUpperCase()
    if (!normalizedCode) {
      return NextResponse.json({ success: false, error: "Please enter a code." }, { status: 400 })
    }

    // Prevent users who already have a team from joining another
    if (session.user.teamId) {
      return NextResponse.json(
        { success: false, error: "You are already connected to a team." },
        { status: 409 }
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 })
    }

    const userId = session.user.id

    // Prevent head coaches from joining other teams (they create their own)
    const userRole = session.user.role?.toUpperCase() || ""
    if (userRole === "HEAD_COACH") {
      return NextResponse.json(
        { success: false, error: "Head coaches cannot join other teams. Create your own team instead." },
        { status: 403 }
      )
    }

    let teamId: string | null = null
    let usedPlayerInvite = false

    // Priority 0: Typed invite_codes (team_player_join or player_claim_invite)
    try {
      const typedCode = await findInviteCode(supabase, normalizedCode, [
        "team_player_join",
        "player_claim_invite",
      ])
      if (typedCode) {
        if (typedCode.invite_type === "team_player_join" && typedCode.team_id) {
          const maxUses = typedCode.max_uses ?? Number.MAX_SAFE_INTEGER
          if (typedCode.uses >= maxUses) {
            return NextResponse.json(
              { success: false, error: "This invite code has reached its maximum number of uses." },
              { status: 400 }
            )
          }
          const consume = await consumeInviteCode(supabase, typedCode.id, userId)
          if (consume.error) {
            return NextResponse.json(
              { success: false, error: consume.error },
              { status: 400 }
            )
          }
          teamId = typedCode.team_id
        } else if (typedCode.invite_type === "player_claim_invite" && typedCode.target_player_id) {
          const { data: player } = await supabase
            .from("players")
            .select("id, team_id")
            .eq("id", typedCode.target_player_id)
            .is("user_id", null)
            .maybeSingle()
          if (player?.team_id) {
            const { error: linkErr } = await supabase
              .from("players")
              .update({
                user_id: userId,
                claimed_at: new Date().toISOString(),
                invite_status: "joined",
              })
              .eq("id", player.id)
            if (linkErr) {
              return NextResponse.json(
                { success: false, error: "Failed to link your account to the roster.", details: linkErr.message },
                { status: 500 }
              )
            }
            await consumeInviteCode(supabase, typedCode.id, userId)
            teamId = player.team_id as string
            usedPlayerInvite = true
          }
        }
      }
    } catch {
      // invite_codes table may not exist yet; fall through to legacy
    }

    // Priority 1: Check for player-specific invite code (players.invite_code)
    // This links the user to an existing coach-created player record
    const { data: existingPlayer, error: playerLookupErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("invite_code", normalizedCode)
      .is("user_id", null)
      .maybeSingle()

    if (!playerLookupErr && existingPlayer?.team_id) {
      teamId = existingPlayer.team_id as string
      usedPlayerInvite = true
      const { error: linkErr } = await supabase
        .from("players")
        .update({
          user_id: userId,
          claimed_at: new Date().toISOString(),
          invite_status: "joined",
        })
        .eq("id", existingPlayer.id)
      if (linkErr) {
        return NextResponse.json(
          { success: false, error: "Failed to link your account to the roster.", details: linkErr.message },
          { status: 500 }
        )
      }
    }

    // Priority 2: Check for head coach's team code (teams.team_id_code)
    // This is the main team code that head coaches generate and share
    if (!teamId) {
      const { data: teamByCode, error: teamCodeError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("team_id_code", normalizedCode)
        .maybeSingle()

      if (teamCodeError) {
        return NextResponse.json({ success: false, error: "Could not validate the code." }, { status: 500 })
      }

      if (teamByCode?.id) {
        teamId = teamByCode.id as string
      }
    }

    // Priority 3: Fall back to legacy team invite code (invites.code)
    if (!teamId) {
      const { data: invite, error: lookupError } = await supabase
        .from("invites")
        .select("id, team_id, uses, max_uses, expires_at")
        .eq("code", normalizedCode)
        .maybeSingle()

      if (lookupError) {
        return NextResponse.json({ success: false, error: "Could not validate the code." }, { status: 500 })
      }

      if (!invite || !invite.team_id) {
        return NextResponse.json(
          { success: false, error: "That code is not valid. Double-check it with your coach." },
          { status: 400 }
        )
      }

      const uses = typeof invite.uses === "number" ? invite.uses : 0
      const maxUses = typeof invite.max_uses === "number" ? invite.max_uses : Number.MAX_SAFE_INTEGER
      if (uses >= maxUses) {
        return NextResponse.json(
          { success: false, error: "This invite code has reached its maximum number of uses." },
          { status: 400 }
        )
      }

      if (invite.expires_at) {
        const expiresAt = new Date(invite.expires_at as string)
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
          return NextResponse.json(
            { success: false, error: "This invite code has expired. Ask your coach for a fresh one." },
            { status: 400 }
          )
        }
      }

      teamId = invite.team_id as string

      await supabase
        .from("invites")
        .update({ uses: uses + 1 })
        .eq("id", invite.id)
    }

    // If no team found after all checks, return error
    if (!teamId) {
      return NextResponse.json(
        { success: false, error: "That code is not valid. Double-check it with your coach." },
        { status: 400 }
      )
    }

    try {
      await supabase
        .from("users")
        .upsert(
          {
            id: userId,
            email: session.user.email ?? "",
            name: session.user.name ?? null,
            role: profileRoleToUserRole(session.user.role ?? "player"),
            status: "active",
          },
          { onConflict: "id" }
        )
    } catch {
      // best-effort; profile update is the source of truth for membership
    }

    // Update the user's profile to link them to the team (production source of truth; no team_members table)
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ team_id: teamId })
      .eq("id", userId)

    if (profileUpdateError) {
      return NextResponse.json(
        { success: false, error: "Failed to update your profile.", details: profileUpdateError.message },
        { status: 500 }
      )
    }

    // Fetch team name for the success message
    const { data: team } = await supabase
      .from("teams")
      .select("name")
      .eq("id", teamId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      teamId,
      teamName: team?.name ?? "your team",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: "An unexpected error occurred.", details: msg }, { status: 500 })
  }
}
