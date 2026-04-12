import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { buildPlayerJoinUrl } from "@/lib/invites/build-join-link"
import { normalizePhone } from "@/lib/invites/normalize-phone"
import { sendSMS } from "@/lib/twilio/sendSms"
import { logInviteAction } from "@/lib/audit/structured-logger"

/** Build transactional Braik invite SMS. Short, carrier-friendly, GSM-7 safe. */
function buildInviteSmsBody(options: {
  inviteLink: string
  coachName?: string | null
  teamName?: string | null
  playerName?: string | null
}): string {
  const { inviteLink, coachName, teamName, playerName } = options
  const coach = (typeof coachName === "string" && coachName.trim()) ? coachName.trim() : null
  const team = (typeof teamName === "string" && teamName.trim()) ? teamName.trim() : null

  let intro: string
  if (coach && team) {
    intro = `Braik: Coach ${coach} invited you to join ${team}.`
  } else if (coach) {
    intro = `Braik: Coach ${coach} invited you to join your team.`
  } else if (team) {
    intro = `Braik: You're invited to join ${team}.`
  } else {
    intro = "Braik: You're invited to join your team."
  }

  const lines = [intro, `Join: ${inviteLink}`, "Reply STOP to opt out."]
  if (playerName && typeof playerName === "string" && playerName.trim()) {
    lines.unshift(`Hi ${playerName.trim()},`)
  }
  return lines.join("\n").trim()
}

/** Lightweight E.164-style check: must start with + and have enough digits. */
function isValidE164(phone: string): boolean {
  const digits = phone.replace(/\D/g, "")
  return phone.startsWith("+") && digits.length >= 10
}

const allowDirectSms =
  process.env.BRAIK_ALLOW_DIRECT_SMS === "true" || process.env.NODE_ENV !== "production"

