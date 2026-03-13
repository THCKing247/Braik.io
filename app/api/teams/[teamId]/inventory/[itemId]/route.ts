import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { logPlayerProfileActivity, PLAYER_PROFILE_ACTION_TYPES } from "@/lib/player-profile-activity"

/**
 * PATCH /api/teams/[teamId]/inventory/[itemId] - Update inventory item
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; itemId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, itemId } = await params
    if (!teamId || !itemId) {
      return NextResponse.json({ error: "teamId and itemId are required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)

    const body = await request.json()
    const supabase = getSupabaseServer()

    // Verify item belongs to team and get current assignment
    const { data: existingItem } = await supabase
      .from("inventory_items")
      .select("id, team_id, assigned_to_player_id")
      .eq("id", itemId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const previousPlayerId = (existingItem as { assigned_to_player_id?: string | null }).assigned_to_player_id ?? null
    const newPlayerId = body.assignedToPlayerId ?? null

    // Build update object
    const updateData: any = {}
    if (body.assignedToPlayerId !== undefined) {
      updateData.assigned_to_player_id = body.assignedToPlayerId || null
    }
    if (body.quantityAvailable !== undefined) {
      updateData.quantity_available = body.quantityAvailable
    }
    if (body.condition !== undefined) {
      updateData.condition = body.condition
    }
    if (body.status !== undefined) {
      updateData.status = body.status
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("inventory_items")
      .update(updateData)
      .eq("id", itemId)
      .select()
      .single()

    if (updateError) {
      console.error("[PATCH /api/teams/.../inventory/[itemId]]", updateError)
      return NextResponse.json({ error: "Failed to update item" }, { status: 500 })
    }

    if (newPlayerId && newPlayerId !== previousPlayerId) {
      await logPlayerProfileActivity({
        playerId: newPlayerId,
        teamId,
        actorId: session.user.id,
        actionType: PLAYER_PROFILE_ACTION_TYPES.EQUIPMENT_ASSIGNED,
        targetType: "inventory_item",
        targetId: itemId,
        metadata: { itemName: updatedItem.name ?? "" },
      })
    }
    if (previousPlayerId && previousPlayerId !== newPlayerId) {
      await logPlayerProfileActivity({
        playerId: previousPlayerId,
        teamId,
        actorId: session.user.id,
        actionType: PLAYER_PROFILE_ACTION_TYPES.EQUIPMENT_UNASSIGNED,
        targetType: "inventory_item",
        targetId: itemId,
        metadata: { itemName: updatedItem.name ?? "" },
      })
    }

    // Fetch player info if assigned
    let assignedPlayer: {
      id: string
      firstName: string
      lastName: string
      jerseyNumber: number | null
    } | null = null
    if (updatedItem.assigned_to_player_id) {
      const { data: player } = await supabase
        .from("players")
        .select("id, first_name, last_name, jersey_number")
        .eq("id", updatedItem.assigned_to_player_id)
        .maybeSingle()

      if (player) {
        assignedPlayer = {
          id: player.id,
          firstName: player.first_name ?? "",
          lastName: player.last_name ?? "",
          jerseyNumber: player.jersey_number ?? null,
        }
      }
    }

    return NextResponse.json({
      id: updatedItem.id,
      category: updatedItem.category ?? "",
      name: updatedItem.name ?? "",
      quantityTotal: updatedItem.quantity_total ?? 1,
      quantityAvailable: updatedItem.quantity_available ?? 0,
      condition: updatedItem.condition ?? "GOOD",
      assignedToPlayerId: updatedItem.assigned_to_player_id ?? null,
      notes: updatedItem.notes ?? null,
      status: updatedItem.status ?? "AVAILABLE",
      equipmentType: updatedItem.equipment_type ?? null,
      assignedPlayer,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[PATCH /api/teams/.../inventory/[itemId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/teams/[teamId]/inventory/[itemId] - Delete inventory item
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; itemId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, itemId } = await params
    if (!teamId || !itemId) {
      return NextResponse.json({ error: "teamId and itemId are required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()

    // Verify item belongs to team
    const { data: existingItem } = await supabase
      .from("inventory_items")
      .select("id, team_id")
      .eq("id", itemId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", itemId)

    if (deleteError) {
      console.error("[DELETE /api/teams/.../inventory/[itemId]]", deleteError)
      return NextResponse.json({ error: "Failed to delete item" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[DELETE /api/teams/.../inventory/[itemId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
