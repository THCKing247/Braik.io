/**
 * Football position definitions for the playbook editor.
 * Each position has a code, display label, shape (for rendering), and whether it supports depth numbering (WR1, WR2, etc.).
 */

import type { SideOfBall } from "@/types/playbook"

export type PositionShape = "circle" | "square" | "triangle"

export interface PositionDef {
  code: string
  label: string
  shape: PositionShape
  /** If true, marker supports depth/slot number: WR1, WR2, CB1, GUN1, etc. */
  numberable: boolean
  unit: SideOfBall
}

export const OFFENSE_POSITIONS: PositionDef[] = [
  { code: "QB", label: "QB", shape: "circle", numberable: false, unit: "offense" },
  { code: "RB", label: "RB", shape: "circle", numberable: true, unit: "offense" },
  { code: "FB", label: "FB", shape: "circle", numberable: false, unit: "offense" },
  { code: "WR", label: "WR", shape: "circle", numberable: true, unit: "offense" },
  { code: "TE", label: "TE", shape: "circle", numberable: true, unit: "offense" },
  { code: "LT", label: "LT", shape: "circle", numberable: false, unit: "offense" },
  { code: "LG", label: "LG", shape: "circle", numberable: false, unit: "offense" },
  { code: "C", label: "C", shape: "square", numberable: false, unit: "offense" },
  { code: "RG", label: "RG", shape: "circle", numberable: false, unit: "offense" },
  { code: "RT", label: "RT", shape: "circle", numberable: false, unit: "offense" },
]

export const DEFENSE_POSITIONS: PositionDef[] = [
  { code: "CB", label: "CB", shape: "triangle", numberable: true, unit: "defense" },
  { code: "SS", label: "SS", shape: "triangle", numberable: false, unit: "defense" },
  { code: "FS", label: "FS", shape: "triangle", numberable: false, unit: "defense" },
  { code: "S", label: "S", shape: "triangle", numberable: true, unit: "defense" },
  { code: "MLB", label: "MLB", shape: "triangle", numberable: false, unit: "defense" },
  { code: "OLB", label: "OLB", shape: "triangle", numberable: true, unit: "defense" },
  { code: "ILB", label: "ILB", shape: "triangle", numberable: true, unit: "defense" },
  { code: "LB", label: "LB", shape: "triangle", numberable: true, unit: "defense" },
  { code: "DE", label: "DE", shape: "triangle", numberable: true, unit: "defense" },
  { code: "DT", label: "DT", shape: "triangle", numberable: true, unit: "defense" },
  { code: "NT", label: "NT", shape: "triangle", numberable: false, unit: "defense" },
  { code: "EDGE", label: "EDGE", shape: "triangle", numberable: true, unit: "defense" },
]

export const SPECIAL_POSITIONS: PositionDef[] = [
  { code: "K", label: "K", shape: "circle", numberable: false, unit: "special_teams" },
  { code: "P", label: "P", shape: "circle", numberable: false, unit: "special_teams" },
  { code: "LS", label: "LS", shape: "circle", numberable: false, unit: "special_teams" },
  { code: "H", label: "H", shape: "circle", numberable: false, unit: "special_teams" },
  { code: "PR", label: "PR", shape: "circle", numberable: false, unit: "special_teams" },
  { code: "KR", label: "KR", shape: "circle", numberable: false, unit: "special_teams" },
  { code: "GUN", label: "GUN", shape: "circle", numberable: true, unit: "special_teams" },
  { code: "JAM", label: "JAM", shape: "circle", numberable: true, unit: "special_teams" },
  { code: "PP", label: "PP", shape: "circle", numberable: true, unit: "special_teams" },
]

const ALL_POSITIONS = [...OFFENSE_POSITIONS, ...DEFENSE_POSITIONS, ...SPECIAL_POSITIONS]

export function getPositionByCode(code: string): PositionDef | undefined {
  return ALL_POSITIONS.find((p) => p.code === code)
}

