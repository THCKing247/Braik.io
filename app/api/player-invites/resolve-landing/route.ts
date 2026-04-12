import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { normalizePlayerJoinCode } from "@/lib/players/join-code-normalize"

export type PlayerInviteResolveLandingResponse =
  | {
      ok: true
      teamName: string | null
      /** `teams.player_code` — prefill for team join-code field */
      teamJoinCode: string | null
      /** `player_invites.code` — short manual code, if set */
      inviteCode: string | null
      playerFirstName: string | null
      playerLastName: string | null
      jerseyNumber: number | null
      graduationYear: number | null
    }
  | { ok: false; error: string; code: "invalid_token" | "expired" | "already_claimed" | "server_error" }

/**
 * POST /api/player-invites/resolve-landing
 * Public: validates `player_invites.token` for the player signup landing page (no auth).
 * Does not expose sensitive roster data beyond the invited player’s own row.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: string }
    const raw = typeof body?.token === "string" ? body.token.trim() : ""
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "Token is required.", code: "invalid_token" } satisfies PlayerInviteResolveLandingResponse,
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      console.error("[POST /api/player-invites/resolve-landing] admin client unavailable")
      return NextResponse.json(
        { ok: false, error: "Server configuration error.", code: "server_error" } satisfies PlayerInviteResolveLandingResponse,
        { status: 500 }
      )
    }

    const { data: invite, error: invErr } = await supabase
      .from("player_invites")
      .select("id, team_id, player_id, status, expires_at, code")
      .eq("token", raw)
      .maybeSingle()

    if (invErr) {
      console.error("[POST /api/player-invites/resolve-landing] invite lookup", invErr.message)
      return NextResponse.json(
        { ok: false, error: "Could not validate invite.", code: "server_error" } satisfies PlayerInviteResolveLandingResponse,
        { status: 500 }
      )
    }

    if (!invite) {
      return NextResponse.json(
        { ok: false, error: "This invite link is invalid or has been revoked.", code: "invalid_token" } satisfies PlayerInviteResolveLandingResponse,
        { status: 404 }
      )
    }

    const status = (invite as { status: string }).status
    if (status !== "pending" && status !== "sent") {
      return NextResponse.json(
        { ok: false, error: "This invite has already been used or is no longer valid.", code: "already_claimed" } satisfies PlayerInviteResolveLandingResponse,
        { status: 400 }
      )
    }

    const expiresAt = (invite as { expires_at?: string | null }).expires_at
    if (expiresAt) {
      const exp = new Date(expiresAt)
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        return NextResponse.json(
          { ok: false, error: "This invite has expired. Ask your coach for a new link.", code: "expired" } satisfies PlayerInviteResolveLandingResponse,
          { status: 400 }
        )
      }
    }

    const teamId = (invite as { team_id: string }).team_id
    const playerId = (invite as { player_id: string }).player_id

    const [{ data: team }, { data: player }] = await Promise.all([
      supabase.from("teams").select("name, player_code").eq("id", teamId).maybeSingle(),
      supabase
        .from("players")
        .select("first_name, last_name, jersey_number, graduation_year, user_id")
        .eq("id", playerId)
        .maybeSingle(),
    ])

    if ((player as { user_id?: string | null } | null)?.user_id) {
      return NextResponse.json(
        { ok: false, error: "This roster spot is already linked to an account.", code: "already_claimed" } satisfies PlayerInviteResolveLandingResponse,
        { status: 400 }
      )
    }

    const teamName =
      team && typeof (team as { name?: string }).name === "string"
        ? (team as { name: string }).name.trim() || null
        : null
    const rawPc = (team as { player_code?: string | null } | null)?.player_code
    const teamJoinCode =
      typeof rawPc === "string" && rawPc.trim()
        ? normalizePlayerJoinCode(rawPc)
        : null

    const inviteCodeRaw = (invite as { code?: string | null }).code
    const inviteCode =
      typeof inviteCodeRaw === "string" && inviteCodeRaw.trim() ? inviteCodeRaw.trim().toUpperCase() : null

    const payload: PlayerInviteResolveLandingResponse = {
      ok: true,
      teamName,
      teamJoinCode,
      inviteCode,
      playerFirstName:
        typeof (player as { first_name?: string } | null)?.first_name === "string"
          ? (player as { first_name: string }).first_name.trim() || null
          : null,
      playerLastName:
        typeof (player as { last_name?: string } | null)?.last_name === "string"
          ? (player as { last_name: string }).last_name.trim() || null
          : null,
      jerseyNumber:
        typeof (player as { jersey_number?: number | null }).jersey_number === "number"
          ? (player as { jersey_number: number }).jersey_number
          : null,
      graduationYear:
        typeof (player as { graduation_year?: number | null }).graduation_year === "number"
          ? (player as { graduation_year: number }).graduation_year
          : null,
    }

    return NextResponse.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[POST /api/player-invites/resolve-landing]", msg)
    return NextResponse.json(
      { ok: false, error: "Could not validate invite.", code: "server_error" } satisfies PlayerInviteResolveLandingResponse,
      { status: 500 }
    )
  }
}
