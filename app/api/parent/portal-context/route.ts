import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  normalizePlayerAccountIdSegment,
  resolvePlayerUuidFromPublicRosterSegment,
} from "@/lib/roster/resolve-roster-player-segment"

export const runtime = "nodejs"

export type ParentPortalContextPayload = {
  teamId: string
  teamName: string
  sport: string | null
  playerId: string
  playerAccountSegment: string
  playerFirstName: string | null
  playerLastName: string | null
  playerPreferredName: string | null
  parentUserId: string
}

/**
 * Resolves linked-player + team for a parent portal URL segment (`player_account_id`).
 * Enforces `parent_player_links` for the signed-in parent (never impersonates the athlete).
 */
export async function GET(request: Request) {
  try {
    const auth = await getRequestAuth()
    if (!auth?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const linkCode = new URL(request.url).searchParams.get("linkCode")?.trim()
    if (!linkCode) {
      return NextResponse.json({ error: "linkCode is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const resolved = await resolvePlayerUuidFromPublicRosterSegment(supabase, linkCode)
    if (!resolved) {
      return NextResponse.json({ error: "Player not found for this code" }, { status: 404 })
    }

    const { playerUuid, teamId } = resolved

    const { data: link, error: linkErr } = await supabase
      .from("parent_player_links")
      .select("id")
      .eq("parent_user_id", auth.user.id)
      .eq("player_id", playerUuid)
      .maybeSingle()

    if (linkErr || !link) {
      return NextResponse.json({ error: "You are not linked to this athlete on Braik." }, { status: 403 })
    }

    const { data: player, error: pErr } = await supabase
      .from("players")
      .select("id, first_name, last_name, preferred_name, player_account_id, team_id")
      .eq("id", playerUuid)
      .eq("team_id", teamId)
      .maybeSingle()

    if (pErr || !player) {
      return NextResponse.json({ error: "Player record not found" }, { status: 404 })
    }

    const row = player as {
      id: string
      first_name?: string | null
      last_name?: string | null
      preferred_name?: string | null
      player_account_id?: string | null
      team_id: string
    }

    const { data: team } = await supabase
      .from("teams")
      .select("id, name, sport")
      .eq("id", teamId)
      .maybeSingle()

    const teamRow = team as { id?: string; name?: string | null; sport?: string | null } | null
    const seg =
      row.player_account_id != null
        ? normalizePlayerAccountIdSegment(String(row.player_account_id))
        : normalizePlayerAccountIdSegment(linkCode)

    const body: ParentPortalContextPayload = {
      teamId,
      teamName: (teamRow?.name as string) ?? "Team",
      sport: teamRow?.sport ?? null,
      playerId: row.id,
      playerAccountSegment: seg,
      playerFirstName: row.first_name ?? null,
      playerLastName: row.last_name ?? null,
      playerPreferredName: row.preferred_name ?? null,
      parentUserId: auth.user.id,
    }

    const res = NextResponse.json(body)
    if (auth.refreshedSession) {
      const { applyRefreshedSessionCookies } = await import("@/lib/auth/server-auth")
      applyRefreshedSessionCookies(res, auth.refreshedSession)
    }
    return res
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[GET /api/parent/portal-context]", err)
    return NextResponse.json({ error: "Failed to load parent portal context" }, { status: 500 })
  }
}
