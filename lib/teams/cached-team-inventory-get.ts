import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  lightweightCached,
  LW_TTL_TEAM_INVENTORY,
  tagTeamInventory,
} from "@/lib/cache/lightweight-get-cache"

const INVENTORY_BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const
type InventoryBucket = (typeof INVENTORY_BUCKETS)[number]

function normalizeBucket(v: unknown): InventoryBucket {
  const s = typeof v === "string" ? v.trim() : ""
  if (INVENTORY_BUCKETS.includes(s as InventoryBucket)) return s as InventoryBucket
  return "Gear"
}

function mapItemRow(
  i: Record<string, unknown>,
  playerMap: Map<string, { id: string; firstName: string; lastName: string; jerseyNumber: number | null }>
) {
  const assignedId = (i.assigned_to_player_id as string | null) ?? null
  const p = assignedId ? playerMap.get(assignedId) : undefined
  return {
    id: i.id as string,
    category: (i.category as string) ?? "",
    name: (i.name as string) ?? "",
    quantityTotal: (i.quantity_total as number) ?? 0,
    quantityAvailable: (i.quantity_available as number) ?? 0,
    condition: (i.condition as string) ?? "GOOD",
    assignedToPlayerId: assignedId,
    notes: (i.notes as string | null) ?? null,
    status: (i.status as string) ?? "AVAILABLE",
    equipmentType: (i.equipment_type as string | null) ?? null,
    size: (i.size as string | null) ?? null,
    make: (i.make as string | null) ?? null,
    itemCode: (i.item_code as string | null) ?? null,
    inventoryBucket: normalizeBucket(i.inventory_bucket),
    costPerUnit: i.cost_per_unit != null ? Number(i.cost_per_unit) : null,
    costNotes: (i.cost_notes as string | null) ?? null,
    costUpdatedAt: (i.cost_updated_at as string | null) ?? null,
    damageReportText: (i.damage_report_text as string | null) ?? null,
    damageReportedAt: (i.damage_reported_at as string | null) ?? null,
    damageReportedByPlayerId: (i.damage_reported_by_player_id as string | null) ?? null,
    assignedPlayer: assignedId
      ? p
        ? {
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            jerseyNumber: p.jerseyNumber ?? null,
          }
        : null
      : null,
  }
}

export type TeamInventoryGetPayload = {
  items: ReturnType<typeof mapItemRow>[]
  players: Array<{ id: string; firstName: string; lastName: string; jerseyNumber: number | null }>
}

async function loadTeamInventoryGetPayload(teamId: string): Promise<TeamInventoryGetPayload> {
  const supabase = getSupabaseServer()
  const [itemsRes, playersRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "id, category, name, quantity_total, quantity_available, condition, assigned_to_player_id, notes, status, equipment_type, size, make, item_code, inventory_bucket"
      )
      .eq("team_id", teamId)
      .order("name", { ascending: true }),
    supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number")
      .eq("team_id", teamId)
      .order("last_name", { ascending: true }),
  ])

  if (itemsRes.error) {
    throw new Error(itemsRes.error.message || "inventory_items query failed")
  }
  if (playersRes.error) {
    throw new Error(playersRes.error.message || "players query failed")
  }

  const players = (playersRes.data ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name ?? "",
    lastName: p.last_name ?? "",
    jerseyNumber: p.jersey_number ?? null,
  }))
  const playerMap = new Map(players.map((p) => [p.id, p]))
  const items = (itemsRes.data ?? []).map((i) => mapItemRow(i as Record<string, unknown>, playerMap))

  return { items, players }
}

export function getCachedTeamInventoryGetPayload(teamId: string): Promise<TeamInventoryGetPayload> {
  return lightweightCached(
    ["team-inventory-get-v1", teamId],
    { revalidate: LW_TTL_TEAM_INVENTORY, tags: [tagTeamInventory(teamId)] },
    () => loadTeamInventoryGetPayload(teamId)
  )
}
