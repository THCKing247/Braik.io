import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { normalizePhone } from "@/lib/player-invite-auto-link"

function generateInviteCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  let code = ""
  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length]
  }
  return code
}

/** Secure, unguessable token for /join?token=... (32 bytes base64url). */
function generateSecureToken(): string {
  return randomBytes(32).toString("base64url")
}

/**
 * POST /api/roster/[playerId]/invite - Create or update a player invite (token + optional email/phone).
 * Returns join link so the player can open /join?token=... without entering a code.
 * Legacy: still sets players.invite_code and invite_status for backward compatibility.
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
      .eq("status", "pending")
      .maybeSingle()

    if (existingInvite) {
      const { error: updateInviteErr } = await supabase
        .from("player_invites")
        .update({
          email: inviteEmail,
          phone: invitePhone,
          token,
          expires_at: expiresAt.toISOString(),
          created_by: session.user.id,
        })
        .eq("id", (existingInvite as { id: string }).id)
      if (updateInviteErr) {
        console.error("[POST /api/roster/[playerId]/invite] player_invites update", updateInviteErr)
        return NextResponse.json({ error: "Failed to update invite" }, { status: 500 })
      }
    } else {
      const { error: insertInviteErr } = await supabase.from("player_invites").insert({
        team_id: player.team_id,
        player_id: playerId,
        email: inviteEmail,
        phone: invitePhone,
        token,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        created_by: session.user.id,
      })
      if (insertInviteErr) {
        console.error("[POST /api/roster/[playerId]/invite] player_invites insert", insertInviteErr)
        return NextResponse.json({ error: "Failed to create invite" }, { status: 500 })
      }
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

    const origin =
      request.headers.get("x-forwarded-host") && request.headers.get("x-forwarded-proto")
        ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
        : process.env.NEXT_PUBLIC_APP_URL || (request.url ? new URL(request.url).origin : "") || ""
    const joinLink = origin ? `${origin}/join?token=${encodeURIComponent(token)}` : ""

    const p = updated as { invite_code?: string | null; invite_status?: string }
    return NextResponse.json({
      inviteCode: p.invite_code ?? code,
      inviteStatus: (p.invite_status ?? "invited") as "invited",
      joinLink: joinLink || undefined,
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
