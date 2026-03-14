/**
 * Formation / player role templates for quick formation creation.
 * Each template defines offensive player positions and initial alignment (xYards, yYards).
 * y is negative upfield; x is positive to the right from center.
 */

import type { TemplateData, Shape } from "@/types/playbook"
import { getPositionByCode, getDisplayLabel } from "@/lib/constants/playbook-positions"
import { builderShapeToKind } from "@/lib/utils/playbook-canvas"

export type FormationTemplateSlot = {
  positionCode: string
  positionNumber?: number
  xYards: number
  yYards: number
}

export type FormationTemplateDef = {
  id: string
  name: string
  /** Offense only for now. */
  side: "offense"
  slots: FormationTemplateSlot[]
}

/** Build TemplateData (Shape[]) from template slots. */
function slotsToTemplateData(slots: FormationTemplateSlot[], side: "offense" | "defense" | "special_teams"): TemplateData {
  const shapes: Shape[] = slots.map((slot, i) => {
    const def = getPositionByCode(slot.positionCode)
    const shape = def?.shape ?? "circle"
    const kind = builderShapeToKind(shape, side)
    const label = getDisplayLabel(slot.positionCode, slot.positionNumber ?? null)
    return {
      id: `t-${slot.positionCode}-${slot.positionNumber ?? 1}-${i}`,
      kind,
      xYards: slot.xYards,
      yYards: slot.yYards,
      label,
    }
  })
  return { fieldView: "HALF", shapes, paths: [] }
}

