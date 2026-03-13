import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"

/**
 * GET /api/teams/[teamId]/follow-ups?status=open&limit=50
 * List follow-ups across the team (for readiness view / dashboard). Coach only.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")?.trim() || "open"
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 200)

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Only coaches can view team follow-ups." }, { status: 403 })
    }

    const supabase = getSupabaseServer()

    let query = supabase
      .from("player_follow_ups")
      .select("id, player_id, team_id, category, status, note, created_by, created_at, resolved_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (status === "open" || status === "resolved") {
      query = query.eq("status", status)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error("[GET /api/teams/.../follow-ups]", error.message)
      return NextResponse.json({ error: "Failed to load follow-ups" }, { status: 500 })
    }

    const playerIds = [...new Set((rows ?? []).map((r) => (r as { player_id: string }).player_id))]
    const createdByIds = [...new Set((rows ?? []).map((r) => (r as { created_by: string | null }).created_by).filter(Boolean))] as string[]

    const [playersRes, usersRes] = await Promise.all([
      playerIds.length > 0
        ? supabase.from("players").select("id, first_name, last_name").in("id", playerIds)
        : { data: [] },
      createdByIds.length > 0
        ? supabase.from("users").select("id, name").in("id", createdByIds)
        : { data: [] },
    ])

    const playerMap = new Map(
      (playersRes.data ?? []).map((p) => [
        (p as { id: string }).id,
        `${(p as { first_name: string | null }).first_name ?? ""} ${(p as { last_name: string | null }).last_name ?? ""}`.trim() || "Unknown",
      ])
    )
    const creatorMap = new Map(
      (usersRes.data ?? []).map((u) => [u.id, (u as { name: string | null }).name ?? "Unknown"])
    )

    const list = (rows ?? []).map((r) => {
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
        playerName: playerMap.get(row.player_id) ?? "Unknown",
        teamId: row.team_id,
        category: row.category,
        status: row.status,
        note: row.note ?? null,
        createdBy: row.created_by ? creatorMap.get(row.created_by) ?? null : null,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      }
    })

    return NextResponse.json(list)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../follow-ups]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
