/**
 * Formation and slot types for AI formation hooks.
 * Placeholder data and validation for 11-slot formations.
 */

export type Slot = {
  role: string
  x?: number
  y?: number
  xYards?: number
  yYards?: number
}

export type Formation = {
  id: string
  name: string
  slots: Slot[]
}

export const FORMATIONS: Formation[] = []

/**
 * Validates that slots do not overlap (same position).
 * Returns valid: true with no errors if no overlaps.
 */
export function validateNoOverlap(slots: Slot[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!
      const b = slots[j]!
      const ax = a.xYards ?? a.x
      const ay = a.yYards ?? a.y
      const bx = b.xYards ?? b.x
      const by = b.yYards ?? b.y
      if (
        typeof ax === "number" &&
        typeof ay === "number" &&
        typeof bx === "number" &&
        typeof by === "number" &&
        Math.abs(ax - bx) < 0.5 &&
        Math.abs(ay - by) < 0.5
      ) {
        errors.push(`Slot overlap: ${a.role} and ${b.role} at same position`)
      }
    }
  }
  return { valid: errors.length === 0, errors }
}
