import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { isLinkedParentOfPlayer } from "@/lib/player-documents/access"
import { loadPlayerPortalFilmPayload } from "@/lib/recruiting/recruiting-media"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

export const runtime = "nodejs"

/**
 * GET /api/roster/[playerAccountId]/attached-film?teamId=
 * Braik film attached to this player (portal rules: includes coach-only private film when attached).
 * Same access as player profile: coach, self, linked parent.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerAccountId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerAccountId: segment } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId || !segment) {
      return NextResponse.json({ error: "teamId and playerAccountId are required" }, { status: 400 })
    }

    const resolvedPlayerId = await resolveRosterApiPlayerUuid(teamId, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    const isCoach = membership ? canEditRoster(membership.role) : false

    const supabase = getSupabaseServer()

    const { data: player, error: pErr } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", resolvedPlayerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (pErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const row = player as { user_id: string | null }
    const isOwnProfile = row.user_id === session.user.id
    const isParentViewer = await isLinkedParentOfPlayer(supabase, session.user.id, resolvedPlayerId)

    if (!isCoach && !isOwnProfile && !isParentViewer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const film = await loadPlayerPortalFilmPayload(supabase, resolvedPlayerId, teamId)
    return NextResponse.json({ film })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: "You don't have access to this team." }, { status: 403 })
    }
    console.error("[GET /api/roster/[playerAccountId]/attached-film]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
