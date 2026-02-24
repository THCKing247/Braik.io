import { SideOfBall, ShapeKind, Shape } from "@/types/playbook"

/**
 * Returns allowed shape kinds for a given side
 */
export function allowedTemplateShapeKinds(side: SideOfBall): Set<ShapeKind> {
  if (side === "offense") {
    return new Set<ShapeKind>(["OFFENSE_CIRCLE", "CENTER_SQUARE"])
  }
  if (side === "defense") {
    return new Set<ShapeKind>(["DEFENSE_TRIANGLE"])
  }
  // Special Teams: allow both offense and defense shapes
  return new Set<ShapeKind>([
    "OFFENSE_CIRCLE",
    "CENTER_SQUARE",
    "DEFENSE_TRIANGLE",
    "SPECIAL_TEAMS_CIRCLE",
    "SPECIAL_TEAMS_SQUARE",
  ])
}

/**
 * Validates that a template can be saved
 * Returns { ok: true } if valid, or { ok: false, reason: string } if invalid
 */
export function validateTemplateSave(side: SideOfBall, shapes: Shape[]): { ok: true } | { ok: false; reason: string } {
  if (shapes.length !== 11) {
    return { ok: false, reason: "Template requires exactly 11 players." }
  }

  const allowed = allowedTemplateShapeKinds(side)
  for (const shape of shapes) {
    if (!allowed.has(shape.kind)) {
      return { ok: false, reason: `Invalid shape ${shape.kind} for ${side} template. Templates can only contain ${side} shapes.` }
    }
  }

  return { ok: true }
}

/**
 * Checks if a shape kind is valid for a given side in template mode
 */
export function isValidTemplateShape(side: SideOfBall, shapeKind: ShapeKind): boolean {
  return allowedTemplateShapeKinds(side).has(shapeKind)
}
