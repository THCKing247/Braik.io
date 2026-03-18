/**
 * Freehand ink sampling, smoothing, and conversion to structured playbook routes.
 * Used by playbook editor (route tool) and can be shared with presenter smoothing.
 */

export type InkSample = { x: number; y: number; pressure: number; t: number }

export type XY = { x: number; y: number }

const MIN_SAMPLES = 3
const MIN_STROKE_LEN_PX = 12

function distSq(a: XY, b: XY): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function distPointToLine(p: XY, a: XY, b: XY): number {
  const l2 = distSq(a, b)
  if (l2 < 1e-6) return Math.sqrt(distSq(p, a))
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2
  t = Math.max(0, Math.min(1, t))
  const px = a.x + t * (b.x - a.x)
  const py = a.y + t * (b.y - a.y)
  return Math.hypot(p.x - px, p.y - py)
}

/** Moving average on x,y (window 3). */
function movingAverageXY(points: XY[], window: number): XY[] {
  if (points.length < window) return [...points]
  const half = Math.floor(window / 2)
  const out: XY[] = []
  for (let i = 0; i < points.length; i++) {
    let sx = 0,
      sy = 0,
      n = 0
    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      sx += points[j].x
      sy += points[j].y
      n++
    }
    out.push({ x: sx / n, y: sy / n })
  }
  return out
}

function catmullRomPoint(p0: XY, p1: XY, p2: XY, p3: XY, t: number): XY {
  const t2 = t * t
  const t3 = t2 * t
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  }
}

/**
 * Catmull-Rom spline through points; samples per segment for smooth curve.
 */
export function smoothCatmullRom(points: XY[], samplesPerSegment = 8): XY[] {
  if (points.length < 2) return [...points]
  if (points.length === 2) return [points[0], points[1]]
  const pts: XY[] = []
  const padded = [points[0], ...points, points[points.length - 1]]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = padded[i]
    const p1 = padded[i + 1]
    const p2 = padded[i + 2]
    const p3 = padded[i + 3]
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment
      pts.push(catmullRomPoint(p0, p1, p2, p3, t))
    }
  }
  pts.push(points[points.length - 1])
  return pts
}

/** Ramer–Douglas–Peucker simplification. */
export function rdpSimplify(points: XY[], epsilon: number): XY[] {
  if (points.length <= 2) return [...points]
  let maxD = 0
  let idx = 0
  const first = points[0]
  const last = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = distPointToLine(points[i], first, last)
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD > epsilon) {
    const left = rdpSimplify(points.slice(0, idx + 1), epsilon)
    const right = rdpSimplify(points.slice(idx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [first, last]
}

function strokeLength(points: XY[]): number {
  let L = 0
  for (let i = 1; i < points.length; i++) L += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return L
}

function angleDeg(a: XY, b: XY, c: XY): number {
  const v1x = a.x - b.x
  const v1y = a.y - b.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y
  const n1 = Math.hypot(v1x, v1y)
  const n2 = Math.hypot(v2x, v2y)
  if (n1 < 1e-6 || n2 < 1e-6) return 180
  const dot = (v1x * v2x + v1y * v2y) / (n1 * n2)
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI
}

/**
 * Reduce points along polyline to ~every maxSpacing px (keeps first/last).
 */
export function resampleSpacing(points: XY[], maxSpacing: number): XY[] {
  if (points.length <= 2) return [...points]
  const out: XY[] = [points[0]]
  let acc = 0
  for (let i = 1; i < points.length; i++) {
    acc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    if (acc >= maxSpacing || i === points.length - 1) {
      out.push(points[i])
      acc = 0
    }
  }
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1])
  return out
}

export interface SmoothPathOptions {
  /** RDP epsilon after smoothing (pixels). Default 4 */
  rdpEpsilon?: number
  /** Samples per spline segment. Default 6 */
  samplesPerSegment?: number
}

/**
 * Full pipeline: samples → smooth → simplify jitter.
 */
export function smoothFreehandPath(samples: InkSample[], opts: SmoothPathOptions = {}): XY[] {
  const { rdpEpsilon = 4, samplesPerSegment = 6 } = opts
  if (samples.length < MIN_SAMPLES) {
    return samples.map((s) => ({ x: s.x, y: s.y }))
  }
  const raw: XY[] = samples.map((s) => ({ x: s.x, y: s.y }))
  const avg = movingAverageXY(raw, 3)
  const splined = smoothCatmullRom(avg, samplesPerSegment)
  const simplified = rdpSimplify(splined, rdpEpsilon * 0.35)
  const again = rdpSimplify(simplified.length >= 3 ? simplified : splined, rdpEpsilon)
  return again.length >= 2 ? again : splined
}

