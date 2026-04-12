import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { normalizePhone } from "@/lib/player-invite-auto-link"
import { logInviteAction } from "@/lib/audit/structured-logger"
import { resolveTrustedAppOrigin } from "@/lib/invites/resolve-invite-app-origin"
import { buildPlayerInviteSignupPath, buildPlayerJoinUrl } from "@/lib/invites/build-join-link"

function generateInviteCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  let code = ""
  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length]
  }
  return code
}

/** Secure, unguessable token for player invite links (32 bytes base64url). */
function generateSecureToken(): string {
  return randomBytes(32).toString("base64url")
}

/**
 * POST /api/roster/[playerId]/invite - Create or update a player invite (token + optional email/phone).
 * Returns join link so the player can open /signup/player?token=... without entering a code.
 * Sets `players.invite_code` (unique player code) and syncs a typed `invite_codes` row (`player_claim_invite`) for signup/redeem flows.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId } = await params
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const { requireTeamPermission } = await import("@/lib/auth/rbac")
    const supabase = getSupabaseServer()

    const { data: player, error: fetchErr } = await supabase
      .from("players")
      .select("id, team_id, user_id, invite_code, invite_status, email")
      .eq("id", playerId)
      .maybeSingle()

    if (fetchErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamPermission(player.team_id, "edit_roster")

    const originCheck = resolveTrustedAppOrigin({ request })
    if (!originCheck.ok) {
      console.error("[POST /api/roster/[playerId]/invite] app origin missing:", originCheck.message)
      return NextResponse.json({ error: originCheck.message, code: originCheck.code }, { status: 503 })
    }

    if ((player as { user_id?: string | null }).user_id) {
      return NextResponse.json(
        { error: "This player has already linked an account." },
        { status: 400 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as { email?: string | null; phone?: string | null }
    const inviteEmail =
      typeof body.email === "string" && body.email.trim()
        ? body.email.trim().toLowerCase()
        : (player as { email?: string | null }).email
          ? String((player as { email: string }).email).trim().toLowerCase()
          : null
    const invitePhone =
      typeof body.phone === "string" && body.phone.trim()
        ? normalizePhone(body.phone.trim())
        : null

    let code = (player as { invite_code?: string | null }).invite_code
    if (!code) {
      for (let attempt = 0; attempt < 5; attempt++) {
        code = generateInviteCode(8)
        const { data: existing } = await supabase
          .from("players")
          .select("id")
          .eq("invite_code", code)
          .maybeSingle()
        if (!existing) break
      }
      if (!code) {
        return NextResponse.json({ error: "Failed to generate unique invite code" }, { status: 500 })
      }
    }

    const token = generateSecureToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14)

    const { data: existingInvite } = await supabase
      .from("player_invites")
      .select("id")
      .eq("player_id", playerId)
      .in("status", ["pending", "sent"])
      .maybeSingle()

    if (existingInvite) {
      const { error: updateInviteErr } = await supabase
        .from("player_invites")
        .update({
          email: inviteEmail,
          phone: invitePhone,
          token,
          code,
          expires_at: expiresAt.toISOString(),
          created_by: session.user.id,
        })
        .eq("id", (existingInvite as { id: string }).id)
      if (updateInviteErr) {
        console.error("[POST /api/roster/[playerId]/invite] player_invites update", updateInviteErr)
        return NextResponse.json({ error: "Failed to update invite" }, { status: 500 })
      }
      logInviteAction("invite_created", { playerId, inviteId: (existingInvite as { id: string }).id })
    } else {
      const { data: inserted, error: insertInviteErr } = await supabase
        .from("player_invites")
        .insert({
          team_id: player.team_id,
          player_id: playerId,
          email: inviteEmail,
          phone: invitePhone,
          token,
          code,
          status: "pending",
          expires_at: expiresAt.toISOString(),
          created_by: session.user.id,
        })
        .select("id")
        .single()
      if (insertInviteErr) {
        console.error("[POST /api/roster/[playerId]/invite] player_invites insert", insertInviteErr)
        return NextResponse.json({ error: "Failed to create invite" }, { status: 500 })
      }
      if (inserted) logInviteAction("invite_created", { playerId, inviteId: (inserted as { id: string }).id })
    }

    const { data: updated, error } = await supabase
      .from("players")
      .update({ invite_code: code, invite_status: "invited" })
      .eq("id", playerId)
      .select()
      .single()

    if (error) {
      console.error("[POST /api/roster/[playerId]/invite]", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const teamIdForInvite = (player as { team_id: string }).team_id
    const { data: teamRow } = await supabase.from("teams").select("program_id").eq("id", teamIdForInvite).maybeSingle()
    const programIdForInvite = (teamRow as { program_id?: string | null } | null)?.program_id ?? null

    await supabase
      .from("invite_codes")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("invite_type", "player_claim_invite")
      .eq("target_player_id", playerId)
      .eq("is_active", true)

    const expiresAtIso = expiresAt.toISOString()
    const { error: typedInviteErr } = await supabase.from("invite_codes").insert({
      code,
      invite_type: "player_claim_invite",
      organization_id: null,
      program_id: programIdForInvite,
      team_id: teamIdForInvite,
      target_player_id: playerId,
      max_uses: 1,
      expires_at: expiresAtIso,
      is_active: true,
      created_by_user_id: session.user.id,
    })
    if (typedInviteErr) {
      console.warn("[POST /api/roster/[playerId]/invite] invite_codes player_claim_invite", typedInviteErr.message)
    }

    const joinBuilt = buildPlayerJoinUrl(token, request)
    const joinLink = joinBuilt.ok ? joinBuilt.url : `${originCheck.origin}${buildPlayerInviteSignupPath(token)}`

    const p = updated as { invite_code?: string | null; invite_status?: string }
    return NextResponse.json({
      inviteCode: p.invite_code ?? code,
      inviteStatus: (p.invite_status ?? "invited") as "invited",
      joinLink,
      token,
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      console.error("[POST /api/roster/[playerId]/invite] membership lookup failed (DB/schema)", err.message)
      return NextResponse.json({ error: "Failed to set invite" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/roster/[playerId]/invite]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