export function getPositionsForUnit(unit: SideOfBall): PositionDef[] {
  if (unit === "offense") return OFFENSE_POSITIONS
  if (unit === "defense") return DEFENSE_POSITIONS
  return SPECIAL_POSITIONS
}

/** Display label for a marker: "WR2", "QB", "LT", "GUN1". */
export function getDisplayLabel(positionCode: string, positionNumber: number | null | undefined): string {
  const def = getPositionByCode(positionCode)
  if (!def) return positionCode
  if (def.numberable && positionNumber != null && positionNumber > 0) {
    return `${def.label}${positionNumber}`
  }
  return def.label
}

/** Next depth number for a position (e.g. existing WR1, WR2 → 3). */
export function getNextPositionNumber(
  players: Array<{ positionCode?: string | null; positionNumber?: number | null }>,
  positionCode: string
): number | null {
  const def = getPositionByCode(positionCode)
  if (!def?.numberable) return null
  const sameCode = players.filter(
    (p) => (p.positionCode ?? "").toUpperCase() === positionCode.toUpperCase() && p.positionNumber != null
  )
  const maxNum = sameCode.reduce((m, p) => Math.max(m, p.positionNumber ?? 0), 0)
  return maxNum + 1
}

/** True if another marker on the play has the same role label (shared for builder strip and inspector). */
export function hasDuplicateRoleLabel(
  players: Array<{ id: string; label?: string | null }>,
  playerId: string
): boolean {
  const player = players.find((p) => p.id === playerId)
  if (!player?.label) return false
  return players.some((p) => p.id !== playerId && p.label === player.label)
}

/** Depth chart slot (from GET /api/roster/depth-chart). Used to link playbook roles to roster. */
export interface DepthChartSlot {
  unit: string
  position: string
  string: number
  playerId?: string | null
  player?: { id: string; firstName: string; lastName: string; jerseyNumber?: number | null } | null
}

/**
 * True if a playbook marker (side, positionCode, positionNumber) matches a depth chart slot.
 * Play side must match unit; positionCode must match position; positionNumber must match string (or string 1 when positionNumber is null).
 */
export function markerMatchesDepthSlot(
  playSide: string,
  positionCode: string | null | undefined,
  positionNumber: number | null | undefined,
  slot: DepthChartSlot
): boolean {
  if (!positionCode || playSide !== slot.unit) return false
  if (positionCode.toUpperCase() !== slot.position.toUpperCase()) return false
  const slotString = slot.string
  if (positionNumber != null) return positionNumber === slotString
  return slotString === 1
}

/**
 * Get the roster player assigned to a depth slot for (unit, position, string), if any.
 */
export function getPlayerForSlot(
  entries: DepthChartSlot[],
  unit: string,
  position: string,
  stringNum: number
): DepthChartSlot["player"] | null {
  const entry = entries.find(
    (e) => e.unit === unit && e.position.toUpperCase() === position.toUpperCase() && e.string === stringNum
  )
  return entry?.player ?? null
}

/**
 * Get human-readable role labels for a player from depth chart (e.g. ["WR2", "GUN1"]).
 * Used to show "Currently assigned: WR2, GUN1" in the inspector.
 */
export function getRoleLabelsForPlayer(
  entries: DepthChartSlot[],
  playerId: string
): string[] {
  const slots = entries.filter((e) => e.playerId === playerId)
  return slots.map((e) => getDisplayLabel(e.position, e.string)).filter(Boolean)
}

/**
 * Get same-unit role labels for a player (excluding a specific slot if needed).
 * Used to warn when a player already has other roles in the same unit.
 */
export function getSameUnitRoleLabelsForPlayer(
  entries: DepthChartSlot[],
  playerId: string,
  unit: string,
  excludePosition?: string,
  excludeString?: number
): string[] {
  return entries
    .filter(
      (e) =>
        e.playerId === playerId &&
        e.unit === unit &&
        !(excludePosition && e.position.toUpperCase() === excludePosition.toUpperCase() && e.string === excludeString)
    )
    .map((e) => getDisplayLabel(e.position, e.string))
    .filter(Boolean)
}
