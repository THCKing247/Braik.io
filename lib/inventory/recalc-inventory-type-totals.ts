import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeInventoryBucketLabel } from "@/lib/inventory-category-policy"

const BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const

function normBucket(v: string | null | undefined): string {
  const s = (v ?? "").trim()
  return BUCKETS.includes(s as (typeof BUCKETS)[number]) ? s : "Gear"
}

function typeKey(bucket: string, equipmentType: string): string {
  return `${normalizeInventoryBucketLabel(bucket)}|${equipmentType.trim() || "Other"}`
}

/**
 * Recomputes inventory_type_totals for a team: batch totals (active + phasing_out) + legacy items (no batch) line cost.
 */
export async function recalcInventoryTypeTotalsForTeam(supabase: SupabaseClient, teamId: string): Promise<void> {
  const [itemsRes, costsRes, batchesRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("inventory_bucket, equipment_type, category, quantity_total, cost_per_unit, equipment_batch_id")
      .eq("team_id", teamId),
    supabase.from("inventory_unit_costs").select("inventory_bucket, equipment_type, unit_cost").eq("team_id", teamId),
    supabase
      .from("equipment_batches")
      .select("inventory_bucket, equipment_type, quantity, unit_cost, status")
      .eq("team_id", teamId),
  ])

  if (itemsRes.error) throw new Error(itemsRes.error.message)
  if (costsRes.error) throw new Error(costsRes.error.message)
  if (batchesRes.error) throw new Error(batchesRes.error.message)

  const unitCostByKey = new Map<string, number | null>()
  for (const row of costsRes.data ?? []) {
    const r = row as { inventory_bucket: string; equipment_type: string; unit_cost: number | null }
    unitCostByKey.set(typeKey(r.inventory_bucket, r.equipment_type), r.unit_cost != null ? Number(r.unit_cost) : null)
  }

  const totals = new Map<string, { bucket: string; type: string; v: number }>()

  function add(bucket: string, et: string, delta: number) {
    const b = normBucket(bucket)
    const t = (et || "Other").trim() || "Other"
    const k = typeKey(b, t)
    const cur = totals.get(k)?.v ?? 0
    totals.set(k, { bucket: b, type: t, v: cur + delta })
  }

  for (const batch of batchesRes.data ?? []) {
    const r = batch as {
      inventory_bucket: string
      equipment_type: string
      quantity: number
      unit_cost: number
      status: string
    }
    if (r.status !== "active" && r.status !== "phasing_out") continue
    const q = Number(r.quantity) || 0
    const u = Number(r.unit_cost) || 0
    add(r.inventory_bucket, r.equipment_type, q * u)
  }

  for (const raw of itemsRes.data ?? []) {
    const i = raw as {
      inventory_bucket: string | null
      equipment_type: string | null
      category: string | null
      quantity_total: number | null
      cost_per_unit: number | null
      equipment_batch_id: string | null
    }
    if (i.equipment_batch_id) continue
    const bucket = normBucket(i.inventory_bucket)
    const et = (i.equipment_type || i.category || "Other").trim() || "Other"
    const tc = unitCostByKey.get(typeKey(bucket, et))
    const rowCost = i.cost_per_unit != null ? Number(i.cost_per_unit) : null
    const hasTypeCost = unitCostByKey.has(typeKey(bucket, et))
    const merged = hasTypeCost ? tc ?? null : rowCost
    if (merged == null || Number.isNaN(merged)) continue
    const qty = i.quantity_total ?? 0
    add(bucket, et, merged * qty)
  }

  const rows = [...totals.values()].map((x) => ({
    team_id: teamId,
    inventory_bucket: x.bucket,
    equipment_type: x.type,
    total_line_cost: Math.round(x.v * 100) / 100,
    updated_at: new Date().toISOString(),
  }))

  if (rows.length === 0) {
    await supabase.from("inventory_type_totals").delete().eq("team_id", teamId)
    return
  }

  const { error: delErr } = await supabase.from("inventory_type_totals").delete().eq("team_id", teamId)
  if (delErr) throw new Error(delErr.message)

  const { error: insErr } = await supabase.from("inventory_type_totals").insert(rows)
  if (insErr) throw new Error(insErr.message)
}
