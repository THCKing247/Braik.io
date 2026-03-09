import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/roster?teamId=xxx
 * Returns team roster (players) for RosterManagerEnhanced.
 * Resolves team from query; enforces team membership.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const { data: rows, error } = await supabase
      .from("players")
      .select("id, first_name, last_name, grade, jersey_number, position_group, status, notes, image_url, user_id")
      .eq("team_id", teamId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })

    if (error) {
      console.error("[GET /api/roster]", error.message, error)
      return NextResponse.json(
        { error: "Failed to load roster" },
        { status: 500 }
      )
    }

    type Row = { id: string; first_name: string; last_name: string; grade: number | null; jersey_number: number | null; position_group: string | null; status: string; notes: string | null; image_url: string | null; user_id: string | null }
    const typedRows = (rows ?? []) as Row[]
    const userIds = [...new Set(typedRows.map((r) => r.user_id).filter(Boolean))] as string[]
    let userMap = new Map<string, { id: string; email: string }>()
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, email")
        .in("id", userIds)
      userMap = new Map((users ?? []).map((u) => [u.id, u]))
    }

    const players = typedRows.map((p) => ({
      id: p.id,
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      grade: p.grade ?? null,
      jerseyNumber: p.jersey_number ?? null,
      positionGroup: p.position_group ?? null,
      status: p.status ?? "active",
      notes: p.notes ?? null,
      imageUrl: p.image_url ?? null,
      user: p.user_id ? (userMap.get(p.user_id) ? { email: userMap.get(p.user_id)!.email } : null) : null,
      guardianLinks: [] as Array<{ guardian: { user: { email: string } } }>,
    }))

    return NextResponse.json(players)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/roster]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/roster - Add player (Supabase)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const teamId = body?.teamId
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const { requireTeamPermission } = await import("@/lib/auth/rbac")
    await requireTeamPermission(teamId, "edit_roster")

    const firstName = String(body?.firstName ?? "").trim()
    const lastName = String(body?.lastName ?? "").trim()
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error } = await supabase
      .from("players")
      .insert({
        team_id: teamId,
        first_name: firstName,
        last_name: lastName,
        grade: body?.grade ?? null,
        jersey_number: body?.jerseyNumber ?? null,
        position_group: body?.positionGroup ?? null,
        notes: body?.notes ?? null,
        status: "active",
      })
      .select()
      .single()

    if (error || !player) {
      console.error("[POST /api/roster]", error?.message, error)
      return NextResponse.json(
        { error: error?.message ?? "Failed to add player" },
        { status: 500 }
      )
    }

    const out = {
      id: player.id,
      firstName: player.first_name,
      lastName: player.last_name,
      grade: player.grade ?? null,
      jerseyNumber: player.jersey_number ?? null,
      positionGroup: player.position_group ?? null,
      status: player.status ?? "active",
      notes: player.notes ?? null,
      imageUrl: player.image_url ?? null,
      user: null as { email: string } | null,
      guardianLinks: [] as Array<{ guardian: { user: { email: string } } }>,
    }
    return NextResponse.json(out)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/roster]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