/**
 * POST /api/player-invites/send-sms
 * Body (coach flow): { playerId: string }
 * Body (direct): { phone: string, inviteLink: string, playerName?, teamName?, coachName? }
 * Sends invite SMS via Twilio. Requires auth. Uses TWILIO_PHONE_NUMBER.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      playerId?: string
      phone?: string
      inviteLink?: string
      playerName?: string
      teamName?: string
      coachName?: string
    }

    const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : ""
    const phoneRaw = typeof body?.phone === "string" ? body.phone.trim() : ""
    const inviteLink = typeof body?.inviteLink === "string" ? body.inviteLink.trim() : ""
    const playerName = typeof body?.playerName === "string" ? body.playerName.trim() || undefined : undefined
    const teamName = typeof body?.teamName === "string" ? body.teamName.trim() || undefined : undefined
    const coachName = typeof body?.coachName === "string" ? body.coachName.trim() || undefined : undefined

    // --- Direct send: phone + inviteLink provided (e.g. testing or server-to-server) ---
    if (phoneRaw && inviteLink && !playerId) {
      if (!allowDirectSms) {
        return NextResponse.json(
          {
            error:
              "Direct SMS to an arbitrary number is disabled. Use the roster invite flow so consent is tied to the player record.",
            code: "DIRECT_SMS_DISABLED",
          },
          { status: 403 }
        )
      }
      const toPhone = normalizePhone(phoneRaw)
      if (!toPhone || !isValidE164(toPhone)) {
        return NextResponse.json(
          { error: "Invalid phone number", code: "INVALID_PHONE" },
          { status: 400 }
        )
      }
      const smsBody = buildInviteSmsBody({
        inviteLink,
        coachName: coachName ?? null,
        teamName: teamName ?? null,
        playerName: playerName ?? null,
      })
      console.log("[POST /api/player-invites/send-sms] direct send", { to: toPhone.slice(0, 6) + "***" })
      try {
        const result = await sendSMS(toPhone, smsBody)
        return NextResponse.json({ success: true, sid: result.sid })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Twilio send failed"
        console.error("[POST /api/player-invites/send-sms] Twilio error", { message: msg })
        return NextResponse.json(
          { error: "Failed to send SMS.", code: "SMS_SEND_FAILED" },
          { status: 502 }
        )
      }
    }

    // --- Coach flow: playerId required ---
    if (!playerId) {
      return NextResponse.json(
        { error: "Either playerId or (phone and inviteLink) is required" },
        { status: 400 }
      )
    }

    console.log("[POST /api/player-invites/send-sms] coach flow", { playerId })

    const supabase = getSupabaseServer()

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id, first_name, last_name, player_phone, user_id, sms_opt_in")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamPermission((player as { team_id: string }).team_id, "edit_roster")

    if ((player as { user_id?: string | null }).user_id) {
      return NextResponse.json({ error: "This player has already linked an account." }, { status: 400 })
    }

    const rawPhone = (player as { player_phone?: string | null }).player_phone
    const phoneStr = typeof rawPhone === "string" ? rawPhone.trim() : ""
    if (!phoneStr) {
      logInviteAction("send_sms_skipped", { playerId, reason: "missing_phone" })
      return NextResponse.json({ error: "Missing phone", code: "MISSING_PHONE" }, { status: 400 })
    }

    const optedIn = Boolean((player as { sms_opt_in?: boolean | null }).sms_opt_in)
    if (!optedIn) {
      logInviteAction("send_sms_skipped", { playerId, reason: "sms_not_opted_in" })
      return NextResponse.json(
        {
          error:
            "Transactional SMS requires consent on file for this mobile number. Update the player profile: enter the phone number and confirm SMS consent, then try again.",
          code: "SMS_CONSENT_REQUIRED",
        },
        { status: 400 }
      )
    }

    const toPhone = normalizePhone(phoneStr)
    if (!toPhone || !isValidE164(toPhone)) {
      return NextResponse.json({ error: "Invalid phone number", code: "INVALID_PHONE" }, { status: 400 })
    }

    const { data: invite, error: inviteErr } = await supabase
      .from("player_invites")
      .select("id, token, code, status")
      .eq("player_id", playerId)
      .in("status", ["pending", "sent"])
      .maybeSingle()

    if (inviteErr || !invite) {
      return NextResponse.json({ error: "No pending invite found for this player. Create an invite first." }, { status: 404 })
    }

    const token = (invite as { token: string }).token
    const joinResult = buildPlayerJoinUrl(token, request)
    if (!joinResult.ok) {
      console.error("[POST /api/player-invites/send-sms] join URL:", joinResult.message)
      return NextResponse.json(
        { error: joinResult.message, code: joinResult.code },
        { status: 503 }
      )
    }
    const joinLink = joinResult.url
    const playerDisplayName = `${(player as { first_name: string }).first_name} ${(player as { last_name: string }).last_name}`.trim() || undefined

    // Optional: fetch team name for message
    let teamDisplayName: string | undefined
    const { data: teamRow } = await supabase
      .from("teams")
      .select("name")
      .eq("id", (player as { team_id: string }).team_id)
      .maybeSingle()
    if (teamRow && typeof (teamRow as { name?: string }).name === "string") {
      teamDisplayName = (teamRow as { name: string }).name.trim() || undefined
    }

    const coachDisplayName = session.user.name?.trim() || undefined
    const smsBody = buildInviteSmsBody({
      inviteLink: joinLink,
      coachName: coachDisplayName,
      teamName: teamDisplayName,
      playerName: playerDisplayName,
    })

    let sid: string
    try {
      const result = await sendSMS(toPhone, smsBody)
      sid = result.sid
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Twilio send failed"
      console.error("[POST /api/player-invites/send-sms] Twilio error", { playerId, message: msg })
      await supabase
        .from("player_invites")
        .update({ sms_error: msg })
        .eq("id", (invite as { id: string }).id)
      logInviteAction("send_sms_failure", { playerId, inviteId: (invite as { id: string }).id, error: msg })
      return NextResponse.json(
        { error: "Failed to send SMS.", code: "SMS_SEND_FAILED" },
        { status: 502 }
      )
    }

    await supabase
      .from("player_invites")
      .update({
        sent_sms_at: new Date().toISOString(),
        sms_error: null,
        status: "sent",
      })
      .eq("id", (invite as { id: string }).id)
    logInviteAction("send_sms_success", { playerId, inviteId: (invite as { id: string }).id })
    return NextResponse.json({ success: true, sid })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[POST /api/player-invites/send-sms] membership lookup failed", err.message)
      return NextResponse.json({ error: "Failed to send invite" }, { status: 500 })
    }
    const msg = err instanceof Error ? err.message : "Internal server error"
    if (msg.includes("Access denied") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[POST /api/player-invites/send-sms]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
