/**
 * Regression tests for playbook canvas coordinate conversion (xMidYMid meet).
 * Run: npx tsx tests/playbook-canvas-coords.test.ts
 */
import { clientToViewBox } from "../lib/utils/canvas-coords"

const viewBoxW = 800
const viewBoxH = 600

function run() {
  let passed = 0
  let failed = 0

  // Case 1: No letterboxing (rect aspect matches viewBox). Click at center → viewBox center.
  const rect1 = { left: 0, top: 0, width: 800, height: 600 }
  const out1 = clientToViewBox(400, 300, rect1, viewBoxW, viewBoxH)
  if (out1.x === 400 && out1.y === 300) {
    passed++
  } else {
    failed++
    console.error("Fail: center click no letterbox", { expected: { x: 400, y: 300 }, got: out1 })
  }

  // Case 2: Letterboxing on sides (rect wider than viewBox aspect). Scale = 600/600 = 1, offsetX = (1000-800)/2 = 100.
  const rect2 = { left: 0, top: 0, width: 1000, height: 600 }
  const out2 = clientToViewBox(100 + 400, 300, rect2, viewBoxW, viewBoxH) // content area starts at 100, so 500,300 in client = 400,300 in viewBox
  if (out2.x === 400 && out2.y === 300) {
    passed++
  } else {
    failed++
    console.error("Fail: center with letterbox sides", { expected: { x: 400, y: 300 }, got: out2 })
  }

  // Case 3: Letterboxing top/bottom (rect taller). Scale = 800/800 = 1, offsetY = (800-600)/2 = 100.
  const rect3 = { left: 0, top: 0, width: 800, height: 800 }
  const out3 = clientToViewBox(400, 100 + 300, rect3, viewBoxW, viewBoxH)
  if (out3.x === 400 && out3.y === 300) {
    passed++
  } else {
    failed++
    console.error("Fail: center with letterbox top/bottom", { expected: { x: 400, y: 300 }, got: out3 })
  }

  // Case 4: Player hit-test radius sanity: point near (400,300) should be within ~24–48px (getMarkerSize). So (400, 324) is 24px below center.
  const out4 = clientToViewBox(400, 324, rect1, viewBoxW, viewBoxH)
  const dist = Math.sqrt(Math.pow(out4.x - 400, 2) + Math.pow(out4.y - 300, 2))
  if (dist >= 20 && dist <= 30) {
    passed++
  } else {
    failed++
    console.error("Fail: distance from center", { expected: "~24", got: dist })
  }

  if (failed > 0) {
    console.error(`\n${failed} failed, ${passed} passed`)
    process.exit(1)
  }
  console.log(`All ${passed} canvas coordinate tests passed.`)
}

run()