export interface RouteConversionOptions {
  straightEpsilonPx?: number
  /** Deviation from chord — below this = single segment line */
  chordEpsilonPx?: number
  /** Interior angle at vertex below this (degrees) = sharp corner, keep vertex */
  sharpCornerDeg?: number
  maxSpacingPx?: number
  fieldWidthYards?: number
  fieldHeightYards?: number
}

export type RouteWaypoint = { x: number; y: number; xYards: number; yYards: number }

/**
 * Convert smoothed pixel path (first point should be route origin) into route waypoints
 * with yard coords, snapping, and intelligent straight vs polyline.
 */
export function convertPathToRoute(
  smoothed: XY[],
  origin: { x: number; y: number; xYards: number; yYards: number },
  pixelToYard: (x: number, y: number) => { xYards: number; yYards: number },
  yardToPixel: (xYards: number, yYards: number) => { x: number; y: number },
  snapX: (y: number) => number,
  snapY: (y: number) => number,
  opts: RouteConversionOptions = {}
): RouteWaypoint[] {
  const {
    straightEpsilonPx = 5,
    chordEpsilonPx = 6,
    sharpCornerDeg = 38,
    maxSpacingPx = 18,
    fieldWidthYards = 53.33,
    fieldHeightYards = 35,
  } = opts

  if (smoothed.length < 2) return []

  const path: XY[] = [{ x: origin.x, y: origin.y }, ...smoothed.slice(1)]
  if (strokeLength(path) < MIN_STROKE_LEN_PX) return []

  const start = path[0]
  const end = path[path.length - 1]

  let maxChord = 0
  for (let i = 1; i < path.length - 1; i++) {
    maxChord = Math.max(maxChord, distPointToLine(path[i], start, end))
  }

  const toWaypoint = (px: XY): RouteWaypoint => {
    let { xYards, yYards } = pixelToYard(px.x, px.y)
    xYards = Math.max(0, Math.min(fieldWidthYards, snapX(xYards)))
    yYards = Math.max(0, Math.min(fieldHeightYards, snapY(yYards)))
    const pixel = yardToPixel(xYards, yYards)
    return { x: pixel.x, y: pixel.y, xYards, yYards }
  }

  if (maxChord < chordEpsilonPx && Math.hypot(end.x - start.x, end.y - start.y) >= MIN_STROKE_LEN_PX) {
    const a = toWaypoint(start)
    const b = toWaypoint(end)
    if (distSq({ x: a.x, y: a.y }, { x: b.x, y: b.y }) < straightEpsilonPx * straightEpsilonPx) return []
    return [a, b]
  }

  let keyPoints: XY[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const ang = angleDeg(path[i - 1], path[i], path[i + 1])
    if (ang < 180 - sharpCornerDeg) keyPoints.push(path[i])
  }
  keyPoints.push(path[path.length - 1])
  if (keyPoints.length < 2) keyPoints = [path[0], path[path.length - 1]]

  keyPoints = rdpSimplify(keyPoints, straightEpsilonPx * 0.8)
  keyPoints = resampleSpacing(keyPoints, maxSpacingPx)

  const waypoints: RouteWaypoint[] = []
  let prev: RouteWaypoint | null = null
  for (const px of keyPoints) {
    const w = toWaypoint(px)
    if (!prev || distSq({ x: prev.x, y: prev.y }, { x: w.x, y: w.y }) > straightEpsilonPx * straightEpsilonPx) {
      waypoints.push(w)
      prev = w
    }
  }

  if (waypoints.length < 2) return []
  waypoints[0] = toWaypoint(start)
  return waypoints
}

/** Nearest player center within maxDistPx; returns player id and center px. */
export function findNearestPlayerOrigin(
  point: XY,
  players: Array<{ id: string; x: number; y: number }>,
  maxDistPx: number
): { id: string; x: number; y: number } | null {
  let best: { id: string; x: number; y: number; d: number } | null = null
  const maxSq = maxDistPx * maxDistPx
  for (const p of players) {
    const d = distSq(point, { x: p.x, y: p.y })
    if (d <= maxSq && (!best || d < best.d)) best = { id: p.id, x: p.x, y: p.y, d }
  }
  return best ? { id: best.id, x: best.x, y: best.y } : null
}

export function smoothPresenterStroke(samples: InkSample[]): XY[] {
  return smoothFreehandPath(samples, { rdpEpsilon: 3.5, samplesPerSegment: 5 })
}
