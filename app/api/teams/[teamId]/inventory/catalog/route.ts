import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { loadInventoryArchiveAssignments } from "@/lib/teams/load-inventory-catalog"
import { revalidateTeamInventory } from "@/lib/cache/lightweight-get-cache"

const BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const
type Bucket = (typeof BUCKETS)[number]

function isBucket(s: string): s is Bucket {
  return (BUCKETS as readonly string[]).includes(s)
}

/**
 * Group-level catalog metadata and archive (coach UI).
 */
export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }
    await requireTeamAccessWithUser(teamId, session.user)
    const membership = await getUserMembership(teamId)
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const action = typeof body.action === "string" ? body.action : ""
    const supabase = getSupabaseServer()

    if (action === "upsert_catalog_type") {
      const inventoryBucket = String(body.inventoryBucket || "").trim()
      const equipmentTypeKey = String(body.equipmentTypeKey || "").trim()
      const oldInventoryBucket = String(body.oldInventoryBucket || "").trim()
      const oldEquipmentTypeKey = String(body.oldEquipmentTypeKey || "").trim()
      const displayName =
        typeof body.displayName === "string" ? body.displayName.trim() || null : null
      const iconKey = typeof body.iconKey === "string" ? body.iconKey.trim() || null : null

      if (!isBucket(inventoryBucket) || !equipmentTypeKey) {
        return NextResponse.json({ error: "Invalid bucket or equipment type" }, { status: 400 })
      }

      const renamed =
        oldInventoryBucket &&
        oldEquipmentTypeKey &&
        (oldInventoryBucket !== inventoryBucket || oldEquipmentTypeKey !== equipmentTypeKey)

      if (renamed) {
        if (!isBucket(oldInventoryBucket)) {
          return NextResponse.json({ error: "Invalid old bucket" }, { status: 400 })
        }
        const { data: rows, error: selErr } = await supabase
          .from("inventory_items")
          .select("id")
          .eq("team_id", teamId)
          .eq("archive_status", "active")
          .eq("inventory_bucket", oldInventoryBucket)
          .or(`equipment_type.eq.${oldEquipmentTypeKey},category.eq.${oldEquipmentTypeKey}`)

        if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })

        const ids = (rows ?? []).map((r) => (r as { id: string }).id)
        if (ids.length > 0) {
          const { error: upErr } = await supabase
            .from("inventory_items")
            .update({
              inventory_bucket: inventoryBucket,
              equipment_type: equipmentTypeKey,
              category: equipmentTypeKey,
            })
            .in("id", ids)
          if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
        }

        await supabase
          .from("inventory_item_types")
          .delete()
          .eq("team_id", teamId)
          .eq("inventory_bucket", oldInventoryBucket)
          .eq("equipment_type_key", oldEquipmentTypeKey)
      }

      const row = {
        team_id: teamId,
        inventory_bucket: inventoryBucket,
        equipment_type_key: equipmentTypeKey,
        display_name: displayName,
        icon_key: iconKey,
        updated_at: new Date().toISOString(),
      }
      const { error: upsertErr } = await supabase.from("inventory_item_types").upsert(row, {
        onConflict: "team_id,inventory_bucket,equipment_type_key",
      })
      if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

      await revalidateTeamInventory(teamId)
      return NextResponse.json({ ok: true })
    }

    if (action === "archive_catalog_group") {
      const inventoryBucket = String(body.inventoryBucket || "").trim()
      const equipmentTypeKey = String(body.equipmentTypeKey || "").trim()
      if (!isBucket(inventoryBucket) || !equipmentTypeKey) {
        return NextResponse.json({ error: "Invalid bucket or equipment type" }, { status: 400 })
      }

      const assigned = await loadInventoryArchiveAssignments(supabase, teamId, inventoryBucket, equipmentTypeKey)
      if (assigned.length > 0) {
        return NextResponse.json(
          { error: "Items are still assigned", assignedItems: assigned },
          { status: 409 }
        )
      }

      const typeOr = `equipment_type.eq.${equipmentTypeKey},category.eq.${equipmentTypeKey}`
      const { count: itemCount, error: cErr } = await supabase
        .from("inventory_items")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .eq("archive_status", "active")
        .eq("inventory_bucket", inventoryBucket)
        .or(typeOr)

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

      const { data: existingType } = await supabase
        .from("inventory_item_types")
        .select("id")
        .eq("team_id", teamId)
        .eq("inventory_bucket", inventoryBucket)
        .eq("equipment_type_key", equipmentTypeKey)
        .maybeSingle()

      const now = new Date().toISOString()
      if (existingType?.id) {
        const { error: typeUpErr } = await supabase
          .from("inventory_item_types")
          .update({
            archived_at: now,
            archived_by: session.user.id,
            updated_at: now,
          })
          .eq("id", (existingType as { id: string }).id)
        if (typeUpErr) return NextResponse.json({ error: typeUpErr.message }, { status: 500 })
      } else {
        const { error: typeInsErr } = await supabase.from("inventory_item_types").insert({
          team_id: teamId,
          inventory_bucket: inventoryBucket,
          equipment_type_key: equipmentTypeKey,
          archived_at: now,
          archived_by: session.user.id,
          updated_at: now,
        })
        if (typeInsErr) return NextResponse.json({ error: typeInsErr.message }, { status: 500 })
      }

      const { error: archErr } = await supabase
        .from("inventory_items")
        .update({ archive_status: "archived" })
        .eq("team_id", teamId)
        .eq("inventory_bucket", inventoryBucket)
        .eq("archive_status", "active")
        .or(typeOr)

      if (archErr) return NextResponse.json({ error: archErr.message }, { status: 500 })

      await revalidateTeamInventory(teamId)
      return NextResponse.json({ ok: true, archivedCount: itemCount ?? 0 })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /inventory/catalog]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
