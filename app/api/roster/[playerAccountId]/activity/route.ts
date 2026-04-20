import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

/**
 * GET /api/roster/[playerId]/activity?teamId=xxx&limit=25&offset=0
 * Returns recent activity for this player. Coach: any player. Player: own profile only.
 * Response: { items, total, limit, offset } when offset or total is requested (page mode); else legacy array only.
 * Players see activity that is appropriate (e.g. photo/doc/equipment/stats; no sensitive audit detail).
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
    const actionType = searchParams.get("actionType")?.trim() || null
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    )
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0)
    const pageMode = searchParams.get("pageMode") === "1" || searchParams.has("offset")

    if (!segment || !teamId) {
      return NextResponse.json({ error: "playerId and teamId are required" }, { status: 400 })
    }

    const resolvedPlayerId = await resolveRosterApiPlayerUuid(teamId, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", resolvedPlayerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    const isCoach = membership ? canEditRoster(membership.role) : false
    const isOwn = (player as { user_id: string | null }).user_id === session.user.id
    if (!isCoach && !isOwn) {
      return NextResponse.json({ error: "You can only view your own profile activity." }, { status: 403 })
    }

    let query = supabase
      .from("player_profile_activity")
      .select("id, player_id, team_id, actor_id, action_type, target_type, target_id, metadata_json, created_at", {
        count: pageMode ? "exact" : undefined,
      })
      .eq("player_id", resolvedPlayerId)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)
    if (actionType) {
      query = query.eq("action_type", actionType)
    }
    const { data: rows, error, count } = await query

    if (error) {
      console.error("[GET /api/roster/.../activity]", error.message)
      return NextResponse.json({ error: "Failed to load activity" }, { status: 500 })
    }

    const actorIds = [...new Set((rows ?? []).map((r) => (r as { actor_id?: string }).actor_id).filter(Boolean))]
    let actorMap = new Map<string, { name: string | null; email: string }>()
    if (actorIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", actorIds)
      actorMap = new Map(
        (users ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }])
      )
    }

    const activities = (rows ?? []).map((r) => {
      const actor = (r as { actor_id?: string }).actor_id
        ? actorMap.get((r as { actor_id: string }).actor_id)
        : null
      return {
        id: (r as { id: string }).id,
        playerId: (r as { player_id: string }).player_id,
        actionType: (r as { action_type: string }).action_type,
        targetType: (r as { target_type?: string }).target_type ?? null,
        targetId: (r as { target_id?: string }).target_id ?? null,
        metadata: (r as { metadata_json?: Record<string, unknown> }).metadata_json ?? {},
        createdAt: (r as { created_at: string }).created_at,
        actor: actor ? { name: actor.name, email: actor.email } : null,
      }
    })

    if (pageMode) {
      return NextResponse.json({
        items: activities,
        total: count ?? activities.length,
        limit,
        offset,
      })
    }
    return NextResponse.json(activities)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/roster/.../activity]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
