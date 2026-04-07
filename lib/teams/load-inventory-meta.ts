import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  canApproveInventoryConditionReports,
  canSubmitInventoryConditionReport,
} from "@/lib/inventory-condition-permissions"
import type { UserMembership } from "@/lib/auth/rbac"

export type InventoryTypeTotalRow = {
  inventoryBucket: string
  equipmentType: string
  totalLineCost: number
}

export type InventoryTabStats = {
  total: number
  available: number
  assigned: number
  needsAttention: number
}

export async function loadInventoryMeta(
  teamId: string,
  membership: UserMembership | null,
  opts: { bucketFilter: string }
): Promise<{
  typeTotals: InventoryTypeTotalRow[]
  tabStats: InventoryTabStats
  pendingConditionReportCount: number
}> {
  const supabase = getSupabaseServer()
  const bucket = opts.bucketFilter

  let pendingConditionReportCount = 0
  if (membership && canApproveInventoryConditionReports(membership)) {
    const { count } = await supabase
      .from("inventory_condition_reports")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "pending")
    pendingConditionReportCount = count ?? 0
  }

  let qTotal = supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("team_id", teamId)
  let qAvail = supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .is("assigned_to_player_id", null)
    .eq("status", "AVAILABLE")
  let qAssign = supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .not("assigned_to_player_id", "is", null)
  let qAttn = supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .or("status.eq.NEEDS_REPAIR,status.eq.DAMAGED,status.eq.MISSING,condition.eq.NEEDS_REPAIR,condition.eq.REPLACE")

  if (bucket && bucket !== "All") {
    qTotal = qTotal.eq("inventory_bucket", bucket)
    qAvail = qAvail.eq("inventory_bucket", bucket)
    qAssign = qAssign.eq("inventory_bucket", bucket)
    qAttn = qAttn.eq("inventory_bucket", bucket)
  }

  const [totalsRes, totalRes, availRes, assignRes, attnRes] = await Promise.all([
    supabase.from("inventory_type_totals").select("inventory_bucket, equipment_type, total_line_cost").eq("team_id", teamId),
    qTotal,
    qAvail,
    qAssign,
    qAttn,
  ])

  if (totalsRes.error) throw new Error(totalsRes.error.message)
  if (totalRes.error) throw new Error(totalRes.error.message)
  if (availRes.error) throw new Error(availRes.error.message)
  if (assignRes.error) throw new Error(assignRes.error.message)
  if (attnRes.error) throw new Error(attnRes.error.message)

  const typeTotals: InventoryTypeTotalRow[] = (totalsRes.data ?? []).map((r) => {
    const row = r as { inventory_bucket: string; equipment_type: string; total_line_cost: number }
    return {
      inventoryBucket: row.inventory_bucket,
      equipmentType: row.equipment_type,
      totalLineCost: Number(row.total_line_cost) || 0,
    }
  })

  return {
    typeTotals,
    tabStats: {
      total: totalRes.count ?? 0,
      available: availRes.count ?? 0,
      assigned: assignRes.count ?? 0,
      needsAttention: attnRes.count ?? 0,
    },
    pendingConditionReportCount,
  }
}

export function inventoryViewerFromMembership(membership: UserMembership | null) {
  return membership
    ? {
        canReportCondition: canSubmitInventoryConditionReport(membership),
        canApproveConditionReports: canApproveInventoryConditionReports(membership),
      }
    : { canReportCondition: false, canApproveConditionReports: false }
}

export type UnitCostChangeEvent = {
  inventoryBucket: string
  equipmentType: string
  newCost: number | null
  changedAt: string
}

/** Bootstrap payload for paginated inventory UI: no item rows — parallel-friendly. */
export async function loadInventoryBootstrap(
  teamId: string,
  membership: UserMembership | null,
  opts: { bucketFilter: string }
): Promise<{
  players: Array<{ id: string; firstName: string; lastName: string; jerseyNumber: number | null }>
  recentUnitCostChanges: UnitCostChangeEvent[]
  typeTotals: InventoryTypeTotalRow[]
  tabStats: InventoryTabStats
  pendingConditionReportCount: number
}> {
  const supabase = getSupabaseServer()

  const [playersRes, eventsRes, metaPack] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number")
      .eq("team_id", teamId)
      .order("last_name", { ascending: true }),
    supabase
      .from("inventory_unit_cost_events")
      .select("inventory_bucket, equipment_type, new_cost, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(3),
    loadInventoryMeta(teamId, membership, opts),
  ])

  if (playersRes.error) throw new Error(playersRes.error.message)
  if (eventsRes.error) throw new Error(eventsRes.error.message)

  const players = (playersRes.data ?? []).map((p) => {
    const row = p as { id: string; first_name: string | null; last_name: string | null; jersey_number: number | null }
    return {
      id: row.id,
      firstName: row.first_name ?? "",
      lastName: row.last_name ?? "",
      jerseyNumber: row.jersey_number ?? null,
    }
  })

  const recentUnitCostChanges: UnitCostChangeEvent[] = (eventsRes.data ?? []).map((e) => {
    const row = e as { inventory_bucket: string; equipment_type: string; new_cost: number | null; created_at: string }
    return {
      inventoryBucket: row.inventory_bucket,
      equipmentType: row.equipment_type,
      newCost: row.new_cost != null ? Number(row.new_cost) : null,
      changedAt: row.created_at,
    }
  })

  return {
    players,
    recentUnitCostChanges,
    typeTotals: metaPack.typeTotals,
    tabStats: metaPack.tabStats,
    pendingConditionReportCount: metaPack.pendingConditionReportCount,
  }
}
