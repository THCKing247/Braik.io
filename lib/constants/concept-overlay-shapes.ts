/**
 * Lightweight concept overlay shapes for formation preview.
 * Coordinates in yards: x 0–53.33 (width), y 0–35 (50-yard at top to 15-yard at bottom).
 * Used to draw simple route/path previews on top of formation alignment.
 */

export interface OverlayPoint {
  xYards: number
  yYards: number
}

export interface ConceptOverlayRoute {
  points: OverlayPoint[]
}

export interface ConceptOverlay {
  routes: ConceptOverlayRoute[]
}

const FIELD_W = 53.33
const CENTER_X = FIELD_W / 2

/** Get overlay definition for a concept by name. Returns null if no overlay defined. */
export function getConceptOverlay(conceptName: string): ConceptOverlay | null {
  const key = conceptName.trim().toLowerCase().replace(/\s+/g, "_")
  return CONCEPT_OVERLAYS[key] ?? CONCEPT_OVERLAYS[conceptName] ?? null
}

/** Normalized overlay definitions: concept key -> routes in yard coords */
const CONCEPT_OVERLAYS: Record<string, ConceptOverlay> = {
  // Run concepts
  power: {
    routes: [
      { points: [{ xYards: CENTER_X - 4, yYards: 22 }, { xYards: CENTER_X - 6, yYards: 14 }, { xYards: CENTER_X - 8, yYards: 8 }] },
      { points: [{ xYards: CENTER_X + 2, yYards: 20 }, { xYards: CENTER_X - 2, yYards: 16 }] },
    ],
  },
  iso: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 24 }, { xYards: CENTER_X, yYards: 18 }, { xYards: CENTER_X, yYards: 10 }] },
    ],
  },
  counter: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 24 }, { xYards: CENTER_X + 6, yYards: 22 }, { xYards: CENTER_X + 10, yYards: 16 }, { xYards: CENTER_X + 8, yYards: 10 }] },
    ],
  },
  inside_zone: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 23 }, { xYards: CENTER_X, yYards: 12 }] },
    ],
  },
  outside_zone: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 23 }, { xYards: CENTER_X - 3, yYards: 14 }, { xYards: CENTER_X - 6, yYards: 8 }] },
    ],
  },
  wide_zone: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 23 }, { xYards: CENTER_X - 4, yYards: 10 }] },
    ],
  },
  tight_zone: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 23 }, { xYards: CENTER_X + 2, yYards: 12 }] },
    ],
  },
  sweep: {
    routes: [
      { points: [{ xYards: CENTER_X - 2, yYards: 24 }, { xYards: CENTER_X - 10, yYards: 20 }, { xYards: CENTER_X - 14, yYards: 12 }] },
    ],
  },
  belly: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 24 }, { xYards: CENTER_X - 4, yYards: 18 }, { xYards: CENTER_X - 2, yYards: 10 }] },
    ],
  },

  // Play action / boot
  "pa_boot": {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 22 }, { xYards: CENTER_X - 2, yYards: 16 }] },
      { points: [{ xYards: CENTER_X, yYards: 22 }, { xYards: CENTER_X - 12, yYards: 14 }, { xYards: CENTER_X - 14, yYards: 8 }] },
    ],
  },
  boot: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 22 }, { xYards: CENTER_X - 10, yYards: 14 }, { xYards: CENTER_X - 12, yYards: 8 }] },
    ],
  },
  flood_boot: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 22 }, { xYards: CENTER_X - 8, yYards: 12 }] },
    ],
  },

  // Pass concepts – crossing / mesh / stick
  mesh: {
    routes: [
      { points: [{ xYards: 12, yYards: 18 }, { xYards: 42, yYards: 18 }] },
      { points: [{ xYards: 42, yYards: 20 }, { xYards: 12, yYards: 20 }] },
      { points: [{ xYards: CENTER_X - 8, yYards: 22 }, { xYards: CENTER_X + 6, yYards: 16 }] },
    ],
  },
  "mesh_switch": {
    routes: [
      { points: [{ xYards: 14, yYards: 18 }, { xYards: 40, yYards: 18 }] },
      { points: [{ xYards: 40, yYards: 20 }, { xYards: 14, yYards: 20 }] },
    ],
  },
  stick: {
    routes: [
      { points: [{ xYards: 10, yYards: 18 }, { xYards: 6, yYards: 18 }] },
      { points: [{ xYards: 44, yYards: 18 }, { xYards: 48, yYards: 18 }] },
      { points: [{ xYards: CENTER_X, yYards: 20 }, { xYards: CENTER_X, yYards: 14 }] },
      { points: [{ xYards: CENTER_X - 6, yYards: 22 }, { xYards: CENTER_X - 6, yYards: 16 }] },
    ],
  },
  "stick_nod": {
    routes: [
      { points: [{ xYards: 10, yYards: 18 }, { xYards: 6, yYards: 18 }] },
      { points: [{ xYards: CENTER_X, yYards: 20 }, { xYards: CENTER_X, yYards: 14 }] },
    ],
  },
  smash: {
    routes: [
      { points: [{ xYards: 12, yYards: 16 }, { xYards: 12, yYards: 10 }] },
      { points: [{ xYards: 42, yYards: 20 }, { xYards: 46, yYards: 18 }] },
    ],
  },
  "smash_switch": {
    routes: [
      { points: [{ xYards: 14, yYards: 16 }, { xYards: 14, yYards: 10 }] },
      { points: [{ xYards: 40, yYards: 20 }, { xYards: 44, yYards: 18 }] },
    ],
  },
  curl_flat: {
    routes: [
      { points: [{ xYards: 40, yYards: 18 }, { xYards: 40, yYards: 12 }, { xYards: 36, yYards: 12 }] },
      { points: [{ xYards: 14, yYards: 22 }, { xYards: 8, yYards: 22 }] },
    ],
  },
  four_verticals: {
    routes: [
      { points: [{ xYards: 12, yYards: 20 }, { xYards: 12, yYards: 6 }] },
      { points: [{ xYards: CENTER_X - 4, yYards: 20 }, { xYards: CENTER_X - 4, yYards: 6 }] },
      { points: [{ xYards: CENTER_X + 4, yYards: 20 }, { xYards: CENTER_X + 4, yYards: 6 }] },
      { points: [{ xYards: 42, yYards: 20 }, { xYards: 42, yYards: 6 }] },
    ],
  },
  verticals: {
    routes: [
      { points: [{ xYards: CENTER_X - 6, yYards: 20 }, { xYards: CENTER_X - 6, yYards: 6 }] },
      { points: [{ xYards: CENTER_X + 6, yYards: 20 }, { xYards: CENTER_X + 6, yYards: 6 }] },
    ],
  },
  drive: {
    routes: [
      { points: [{ xYards: 20, yYards: 18 }, { xYards: 34, yYards: 18 }] },
      { points: [{ xYards: 34, yYards: 20 }, { xYards: 20, yYards: 20 }] },
    ],
  },
  spot: {
    routes: [
      { points: [{ xYards: CENTER_X - 4, yYards: 20 }, { xYards: CENTER_X - 4, yYards: 14 }] },
      { points: [{ xYards: CENTER_X + 4, yYards: 20 }, { xYards: CENTER_X + 4, yYards: 14 }] },
    ],
  },
  flood: {
    routes: [
      { points: [{ xYards: 10, yYards: 22 }, { xYards: 6, yYards: 18 }] },
      { points: [{ xYards: CENTER_X - 2, yYards: 20 }, { xYards: CENTER_X - 2, yYards: 10 }] },
      { points: [{ xYards: 38, yYards: 20 }, { xYards: 42, yYards: 14 }] },
    ],
  },
  switch: {
    routes: [
      { points: [{ xYards: CENTER_X - 8, yYards: 20 }, { xYards: CENTER_X + 4, yYards: 16 }] },
      { points: [{ xYards: CENTER_X + 8, yYards: 20 }, { xYards: CENTER_X - 4, yYards: 16 }] },
    ],
  },
  y_cross: {
    routes: [
      { points: [{ xYards: CENTER_X + 6, yYards: 22 }, { xYards: CENTER_X - 10, yYards: 14 }] },
      { points: [{ xYards: 12, yYards: 18 }, { xYards: 42, yYards: 18 }] },
    ],
  },
  quick_game: {
    routes: [
      { points: [{ xYards: 10, yYards: 18 }, { xYards: 6, yYards: 18 }] },
      { points: [{ xYards: 44, yYards: 18 }, { xYards: 48, yYards: 18 }] },
      { points: [{ xYards: CENTER_X, yYards: 20 }, { xYards: CENTER_X, yYards: 16 }] },
    ],
  },
  spacing: {
    routes: [
      { points: [{ xYards: 8, yYards: 20 }, { xYards: 8, yYards: 12 }] },
      { points: [{ xYards: CENTER_X - 6, yYards: 20 }, { xYards: CENTER_X - 6, yYards: 12 }] },
      { points: [{ xYards: CENTER_X + 6, yYards: 20 }, { xYards: CENTER_X + 6, yYards: 12 }] },
      { points: [{ xYards: 46, yYards: 20 }, { xYards: 46, yYards: 12 }] },
    ],
  },
  rpo_bubble: {
    routes: [
      { points: [{ xYards: 42, yYards: 20 }, { xYards: 48, yYards: 16 }, { xYards: 48, yYards: 10 }] },
    ],
  },
  rpo_glance: {
    routes: [
      { points: [{ xYards: CENTER_X + 8, yYards: 18 }, { xYards: CENTER_X + 12, yYards: 12 }] },
    ],
  },
  zone_read: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 22 }, { xYards: CENTER_X - 2, yYards: 12 }] },
    ],
  },
  power_read: {
    routes: [
      { points: [{ xYards: CENTER_X, yYards: 22 }, { xYards: CENTER_X - 6, yYards: 14 }] },
    ],
  },
}
