import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"

const ACTIVITY_LIMIT = 15
const FOLLOW_UP_LIMIT = 100

/**
 * GET /api/teams/[teamId]/readiness-panel
 * Single round-trip for the roster Readiness tab: recent activity + open follow-ups.
 * Coach only. Avoids duplicate auth/session work from two parallel fetches.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can view readiness panel data." }, { status: 403 })
    }

    const supabase = getSupabaseServer()

    const [activityRes, followRes] = await Promise.all([
      supabase
        .from("player_profile_activity")
        .select(
          "id, player_id, team_id, actor_id, action_type, target_type, target_id, metadata_json, created_at"
        )
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_LIMIT),
      supabase
        .from("player_follow_ups")
        .select("id, player_id, team_id, category, status, note, created_by, created_at, resolved_at")
        .eq("team_id", teamId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(FOLLOW_UP_LIMIT),
    ])

    if (activityRes.error) {
      console.error("[GET /api/teams/.../readiness-panel] activity", activityRes.error.message)
      return NextResponse.json({ error: "Failed to load activity" }, { status: 500 })
    }
    if (followRes.error) {
      console.error("[GET /api/teams/.../readiness-panel] follow-ups", followRes.error.message)
      return NextResponse.json({ error: "Failed to load follow-ups" }, { status: 500 })
    }

    const activityRows = activityRes.data ?? []
    const followRows = followRes.data ?? []

    const actorIds = [...new Set(activityRows.map((r) => (r as { actor_id?: string }).actor_id).filter(Boolean))]
    const activityPlayerIds = [...new Set(activityRows.map((r) => (r as { player_id: string }).player_id))]
    const followPlayerIds = [...new Set(followRows.map((r) => (r as { player_id: string }).player_id))]
    const createdByIds = [
      ...new Set(
        followRows.map((r) => (r as { created_by: string | null }).created_by).filter(Boolean)
      ),
    ] as string[]

    const playerIdSet = new Set([...activityPlayerIds, ...followPlayerIds])
    const userIdSet = new Set([...actorIds, ...createdByIds])

    const [usersRes, playersRes] = await Promise.all([
      userIdSet.size > 0
        ? supabase.from("users").select("id, name, email").in("id", [...userIdSet])
        : { data: [] as { id: string; name: string | null; email: string }[] },
      playerIdSet.size > 0
        ? supabase.from("players").select("id, first_name, last_name").in("id", [...playerIdSet])
        : { data: [] as { id: string; first_name: string | null; last_name: string | null }[] },
    ])

    const actorMap = new Map(
      (usersRes.data ?? []).map((u) => [
        u.id,
        { name: (u as { name: string | null }).name ?? null, email: (u as { email: string }).email ?? "" },
      ])
    )
    const creatorMap = new Map(
      (usersRes.data ?? []).map((u) => [u.id, (u as { name: string | null }).name ?? "Unknown"])
    )
    const playerMap = new Map(
      (playersRes.data ?? []).map((p) => [
        (p as { id: string }).id,
        {
          firstName: (p as { first_name: string | null }).first_name ?? "",
          lastName: (p as { last_name: string | null }).last_name ?? "",
        },
      ])
    )

    const activity = activityRows.map((r) => {
      const row = r as {
        id: string
        player_id: string
        action_type: string
        target_type?: string
        target_id?: string
        metadata_json?: Record<string, unknown>
        created_at: string
        actor_id?: string
      }
      const actor = row.actor_id ? actorMap.get(row.actor_id) : null
      const player = playerMap.get(row.player_id)
      return {
        id: row.id,
        playerId: row.player_id,
        playerName: player ? `${player.firstName} ${player.lastName}`.trim() || "Unknown" : "Unknown",
        actionType: row.action_type,
        targetType: row.target_type ?? null,
        targetId: row.target_id ?? null,
        metadata: row.metadata_json ?? {},
        createdAt: row.created_at,
        actor: actor ? { name: actor.name, email: actor.email } : null,
      }
    })

    const nameForPlayer = (pid: string) => {
      const p = playerMap.get(pid)
      return p ? `${p.firstName} ${p.lastName}`.trim() || "Unknown" : "Unknown"
    }

    const followUps = followRows.map((r) => {
      const row = r as {
        id: string
        player_id: string
        team_id: string
        category: string
        status: string
        note: string | null
        created_by: string | null
        created_at: string
        resolved_at: string | null
      }
      return {
        id: row.id,
        playerId: row.player_id,
        playerName: nameForPlayer(row.player_id),
        teamId: row.team_id,
        category: row.category,
        status: row.status,
        note: row.note ?? null,
        createdBy: row.created_by ? creatorMap.get(row.created_by) ?? null : null,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      }
    })

    return NextResponse.json({ activity, followUps })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../readiness-panel]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
