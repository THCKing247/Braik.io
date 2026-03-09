import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/teams/[teamId]/inventory
 * Returns inventory items and players for the team (InventoryManager shape).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    const [itemsRes, playersRes] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, category, name, quantity_total, quantity_available, condition, assigned_to_player_id, notes, status")
        .eq("team_id", teamId)
        .order("name", { ascending: true }),
      supabase
        .from("players")
        .select("id, first_name, last_name, jersey_number")
        .eq("team_id", teamId)
        .order("last_name", { ascending: true }),
    ])

    if (itemsRes.error) {
      console.error("[GET /api/teams/.../inventory] items", itemsRes.error.message)
      return NextResponse.json(
        { error: "Failed to load inventory" },
        { status: 500 }
      )
    }
    if (playersRes.error) {
      console.error("[GET /api/teams/.../inventory] players", playersRes.error.message)
      return NextResponse.json(
        { error: "Failed to load players" },
        { status: 500 }
      )
    }

    const players = (playersRes.data ?? []).map((p) => ({
      id: p.id,
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      jerseyNumber: p.jersey_number ?? null,
    }))

    const playerMap = new Map(players.map((p) => [p.id, p]))

    const items = (itemsRes.data ?? []).map((i) => ({
      id: i.id,
      category: i.category ?? "",
      name: i.name ?? "",
      quantityTotal: i.quantity_total ?? 0,
      quantityAvailable: i.quantity_available ?? 0,
      condition: i.condition ?? "GOOD",
      assignedToPlayerId: i.assigned_to_player_id ?? null,
      notes: i.notes ?? null,
      status: i.status ?? "AVAILABLE",
      assignedPlayer: i.assigned_to_player_id
        ? playerMap.get(i.assigned_to_player_id)
          ? {
              id: playerMap.get(i.assigned_to_player_id)!.id,
              firstName: playerMap.get(i.assigned_to_player_id)!.firstName,
              lastName: playerMap.get(i.assigned_to_player_id)!.lastName,
              jerseyNumber: playerMap.get(i.assigned_to_player_id)!.jerseyNumber ?? null,
            }
          : null
        : null,
    }))

    return NextResponse.json({ items, players })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../inventory]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/inventory - Create item (stub)
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not migrated: use Supabase inventory_items insert." },
    { status: 501 }
  )
}