// Half field: x from ~-14 to 14 (symmetric), y from 0 (LOS) to -8 (backfield). Center at 0.
const T: FormationTemplateDef[] = [
  {
    id: "spread",
    name: "Spread Offense",
    side: "offense",
    slots: [
      { positionCode: "QB", xYards: 0, yYards: -4 },
      { positionCode: "C", xYards: 0, yYards: 0 },
      { positionCode: "LG", xYards: -3, yYards: 0 },
      { positionCode: "RG", xYards: 3, yYards: 0 },
      { positionCode: "LT", xYards: -6, yYards: 0 },
      { positionCode: "RT", xYards: 6, yYards: 0 },
      { positionCode: "WR", positionNumber: 1, xYards: -14, yYards: -2 },
      { positionCode: "WR", positionNumber: 2, xYards: 14, yYards: -2 },
      { positionCode: "TE", positionNumber: 1, xYards: 9, yYards: 0 },
      { positionCode: "RB", positionNumber: 1, xYards: -2, yYards: -6 },
      { positionCode: "RB", positionNumber: 2, xYards: 2, yYards: -6 },
    ],
  },
  {
    id: "pro_style",
    name: "Pro Style",
    side: "offense",
    slots: [
      { positionCode: "QB", xYards: 0, yYards: -4 },
      { positionCode: "C", xYards: 0, yYards: 0 },
      { positionCode: "LG", xYards: -3, yYards: 0 },
      { positionCode: "RG", xYards: 3, yYards: 0 },
      { positionCode: "LT", xYards: -6, yYards: 0 },
      { positionCode: "RT", xYards: 6, yYards: 0 },
      { positionCode: "WR", positionNumber: 1, xYards: -12, yYards: -1 },
      { positionCode: "WR", positionNumber: 2, xYards: 12, yYards: -1 },
      { positionCode: "TE", positionNumber: 1, xYards: -8, yYards: 0 },
      { positionCode: "RB", positionNumber: 1, xYards: -2, yYards: -6 },
      { positionCode: "FB", xYards: 2, yYards: -5 },
    ],
  },
  {
    id: "pistol",
    name: "Pistol",
    side: "offense",
    slots: [
      { positionCode: "QB", xYards: 0, yYards: -3 },
      { positionCode: "C", xYards: 0, yYards: 0 },
      { positionCode: "LG", xYards: -3, yYards: 0 },
      { positionCode: "RG", xYards: 3, yYards: 0 },
      { positionCode: "LT", xYards: -6, yYards: 0 },
      { positionCode: "RT", xYards: 6, yYards: 0 },
      { positionCode: "WR", positionNumber: 1, xYards: -13, yYards: -2 },
      { positionCode: "WR", positionNumber: 2, xYards: 13, yYards: -2 },
      { positionCode: "RB", positionNumber: 1, xYards: 0, yYards: -6 },
      { positionCode: "TE", positionNumber: 1, xYards: 8, yYards: 0 },
      { positionCode: "TE", positionNumber: 2, xYards: -8, yYards: 0 },
    ],
  },
  {
    id: "singleback",
    name: "Singleback",
    side: "offense",
    slots: [
      { positionCode: "QB", xYards: 0, yYards: -4 },
      { positionCode: "C", xYards: 0, yYards: 0 },
      { positionCode: "LG", xYards: -3, yYards: 0 },
      { positionCode: "RG", xYards: 3, yYards: 0 },
      { positionCode: "LT", xYards: -6, yYards: 0 },
      { positionCode: "RT", xYards: 6, yYards: 0 },
      { positionCode: "WR", positionNumber: 1, xYards: -12, yYards: -1 },
      { positionCode: "WR", positionNumber: 2, xYards: 12, yYards: -1 },
      { positionCode: "TE", positionNumber: 1, xYards: -8, yYards: 0 },
      { positionCode: "TE", positionNumber: 2, xYards: 8, yYards: 0 },
      { positionCode: "RB", positionNumber: 1, xYards: 0, yYards: -6 },
    ],
  },
  {
    id: "trips_right",
    name: "Trips Right",
    side: "offense",
    slots: [
      { positionCode: "QB", xYards: 0, yYards: -4 },
      { positionCode: "C", xYards: 0, yYards: 0 },
      { positionCode: "LG", xYards: -3, yYards: 0 },
      { positionCode: "RG", xYards: 3, yYards: 0 },
      { positionCode: "LT", xYards: -6, yYards: 0 },
      { positionCode: "RT", xYards: 6, yYards: 0 },
      { positionCode: "WR", positionNumber: 1, xYards: -14, yYards: -2 },
      { positionCode: "WR", positionNumber: 2, xYards: 8, yYards: -2 },
      { positionCode: "WR", positionNumber: 3, xYards: 12, yYards: -2 },
      { positionCode: "TE", positionNumber: 1, xYards: 14, yYards: 0 },
      { positionCode: "RB", positionNumber: 1, xYards: -2, yYards: -6 },
    ],
  },
  {
    id: "trips_left",
    name: "Trips Left",
    side: "offense",
    slots: [
      { positionCode: "QB", xYards: 0, yYards: -4 },
      { positionCode: "C", xYards: 0, yYards: 0 },
      { positionCode: "LG", xYards: -3, yYards: 0 },
      { positionCode: "RG", xYards: 3, yYards: 0 },
      { positionCode: "LT", xYards: -6, yYards: 0 },
      { positionCode: "RT", xYards: 6, yYards: 0 },
      { positionCode: "WR", positionNumber: 1, xYards: 14, yYards: -2 },
      { positionCode: "WR", positionNumber: 2, xYards: -8, yYards: -2 },
      { positionCode: "WR", positionNumber: 3, xYards: -12, yYards: -2 },
      { positionCode: "TE", positionNumber: 1, xYards: -14, yYards: 0 },
      { positionCode: "RB", positionNumber: 1, xYards: 2, yYards: -6 },
    ],
  },
  {
    id: "i_formation",
    name: "I-Formation",
    side: "offense",
    slots: [
      { positionCode: "QB", xYards: 0, yYards: -4 },
      { positionCode: "C", xYards: 0, yYards: 0 },
      { positionCode: "LG", xYards: -3, yYards: 0 },
      { positionCode: "RG", xYards: 3, yYards: 0 },
      { positionCode: "LT", xYards: -6, yYards: 0 },
      { positionCode: "RT", xYards: 6, yYards: 0 },
      { positionCode: "WR", positionNumber: 1, xYards: -12, yYards: -1 },
      { positionCode: "WR", positionNumber: 2, xYards: 12, yYards: -1 },
      { positionCode: "TE", positionNumber: 1, xYards: 8, yYards: 0 },
      { positionCode: "RB", positionNumber: 1, xYards: 0, yYards: -7 },
      { positionCode: "FB", xYards: 0, yYards: -5 },
    ],
  },
  {
    id: "empty",
    name: "Empty",
    side: "offense",
    slots: [
      { positionCode: "QB", xYards: 0, yYards: -4 },
      { positionCode: "C", xYards: 0, yYards: 0 },
      { positionCode: "LG", xYards: -3, yYards: 0 },
      { positionCode: "RG", xYards: 3, yYards: 0 },
      { positionCode: "LT", xYards: -6, yYards: 0 },
      { positionCode: "RT", xYards: 6, yYards: 0 },
      { positionCode: "WR", positionNumber: 1, xYards: -14, yYards: -2 },
      { positionCode: "WR", positionNumber: 2, xYards: -7, yYards: -2 },
      { positionCode: "WR", positionNumber: 3, xYards: 7, yYards: -2 },
      { positionCode: "WR", positionNumber: 4, xYards: 14, yYards: -2 },
      { positionCode: "RB", positionNumber: 1, xYards: 0, yYards: -6 },
    ],
  },
]

export const FORMATION_TEMPLATES: FormationTemplateDef[] = T

/** Get template by id. Returns undefined if not found. */
export function getFormationTemplateById(id: string): FormationTemplateDef | undefined {
  return FORMATION_TEMPLATES.find((t) => t.id === id)
}

/** Get TemplateData for a formation template (offense). Use when creating a formation from template. */
export function getTemplateDataForFormation(templateId: string): TemplateData | null {
  const t = getFormationTemplateById(templateId)
  if (!t || t.side !== "offense") return null
  return slotsToTemplateData(t.slots, "offense")
}
