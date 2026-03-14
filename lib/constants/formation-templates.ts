/**
 * Formation / player role templates for quick formation creation.
 * Slot coords: template-relative (x from center -14..14, y from LOS 0 to -8 backfield).
 * We convert to field-absolute (x 0..53.33, y 0..35) so the formation editor and
 * FieldCoordinateSystem render correctly (no stacking at top-left).
 */

import type { TemplateData, Shape } from "@/types/playbook"
import { getPositionByCode, getDisplayLabel } from "@/lib/constants/playbook-positions"
import { builderShapeToKind } from "@/lib/utils/playbook-canvas"

/** Field dimensions used by PlaybookFieldSurface / FieldCoordinateSystem (yardStart=15, yardEnd=50). */
const FIELD_WIDTH_YARDS = 53.33
const FIELD_VISIBLE_YARDS = 35
const FIELD_CENTER_X = FIELD_WIDTH_YARDS / 2
/** Offense LOS yard line for half-field view; backfield is below this. */
const LOS_YARD = 20

export type FormationTemplateSlot = {
  positionCode: string
  positionNumber?: number
  /** Template-relative: center = 0, right positive. */
  xYards: number
  /** Template-relative: LOS = 0, backfield negative. */
  yYards: number
}

export type FormationTemplateDef = {
  id: string
  name: string
  /** Offense only for now. */
  side: "offense"
  slots: FormationTemplateSlot[]
}

/**
 * Convert template-relative (x center, y LOS/backfield) to field-absolute (x 0..53.33, y 0..35).
 * Ensures formations load in the correct alignment in the editor.
 */
function templateToFieldCoords(templateX: number, templateY: number): { xYards: number; yYards: number } {
  const xYards = FIELD_CENTER_X + templateX
  const yYards = LOS_YARD + templateY
  return {
    xYards: Math.max(0, Math.min(FIELD_WIDTH_YARDS, xYards)),
    yYards: Math.max(0, Math.min(FIELD_VISIBLE_YARDS, yYards)),
  }
}

/** Build TemplateData (Shape[]) from template slots. Output uses field-absolute coordinates. */
function slotsToTemplateData(slots: FormationTemplateSlot[], side: "offense" | "defense" | "special_teams"): TemplateData {
  const shapes: Shape[] = slots.map((slot, i) => {
    const def = getPositionByCode(slot.positionCode)
    const shape = def?.shape ?? "circle"
    const kind = builderShapeToKind(shape, side)
    const label = getDisplayLabel(slot.positionCode, slot.positionNumber ?? null)
    const { xYards, yYards } = templateToFieldCoords(slot.xYards, slot.yYards)
    return {
      id: `t-${slot.positionCode}-${slot.positionNumber ?? 1}-${i}`,
      kind,
      xYards,
      yYards,
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
