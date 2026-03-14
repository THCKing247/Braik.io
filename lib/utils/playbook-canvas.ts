import type { TemplateData, Shape, ShapeKind } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"

/** Field coordinate bounds used by PlaybookFieldSurface (yardStart=15, yardEnd=50). */
const FIELD_WIDTH_YARDS = 53.33
const FIELD_VISIBLE_YARDS = 35
const FIELD_CENTER_X = FIELD_WIDTH_YARDS / 2
const LOS_YARD = 20

/**
 * Convert template-relative (x center, y LOS/backfield) to field-absolute (x 0..53.33, y 0..35).
 * Flip Y so backfield (negative template y) appears below LOS on screen.
 */
function normalizeShapeToFieldCoords(s: Shape): { xYards: number; yYards: number } {
  const tx = typeof s.xYards === "number" ? s.xYards : 0
  const ty = typeof s.yYards === "number" ? s.yYards : 0
  const xYards = Math.max(0, Math.min(FIELD_WIDTH_YARDS, FIELD_CENTER_X + tx))
  const yYards = Math.max(0, Math.min(FIELD_VISIBLE_YARDS, LOS_YARD - ty))
  return { xYards, yYards }
}

/**
 * Map ShapeKind to builder shape string
 */
function shapeKindToBuilderShape(kind: ShapeKind): "circle" | "square" | "triangle" {
  if (kind === "CENTER_SQUARE" || kind === "SPECIAL_TEAMS_SQUARE") return "square"
  if (kind === "DEFENSE_TRIANGLE") return "triangle"
  return "circle"
}

/**
 * Map builder shape to ShapeKind for a given side
 */
export function builderShapeToKind(
  shape: "circle" | "square" | "triangle",
  side: "offense" | "defense" | "special_teams"
): ShapeKind {
  if (side === "defense") return "DEFENSE_TRIANGLE"
  if (shape === "square") return side === "special_teams" ? "SPECIAL_TEAMS_SQUARE" : "CENTER_SQUARE"
  return side === "special_teams" ? "SPECIAL_TEAMS_CIRCLE" : "OFFENSE_CIRCLE"
}

/**
 * Convert formation template_data (Shape[]) to builder PlayCanvasData (players only).
 * Normalizes template-relative coordinates to field-absolute so players do not stack at top-left.
 */
export function templateDataToCanvasData(
  templateData: TemplateData,
  side: "offense" | "defense" | "special_teams"
): PlayCanvasData {
  const shapes = templateData.shapes ?? []
  const needsNormalize = shapes.some(
    (s: Shape) => typeof (s.yYards ?? 0) === "number" && (s.yYards as number) < 0
  )
  const players = shapes.map((s: Shape) => {
    const { xYards, yYards } = needsNormalize
      ? normalizeShapeToFieldCoords(s)
      : {
          xYards: typeof s.xYards === "number" ? Math.max(0, Math.min(FIELD_WIDTH_YARDS, s.xYards)) : 0,
          yYards: typeof s.yYards === "number" ? Math.max(0, Math.min(FIELD_VISIBLE_YARDS, s.yYards)) : 0,
        }
    return {
      id: s.id,
      xYards,
      yYards,
      label: s.label ?? "X",
      shape: shapeKindToBuilderShape(s.kind),
    }
  })
  return {
    fieldView: "HALF",
    players,
    zones: [],
    manCoverages: [],
    fieldType: "half",
    side,
  }
}

/**
 * Convert builder canvas players to TemplateData (shapes only).
 * Used when saving a formation. Caller must ensure only shapes (no routes/zones) are passed.
 */
export function canvasPlayersToTemplateData(
  players: PlayCanvasData["players"],
  side: "offense" | "defense" | "special_teams"
): TemplateData {
  const shapes: Shape[] = players.map((p) => ({
    id: p.id,
    kind: builderShapeToKind(p.shape, side),
    xYards: p.xYards,
    yYards: p.yYards,
    label: p.label,
    locked: false,
  }))
  return {
    fieldView: "HALF",
    shapes,
    paths: [],
  }
}
