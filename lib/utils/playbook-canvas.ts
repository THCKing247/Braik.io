import type { TemplateData, Shape, ShapeKind } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"

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
 * Used when starting a new play from a saved formation.
 */
export function templateDataToCanvasData(
  templateData: TemplateData,
  side: "offense" | "defense" | "special_teams"
): PlayCanvasData {
  const players = (templateData.shapes ?? []).map((s: Shape) => ({
    id: s.id,
    xYards: s.xYards,
    yYards: s.yYards,
    label: s.label ?? "X",
    shape: shapeKindToBuilderShape(s.kind),
  }))
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
