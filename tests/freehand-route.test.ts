/**
 * Freehand route smoothing and conversion.
 * Run: npx tsx tests/freehand-route.test.ts
 */
import {
  smoothFreehandPath,
  convertPathToRoute,
  rdpSimplify,
  findNearestPlayerOrigin,
  type InkSample,
} from "../lib/utils/freehand-route"

function samplesLine(x0: number, y0: number, x1: number, y1: number, n: number): InkSample[] {
  const out: InkSample[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push({
      x: x0 + (x1 - x0) * t + (Math.random() - 0.5) * 0.8,
      y: y0 + (y1 - y0) * t + (Math.random() - 0.5) * 0.8,
      pressure: 0.5,
      t: i,
    })
  }
  return out
}

function run() {
  let passed = 0
  let failed = 0
  const ok = (name: string, cond: boolean) => {
    if (cond) {
      passed++
      console.log("OK", name)
    } else {
      failed++
      console.error("FAIL", name)
    }
  }

  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 0.2 },
    { x: 20, y: 0 },
  ]
  const s = rdpSimplify(pts, 2)
  ok("rdpSimplify keeps endpoints", s[0].x === 0 && s[s.length - 1].x === 20)

  const samples = samplesLine(100, 100, 200, 100, 40)
  const smooth = smoothFreehandPath(samples)
  const maxY = Math.max(...smooth.map((p) => p.y))
  const minY = Math.min(...smooth.map((p) => p.y))
  ok("smoothFreehandPath flattens noisy horizontal line", maxY - minY < 25 && smooth.length >= 2)

  const origin = { x: 100, y: 300, xYards: 26.67, yYards: 20 }
  const smoothed = [
    { x: 100, y: 300 },
    { x: 130, y: 302 },
    { x: 180, y: 298 },
    { x: 220, y: 300 },
  ]
  const pxPerYardX = 800 / 53.33
  const pxPerYardY = 600 / 35
  const yardStart = 15
  const toYard = (px: number, py: number) => ({
    xYards: px / pxPerYardX,
    yYards: yardStart + (600 - py) / pxPerYardY,
  })
  const toPx = (xY: number, yY: number) => ({
    x: xY * pxPerYardX,
    y: 600 - (yY - yardStart) * pxPerYardY,
  })
  const waypoints = convertPathToRoute(
    smoothed,
    origin,
    (x, y) => toYard(x, y),
    (xY, yY) => toPx(xY, yY),
    (x) => x,
    (y) => y,
    { chordEpsilonPx: 12 }
  )
  ok("convertPathToRoute straight → 2 points", waypoints.length === 2)

  const players = [
    { id: "a", x: 10, y: 10 },
    { id: "b", x: 100, y: 100 },
  ]
  ok("findNearestPlayerOrigin", findNearestPlayerOrigin({ x: 12, y: 11 }, players, 20)?.id === "a")
  ok("findNearestPlayerOrigin miss", findNearestPlayerOrigin({ x: 12, y: 11 }, players, 1) === null)

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

run()
