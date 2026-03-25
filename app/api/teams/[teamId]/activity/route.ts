import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/**
 * GET /api/teams/[teamId]/activity?limit=50&actionType=profile_updated
 * Returns recent activity across all players on the team. Coach only.
 * actionType: optional filter (e.g. profile_updated, equipment_assigned, document_uploaded).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const actionType = searchParams.get("actionType")?.trim() || null
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    )

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can view team activity." }, { status: 403 })
    }

    const supabase = getSupabaseServer()

    let query = supabase
      .from("player_profile_activity")
      .select("id, player_id, team_id, actor_id, action_type, target_type, target_id, metadata_json, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (actionType) {
      query = query.eq("action_type", actionType)
    }
    const { data: rows, error } = await query

    if (error) {
      console.error("[GET /api/teams/.../activity]", error.message)
      return NextResponse.json({ error: "Failed to load activity" }, { status: 500 })
    }

    const actorIds = [...new Set((rows ?? []).map((r) => (r as { actor_id?: string }).actor_id).filter(Boolean))]
    const playerIds = [...new Set((rows ?? []).map((r) => (r as { player_id: string }).player_id))]
    let actorMap = new Map<string, { name: string | null; email: string }>()
    let playerMap = new Map<string, { firstName: string; lastName: string }>()

    if (actorIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", actorIds)
      actorMap = new Map(
        (users ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }])
      )
    }
    if (playerIds.length > 0) {
      const { data: players } = await supabase
        .from("players")
        .select("id, first_name, last_name")
        .in("id", playerIds)
      playerMap = new Map(
        (players ?? []).map((p) => [
          (p as { id: string }).id,
          {
            firstName: (p as { first_name: string | null }).first_name ?? "",
            lastName: (p as { last_name: string | null }).last_name ?? "",
          },
        ])
      )
    }

    const activities = (rows ?? []).map((r) => {
      const actor = (r as { actor_id?: string }).actor_id
        ? actorMap.get((r as { actor_id: string }).actor_id)
        : null
      const player = playerMap.get((r as { player_id: string }).player_id)
      return {
        id: (r as { id: string }).id,
        playerId: (r as { player_id: string }).player_id,
        playerName: player ? `${player.firstName} ${player.lastName}`.trim() || "Unknown" : "Unknown",
        actionType: (r as { action_type: string }).action_type,
        targetType: (r as { target_type?: string }).target_type ?? null,
        targetId: (r as { target_id?: string }).target_id ?? null,
        metadata: (r as { metadata_json?: Record<string, unknown> }).metadata_json ?? {},
        createdAt: (r as { created_at: string }).created_at,
        actor: actor ? { name: actor.name, email: actor.email } : null,
      }
    })

    return NextResponse.json(activities)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../activity]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
