/**
 * Route presets for the route library. Points are relative to the player's start position (0, 0).
 * t is normalized progress [0, 1]. Applied route = start position + preset points.
 */

export type RoutePresetPoint = { xYards: number; yYards: number; t: number }

export type RoutePreset = {
  id: string
  name: string
  /** Points relative to origin (0,0). First point should be (0,0,t0); last t typically 1. */
  points: RoutePresetPoint[]
}

/** Half field is ~53.33 yards wide, ~35 yards visible. Routes use yards (x positive = right, y negative = upfield). */
const ROUTE_LENGTH = 12
const SHORT = 6
const MED = 9

export const ROUTE_PRESETS: RoutePreset[] = [
  { id: "slant", name: "Slant", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 3, yYards: -SHORT, t: 0.5 }, { xYards: 6, yYards: -ROUTE_LENGTH, t: 1 }] },
  { id: "go", name: "Go", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 0, yYards: -ROUTE_LENGTH, t: 1 }] },
  { id: "post", name: "Post", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 0, yYards: -MED, t: 0.5 }, { xYards: 6, yYards: -ROUTE_LENGTH, t: 1 }] },
  { id: "out", name: "Out", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 0, yYards: -SHORT, t: 0.4 }, { xYards: 6, yYards: -SHORT, t: 1 }] },
  { id: "corner", name: "Corner", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 0, yYards: -MED, t: 0.5 }, { xYards: 6, yYards: -MED, t: 1 }] },
  { id: "drag", name: "Drag", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 0, yYards: -2, t: 0.2 }, { xYards: 8, yYards: -2, t: 0.8 }, { xYards: 8, yYards: -ROUTE_LENGTH, t: 1 }] },
  { id: "hitch", name: "Hitch", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 0, yYards: -SHORT, t: 0.5 }, { xYards: 0, yYards: -SHORT + 2, t: 0.7 }, { xYards: 0, yYards: -ROUTE_LENGTH, t: 1 }] },
  { id: "wheel", name: "Wheel", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 2, yYards: -2, t: 0.25 }, { xYards: 6, yYards: -ROUTE_LENGTH, t: 1 }] },
  { id: "flat", name: "Flat", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 6, yYards: 0, t: 1 }] },
  { id: "curl", name: "Curl", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 0, yYards: -MED, t: 0.6 }, { xYards: 2, yYards: -MED, t: 1 }] },
  { id: "in", name: "In", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 0, yYards: -SHORT, t: 0.4 }, { xYards: -6, yYards: -SHORT, t: 1 }] },
  { id: "fade", name: "Fade", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 4, yYards: -ROUTE_LENGTH, t: 1 }] },
  { id: "screen", name: "Screen", points: [{ xYards: 0, yYards: 0, t: 0 }, { xYards: 2, yYards: -1, t: 0.5 }, { xYards: 5, yYards: -1, t: 1 }] },
]

/** Return route points for a preset, translated so the first point is at (startXYards, startYYards). */
export function getPresetPointsTranslated(
  presetId: string,
  startXYards: number,
  startYYards: number
): RoutePresetPoint[] {
  const preset = ROUTE_PRESETS.find((p) => p.id === presetId)
  if (!preset || preset.points.length === 0) return []
  const first = preset.points[0]
  const dx = startXYards - first.xYards
  const dy = startYYards - first.yYards
  return preset.points.map((p) => ({
    xYards: p.xYards + dx,
    yYards: p.yYards + dy,
    t: p.t,
  }))
}
