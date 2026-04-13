import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { normalizeInventoryBucketLabel } from "@/lib/inventory-category-policy"

const BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const
type InventoryBucket = (typeof BUCKETS)[number]

function normalizeBucket(v: unknown): InventoryBucket {
  const s = typeof v === "string" ? v.trim() : ""
  if (BUCKETS.includes(s as InventoryBucket)) return s as InventoryBucket
  return "Gear"
}

function typeCostKey(bucket: string, equipmentType: string): string {
  return `${normalizeInventoryBucketLabel(bucket)}|${equipmentType.trim() || "Other"}`
}

export type ExpenseGroupSummary = {
  key: string
  bucket: string
  typeKey: string
  totalQty: number
  totalLine: number
  uniformUnit: number | null
  sampleNotes: string
}

/**
 * Server-side rollup for Expenses tab — minimal columns; total_line from inventory_type_totals when present.
 * @param opts.bucketFilter When set to a concrete bucket (not "All"), only aggregate rows in that category.
 */
export async function loadInventoryExpenseGroups(
  teamId: string,
  opts?: { bucketFilter?: string }
): Promise<ExpenseGroupSummary[]> {
  const supabase = getSupabaseServer()
  const bf = opts?.bucketFilter?.trim()
  let itemsQ = supabase
    .from("inventory_items")
    .select("inventory_bucket, equipment_type, category, quantity_total, cost_per_unit, notes")
    .eq("team_id", teamId)
    .eq("archive_status", "active")
  if (bf && bf !== "All" && BUCKETS.includes(bf as InventoryBucket)) {
    itemsQ = itemsQ.eq("inventory_bucket", bf)
  }
  const [itemsRes, costsRes, totalsRes] = await Promise.all([
    itemsQ,
    supabase.from("inventory_unit_costs").select("inventory_bucket, equipment_type, unit_cost").eq("team_id", teamId),
    supabase.from("inventory_type_totals").select("inventory_bucket, equipment_type, total_line_cost").eq("team_id", teamId),
  ])

  if (itemsRes.error) throw new Error(itemsRes.error.message)
  if (costsRes.error) throw new Error(costsRes.error.message)
  if (totalsRes.error) throw new Error(totalsRes.error.message)

  const unitCostByKey = new Map<string, number | null>()
  for (const row of costsRes.data ?? []) {
    const r = row as { inventory_bucket: string; equipment_type: string; unit_cost: number | null }
    unitCostByKey.set(typeCostKey(r.inventory_bucket, r.equipment_type), r.unit_cost != null ? Number(r.unit_cost) : null)
  }

  const typeTotalByKey = new Map<string, number>()
  for (const row of totalsRes.data ?? []) {
    const r = row as { inventory_bucket: string; equipment_type: string; total_line_cost: number }
    typeTotalByKey.set(typeCostKey(r.inventory_bucket, r.equipment_type), Number(r.total_line_cost) || 0)
  }

  const m = new Map<string, { bucket: string; typeKey: string; totalQty: number; notes: string[] }>()

  for (const raw of itemsRes.data ?? []) {
    const i = raw as {
      inventory_bucket: string | null
      equipment_type: string | null
      category: string | null
      quantity_total: number | null
      notes: string | null
    }
    const bucket = normalizeBucket(i.inventory_bucket)
    const typeKey = (i.equipment_type || i.category || "Other").trim() || "Other"
    const key = `${bucket}||${typeKey}`
    const qty = i.quantity_total ?? 0
    const note = (i.notes ?? "").trim()
    if (!m.has(key)) m.set(key, { bucket, typeKey, totalQty: 0, notes: [] })
    const g = m.get(key)!
    g.totalQty += qty
    if (note) g.notes.push(note)
  }

  const out: ExpenseGroupSummary[] = []
  for (const [, g] of m) {
    const tk = typeCostKey(g.bucket, g.typeKey)
    const dbTotal = typeTotalByKey.get(tk)
    const hasTypeCost = unitCostByKey.has(tk)
    const uc = unitCostByKey.get(tk) ?? null
    const totalLine = dbTotal != null && dbTotal > 0 ? dbTotal : hasTypeCost && uc != null ? uc * g.totalQty : 0
    const uniformUnit = hasTypeCost ? uc : null
    const sampleNotes = [...new Set(g.notes)].join(" · ")
    out.push({
      key: `${g.bucket}||${g.typeKey}`,
      bucket: g.bucket,
      typeKey: g.typeKey,
      totalQty: g.totalQty,
      totalLine,
      uniformUnit,
      sampleNotes,
    })
  }

  out.sort((a, b) => {
    const c = a.bucket.localeCompare(b.bucket)
    if (c !== 0) return c
    return a.typeKey.localeCompare(b.typeKey)
  })
  return out
}
