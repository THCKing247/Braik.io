/**
 * Position eligibility for depth chart: match players to slots by position group and slot role/alias.
 * Used for valid/invalid drop highlighting, recommendation hints, and empty-slot suggestions.
 * Custom labels are presentation-only; eligibility uses slot metadata (positionGroup, alias, slotKey).
 */

import type { FormationSlot } from "./formation-presets"

/** Fit level for a player in a slot. Valid = ideal; flexible = allowed but secondary; invalid = not eligible. */
export type SlotFit = "valid" | "flexible" | "invalid"

const ATHLETE = "Athlete"

/** Normalize player position group for matching (null => Athlete). */
function normalizePlayerGroup(positionGroup: string | null): string {
  const t = positionGroup?.trim()
  if (!t) return ATHLETE
  return t.toUpperCase()
}

/** Slot metadata used for eligibility (avoids coupling to full FormationSlot). */
export interface SlotEligibilityInput {
  slotKey: string
  positionGroup: string | null
  alias?: string | null
}

/** Get accepted position groups for a slot (includes Athlete when slot accepts flexible/skill). */
function getAcceptedGroupsForSlot(slot: SlotEligibilityInput): string[] {
  const pg = slot.positionGroup?.trim().toUpperCase() ?? ""
  const alias = (slot.alias ?? "").trim()
  const key = slot.slotKey

  const addAthlete = (groups: string[]) => [...groups, ATHLETE]

  // —— Offense ——
  if (pg === "QB") return ["QB"]
  if (key === "FB") return addAthlete(["FB", "RB"])
  if (pg === "RB" || key === "RB") return addAthlete(["RB", "FB"])
  if (pg === "WR" || ["X", "Z", "H", "Y", "F"].includes(alias)) return addAthlete(["WR"])
  if (pg === "TE" || (alias === "Y" && key.startsWith("TE"))) return addAthlete(["TE", "WR"])
  if (pg === "OL" || ["LT", "LG", "C", "RG", "RT"].includes(key) || ["LT", "LG", "C", "RG", "RT"].includes(pg))
    return ["OL"]

  // —— Defense ——
  if (pg === "DL" || ["DE", "DT", "NT"].includes(pg) || ["DE", "DT", "NT"].some((k) => key.startsWith(k) || key === k))
    return addAthlete(["DL"])
  if (
    pg === "LB" ||
    ["Sam", "Mike", "Will", "Jack", "OLB", "MLB", "ILB"].includes(alias) ||
    ["OLB", "MLB", "ILB"].some((k) => key.includes(k) || key === k)
  )
    return addAthlete(["LB"])
  if (
    pg === "DB" ||
    ["CB", "NB", "FS", "SS", "S", "Dime"].includes(alias) ||
    key.startsWith("CB") ||
    key.startsWith("S") ||
    key === "NB"
  )
    return addAthlete(["DB"])

  // —— Special teams ——
  if (key === "K") return ["K"]
  if (key === "P") return ["P"]
  if (key === "LS" || alias === "LS") return ["LS", "OL"]
  if (key === "Holder" || alias === "Holder") return ["P", "QB"]
  if (key.startsWith("KR") || alias === "Returner") return addAthlete(["RB", "WR", "DB"])
  if (alias === "Gunner") return addAthlete(["WR", "DB"])
  if (alias === "PP" || key.startsWith("Wing")) return addAthlete(["TE", "OL", "WR", "RB"])
  if (alias === "Wing" && pg === "TE") return addAthlete(["TE", "OL", "WR"])
  if (alias === "Upback" || key === "B1") return addAthlete(["RB", "WR", "TE", "OL"])

  // Generic ST / no positionGroup: accept Athlete and common skill
  if (!pg && (key.startsWith("F") || key.startsWith("B") || key.startsWith("L") || key.startsWith("R")))
    return addAthlete(["RB", "WR", "DB", "TE", "LB"])

  // Fallback: use positionGroup as single accepted group
  if (pg) return addAthlete([pg])
  return [ATHLETE]
}

/**
 * Returns whether a player (by position group) is eligible for a slot.
 * Uses slot positionGroup and alias; treats null player group as Athlete.
 */
export function getSlotFit(
  playerPositionGroup: string | null,
  slot: SlotEligibilityInput
): SlotFit {
  const playerGroup = normalizePlayerGroup(playerPositionGroup)
  const accepted = getAcceptedGroupsForSlot(slot)
  if (accepted.includes(playerGroup)) return "valid"
  return "invalid"
}

/**
 * Returns true if the player can be dropped in the slot (valid or flexible).
 */
export function isEligibleForSlot(playerPositionGroup: string | null, slot: SlotEligibilityInput): boolean {
  return getSlotFit(playerPositionGroup, slot) !== "invalid"
}

/**
 * Returns set of slot keys that are valid drop targets for the player.
 * Used for drag highlighting (valid = enabled, invalid = dimmed).
 */
export function getValidSlotKeys(
  playerPositionGroup: string | null,
  slots: FormationSlot[]
): Set<string> {
  const set = new Set<string>()
  for (const s of slots) {
    if (isEligibleForSlot(playerPositionGroup, s)) set.add(s.slotKey)
  }
  return set
}

/**
 * Returns slot keys that are best fits for the player (same as valid for now).
 * Can be extended to rank by ideal vs flexible and return top N for "Best fit: X, Z" hints.
 */
export function getBestFitSlotKeys(
  playerPositionGroup: string | null,
  slots: FormationSlot[]
): string[] {
  const valid: string[] = []
  for (const s of slots) {
    if (isEligibleForSlot(playerPositionGroup, s)) valid.push(s.slotKey)
  }
  return valid
}

/**
 * Returns human-readable "best fits" for an empty slot (e.g. "WR, Athlete").
 * Used for empty-slot hint text.
 */
export function getAcceptedGroupsDisplay(slot: SlotEligibilityInput): string {
  const groups = getAcceptedGroupsForSlot(slot)
  const filtered = groups.filter((g) => g !== ATHLETE)
  if (filtered.length === 0) return ATHLETE
  if (groups.includes(ATHLETE)) return `${filtered.join(", ")} / ${ATHLETE}`
  return filtered.join(", ")
}
