import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import {
  resolveAmbiguousJoinCode,
  resolvePlayerByAccountIdAndTeamJoin,
  resolvePlayerInviteJoinEntry,
  resolveTeamJoinEntryOnly,
  type PlayerJoinEntryErrorCode,
} from "@/lib/players/resolve-player-join-entry"

const DEV = process.env.NODE_ENV === "development"

function jsonError(code: PlayerJoinEntryErrorCode | "server_error", message: string, status: number) {
  return NextResponse.json({ ok: false as const, code, error: message }, { status })
}

/**
 * POST /api/player/join/resolve-entry
 * Validates either a team join code (teams.player_code) or a player invite code (roster invite),
 * or resolves an ambiguous `code` (team first, then player).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      teamJoinCode?: string
      playerInviteCode?: string
      ambiguousCode?: string
      /** Roster Account ID — must be sent with `teamJoinCode` (pairs with team player_code). */
      playerAccountId?: string
    }

    const ambiguousRaw = typeof body.ambiguousCode === "string" ? body.ambiguousCode.trim() : ""
    const teamRaw = typeof body.teamJoinCode === "string" ? body.teamJoinCode.trim() : ""
    const playerRaw = typeof body.playerInviteCode === "string" ? body.playerInviteCode.trim() : ""
    const accountIdRaw = typeof body.playerAccountId === "string" ? body.playerAccountId.trim() : ""

    if (ambiguousRaw && (teamRaw || playerRaw || accountIdRaw)) {
      return jsonError(
        "both_provided",
        "Send either ambiguousCode or team/player fields — not both.",
        400
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      if (DEV) console.error("[POST /api/player/join/resolve-entry] admin client unavailable")
      return jsonError("server_error", "Server configuration error.", 500)
    }

    if (ambiguousRaw) {
      const result = await resolveAmbiguousJoinCode(supabase, ambiguousRaw)
      if (!result.ok) {
        const status =
          result.code === "missing_code"
            ? 400
            : result.code === "invalid_team_code" || result.code === "invalid_player_code"
              ? 404
              : result.code === "expired_player_invite" ||
                  result.code === "player_already_claimed" ||
                  result.code === "invite_max_uses"
                ? 400
                : 400
        return NextResponse.json({ ok: false, code: result.code, error: result.message }, { status })
      }
      return NextResponse.json(result)
    }

    if (accountIdRaw) {
      if (!teamRaw) {
        return jsonError("missing_code", "Enter your team code together with your account ID.", 400)
      }
      if (playerRaw) {
        return jsonError(
          "both_provided",
          "Use account ID + team code, or a player invite code — not both.",
          400
        )
      }
      const pairResult = await resolvePlayerByAccountIdAndTeamJoin(supabase, accountIdRaw, teamRaw)
      if (!pairResult.ok) {
        const status =
          pairResult.code === "invalid_team_code"
            ? 404
            : pairResult.code === "player_already_claimed" ||
                pairResult.code === "expired_player_invite" ||
                pairResult.code === "invite_max_uses"
              ? 400
              : 400
        return NextResponse.json({ ok: false, code: pairResult.code, error: pairResult.message }, { status })
      }
      return NextResponse.json(pairResult)
    }

    if (teamRaw && playerRaw) {
      return jsonError(
        "both_provided",
        "Enter either a team join code or a player invite code — not both.",
        400
      )
    }

    if (teamRaw) {
      const result = await resolveTeamJoinEntryOnly(supabase, teamRaw)
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, code: result.code, error: result.message },
          { status: result.code === "invalid_team_code" ? 404 : 400 }
        )
      }
      return NextResponse.json(result)
    }

    if (playerRaw) {
      const result = await resolvePlayerInviteJoinEntry(supabase, playerRaw, {
        rejectIfMatchesTeamJoinCode: true,
      })
      if (!result.ok) {
        const status =
          result.code === "player_code_is_team_code" || result.code === "invalid_player_code"
            ? 400
            : result.code === "expired_player_invite" ||
                result.code === "player_already_claimed" ||
                result.code === "invite_max_uses"
              ? 400
              : 400
        return NextResponse.json({ ok: false, code: result.code, error: result.message }, { status })
      }
      return NextResponse.json(result)
    }

    return jsonError("missing_code", "Enter a team join code or a player invite code.", 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[POST /api/player/join/resolve-entry]", msg)
    return jsonError("server_error", "Could not validate code.", 500)
  }
}
