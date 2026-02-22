/**
 * Playbook template validation: 11 players, side-specific shapes, no overlaps.
 */
import type { SideOfBall, Shape, ShapeKind } from "@/types/playbook"

const EXPECTED_SLOTS = 11

export function validateTemplateSave(
  side: SideOfBall,
  shapes: Shape[]
): { ok: boolean; reason?: string } {
  if (shapes.length !== EXPECTED_SLOTS) {
    return { ok: false, reason: `Formation must have exactly ${EXPECTED_SLOTS} players, found ${shapes.length}` }
  }
  for (let i = 0; i < shapes.length; i++) {
    if (!isValidTemplateShape(side, shapes[i]!.kind)) {
      return { ok: false, reason: `Invalid shape ${shapes[i]!.kind} for ${side} formation` }
    }
  }
  return { ok: true }
}

export function isValidTemplateShape(side: SideOfBall, shapeKind: ShapeKind): boolean {
  if (side === "offense") {
    return shapeKind === "CENTER_SQUARE" || shapeKind === "OFFENSE_CIRCLE"
  }
  if (side === "defense") {
    return shapeKind === "DEFENSE_TRIANGLE"
  }
  if (side === "special_teams") {
    return shapeKind === "OFFENSE_CIRCLE" || shapeKind === "SPECIAL_TEAMS_SQUARE" || shapeKind === "SPECIAL_TEAMS_CIRCLE" || shapeKind === "DEFENSE_TRIANGLE"
  }
  return false
}
