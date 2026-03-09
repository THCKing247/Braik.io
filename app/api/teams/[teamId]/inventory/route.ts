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
    
    // Verify team exists
    const { data: team, error: teamError } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (teamError) {
      console.error("[GET /api/teams/.../inventory] team lookup error", teamError)
      return NextResponse.json({ error: "Failed to verify team" }, { status: 500 })
    }
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    // Fetch inventory items and players
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
      console.error("[GET /api/teams/.../inventory] items error:", {
        message: itemsRes.error.message,
        details: itemsRes.error.details,
        hint: itemsRes.error.hint,
        code: itemsRes.error.code,
      })
      return NextResponse.json(
        { error: "Failed to load inventory", details: itemsRes.error.message },
        { status: 500 }
      )
    }
    if (playersRes.error) {
      console.error("[GET /api/teams/.../inventory] players error:", {
        message: playersRes.error.message,
        details: playersRes.error.details,
        hint: playersRes.error.hint,
        code: playersRes.error.code,
      })
      return NextResponse.json(
        { error: "Failed to load players", details: playersRes.error.message },
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
