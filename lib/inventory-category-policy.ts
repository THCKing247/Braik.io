/** Inventory buckets that may be assigned to players (Gear, Uniforms). */
export const PLAYER_ASSIGNABLE_BUCKETS = ["Gear", "Uniforms"] as const
export type PlayerAssignableBucket = (typeof PLAYER_ASSIGNABLE_BUCKETS)[number]

/** Program inventory — never player-assigned (condition / qty / replacement cost only). */
export const PROGRAM_INVENTORY_BUCKETS = ["Facilities", "Training Room", "Field"] as const

const PLAYER_SET = new Set<string>(PLAYER_ASSIGNABLE_BUCKETS)
const PROGRAM_SET = new Set<string>(PROGRAM_INVENTORY_BUCKETS)

export function normalizeInventoryBucketLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim()
  return s || "Gear"
}

export function isPlayerAssignableBucket(bucket: string | null | undefined): boolean {
  return PLAYER_SET.has(normalizeInventoryBucketLabel(bucket))
}

export function isProgramInventoryBucket(bucket: string | null | undefined): boolean {
  return PROGRAM_SET.has(normalizeInventoryBucketLabel(bucket))
}
