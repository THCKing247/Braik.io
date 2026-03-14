/**
 * Auto Play Generator Phase 1/2: concept-to-route-template engine.
 * Supports concept variants and role-based mapping (outside WR, slot, TE, RB).
 */

import type { TemplateData } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"
import type { RoutePoint } from "@/types/playbook"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { getPresetPointsTranslated } from "@/lib/utils/route-presets"

const FIELD_CENTER_X = 53.33 / 2
const OUTSIDE_THRESHOLD = 7

type PlayerLike = { id: string; xYards: number; yYards: number; label: string }

/** Receiver role by alignment: outside (widest), slot (inside), TE (by label). */
export type ReceiverRole = "outside_left" | "outside_right" | "slot" | "te"

export interface ClassifiedReceiver {
  player: PlayerLike
  role: ReceiverRole
  index: number // 0 = leftmost
}

function classifyReceivers(players: PlayerLike[]): ClassifiedReceiver[] {
  const receivers = players
    .filter((p) => isReceiverLabel(p.label))
    .sort((a, b) => a.xYards - b.xYards)
  if (receivers.length === 0) return []
  const result: ClassifiedReceiver[] = receivers.map((p, i) => {
    const isTE = p.label.toLowerCase().startsWith("te")
    const leftOfCenter = p.xYards < FIELD_CENTER_X
    const distFromCenter = Math.abs(p.xYards - FIELD_CENTER_X)
    const isOutside = distFromCenter > OUTSIDE_THRESHOLD
    let role: ReceiverRole
    if (isTE) role = "te"
    else if (receivers.length === 1) role = "outside_left"
    else if (receivers.length === 2) {
      role = i === 0 ? "outside_left" : "outside_right"
    } else {
      if (i === 0 && leftOfCenter) role = "outside_left"
      else if (i === receivers.length - 1 && !leftOfCenter) role = "outside_right"
      else if (isOutside && leftOfCenter) role = "outside_left"
      else if (isOutside && !leftOfCenter) role = "outside_right"
      else role = "slot"
    }
    return { player: p, role, index: i }
  })
  return result
}

/** Supported concepts: base key -> receiver presets (by role or by index). Variant can change assignment. */
const CONCEPT_PRESETS: Record<
  string,
  { byIndex?: string[]; byRole?: Partial<Record<ReceiverRole, string>>; rb?: string }
> = {
  mesh: { byIndex: ["go", "drag", "drag", "go"] },
  "mesh switch": { byIndex: ["drag", "go", "drag", "go"] },
  stick: { byIndex: ["hitch", "hitch", "flat"] },
  "stick nod": { byIndex: ["nod", "hitch", "flat"] },
  smash: { byRole: { outside_left: "corner", outside_right: "flat", slot: "flat", te: "flat" } },
  "smash switch": { byRole: { outside_left: "flat", outside_right: "corner", slot: "flat", te: "flat" } },
  "four verticals": { byIndex: ["go", "go", "go", "go"] },
  verticals: { byIndex: ["go", "go", "go", "go"] },
  flood: { byIndex: ["corner", "out", "flat"] },
  "flood boot": { byIndex: ["corner", "out", "flat"], rb: "boot" },
  drive: { byIndex: ["dig", "in"] },
}

/** Variant overrides: conceptKey -> variantId -> preset overrides. */
const VARIANT_OVERRIDES: Record<string, Record<string, Partial<typeof CONCEPT_PRESETS[string]>>> = {
  smash: {
    corner_emphasis: { byRole: { outside_left: "corner", outside_right: "out", slot: "flat", te: "flat" } },
    switch_release: { byRole: { outside_left: "flat", outside_right: "corner", slot: "flat", te: "flat" } },
  },
  "mesh switch": {
    switch: { byIndex: ["drag", "go", "drag", "go"] },
  },
  "stick nod": {
    nod: { byIndex: ["nod", "hitch", "flat"] },
  },
  flood: {
    boot: { byIndex: ["corner", "out", "flat"], rb: "boot" },
  },
}

/** Run concepts: RB path preset. */
const RUN_CONCEPT_PRESETS: Record<string, string> = {
  "inside zone": "inside_zone",
  "outside zone": "outside_zone",
  "wide zone": "wide_zone",
  "tight zone": "tight_zone",
  power: "power",
  boot: "boot",
  "power read": "power_read",
  "zone read": "zone_read",
}

const RB_RUN_POINTS: Record<string, RoutePoint[]> = {
  inside_zone: [
    { xYards: 0, yYards: 0, t: 0 },
    { xYards: 0, yYards: -4, t: 0.4 },
    { xYards: 0, yYards: -10, t: 1 },
  ],
  outside_zone: [
    { xYards: 0, yYards: 0, t: 0 },
    { xYards: 3, yYards: -3, t: 0.4 },
    { xYards: 5, yYards: -10, t: 1 },
  ],
  wide_zone: [
    { xYards: 0, yYards: 0, t: 0 },
    { xYards: 4, yYards: -2, t: 0.3 },
    { xYards: 6, yYards: -10, t: 1 },
  ],
  tight_zone: [
    { xYards: 0, yYards: 0, t: 0 },
    { xYards: 1, yYards: -4, t: 0.4 },
    { xYards: 1, yYards: -10, t: 1 },
  ],
  power: [
    { xYards: 0, yYards: 0, t: 0 },
    { xYards: -2, yYards: -4, t: 0.5 },
    { xYards: -2, yYards: -10, t: 1 },
  ],
  boot: [
    { xYards: 0, yYards: 0, t: 0 },
    { xYards: 2, yYards: -2, t: 0.3 },
    { xYards: 4, yYards: -6, t: 1 },
  ],
  power_read: [
    { xYards: 0, yYards: 0, t: 0 },
    { xYards: -2, yYards: -4, t: 0.5 },
    { xYards: -2, yYards: -10, t: 1 },
  ],
  zone_read: [
    { xYards: 0, yYards: 0, t: 0 },
    { xYards: 2, yYards: -3, t: 0.4 },
    { xYards: 3, yYards: -10, t: 1 },
  ],
}

function normalizeConceptName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

function isReceiverLabel(label: string): boolean {
  const n = label.toLowerCase()
  return n.startsWith("wr") || n.startsWith("te")
}

function isRBLabel(label: string): boolean {
  const n = label.toLowerCase()
  return n.startsWith("rb") || n === "hb" || n.startsWith("hb") || n === "fb"
}

export interface GeneratePlayFromConceptInput {
  templateData: TemplateData
  conceptName: string
  side: "offense" | "defense" | "special_teams"
  /** Variant id from concept variants (e.g. "standard", "switch_release"). */
  variant?: string | null
}

export interface GeneratePlayFromConceptResult {
  canvasData: PlayCanvasData
  hasRoutes: boolean
}

function assignRoute(
  players: PlayCanvasData["players"],
  playerId: string,
  presetId: string,
  startX: number,
  startY: number
): boolean {
  const pts = getPresetPointsTranslated(presetId, startX, startY)
  if (pts.length === 0) return false
  const route: RoutePoint[] = pts.map((p) => ({ xYards: p.xYards, yYards: p.yYards, t: p.t }))
  const idx = players.findIndex((p) => p.id === playerId)
  if (idx < 0) return false
  players[idx] = { ...players[idx], route }
  return true
}

function assignRunPath(
  players: PlayCanvasData["players"],
  playerId: string,
  points: RoutePoint[],
  startX: number,
  startY: number
): boolean {
  if (!points.length) return false
  const route: RoutePoint[] = points.map((pt) => ({
    xYards: startX + pt.xYards,
    yYards: startY + pt.yYards,
    t: pt.t,
  }))
  const idx = players.findIndex((p) => p.id === playerId)
  if (idx < 0) return false
  players[idx] = { ...players[idx], route }
  return true
}

export function generatePlayFromConcept(input: GeneratePlayFromConceptInput): GeneratePlayFromConceptResult {
  const { templateData, conceptName, side, variant } = input
  const base = templateDataToCanvasData(templateData, side)
  const concept = normalizeConceptName(conceptName)

  if (side !== "offense") {
    return { canvasData: base, hasRoutes: false }
  }

  const players = [...(base.players ?? [])]
  if (players.length === 0) return { canvasData: base, hasRoutes: false }

  const classified = classifyReceivers(players)
  const rbs = players.filter((p) => isRBLabel(p.label))
  let hasRoutes = false

  // Run concepts
  const runPreset = RUN_CONCEPT_PRESETS[concept]
  if (runPreset && rbs.length > 0) {
    const rbPoints = RB_RUN_POINTS[runPreset]
    if (rbPoints?.length) {
      const rb = rbs[0]
      hasRoutes = assignRunPath(players, rb.id, rbPoints, rb.xYards, rb.yYards)
    }
    return { canvasData: { ...base, players }, hasRoutes }
  }

  // RPO Bubble
  if (concept === "rpo bubble") {
    if (classified.length > 0) {
      const wr = classified[0].player
      hasRoutes = assignRoute(players, wr.id, "go", wr.xYards, wr.yYards) || hasRoutes
    }
    if (rbs.length > 0) {
      const rb = rbs[0]
      hasRoutes = assignRoute(players, rb.id, "bubble", rb.xYards, rb.yYards) || hasRoutes
    }
    return { canvasData: { ...base, players }, hasRoutes }
  }

  // Pass concepts: resolve presets (with variant override)
  let presets = CONCEPT_PRESETS[concept]
  if (variant && presets && VARIANT_OVERRIDES[concept]?.[variant]) {
    const over = VARIANT_OVERRIDES[concept][variant]
    presets = { ...presets, ...over }
  }
  if (!presets) return { canvasData: base, hasRoutes: false }
  if (classified.length === 0 && !presets.rb) return { canvasData: base, hasRoutes: false }

  if (presets.byRole) {
    for (const { player, role } of classified) {
      const presetId = presets.byRole[role as keyof typeof presets.byRole]
      if (presetId) hasRoutes = assignRoute(players, player.id, presetId, player.xYards, player.yYards) || hasRoutes
    }
  } else if (presets.byIndex) {
    for (let i = 0; i < classified.length && i < presets.byIndex.length; i++) {
      const rec = classified[i]
      const presetId = presets.byIndex[i]
      if (presetId) hasRoutes = assignRoute(players, rec.player.id, presetId, rec.player.xYards, rec.player.yYards) || hasRoutes
    }
  }

  if (presets.rb && rbs.length > 0) {
    const rbPreset = RB_RUN_POINTS[presets.rb as keyof typeof RB_RUN_POINTS]
    if (rbPreset?.length) {
      const rb = rbs[0]
      hasRoutes = assignRunPath(players, rb.id, rbPreset, rb.xYards, rb.yYards) || hasRoutes
    }
  }

  return { canvasData: { ...base, players }, hasRoutes }
}
