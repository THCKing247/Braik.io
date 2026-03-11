/**
 * Regression tests for playbook route/block draft logic.
 * Run: npx tsx tests/playbook-draft.test.ts
 */
import {
  canFinishRouteDraft,
  commitRouteDraftToPlayers,
  commitBlockDraftToPlayers,
  canStartRouteFromPlayer,
  type RouteDraft,
  type BlockDraft,
} from "../lib/utils/playbook-draft"

function run() {
  let passed = 0
  let failed = 0

  const point = (x: number, y: number) => ({ x, y, xYards: x / 10, yYards: y / 10 })

  // --- canFinishRouteDraft ---
  if (!canFinishRouteDraft(null)) passed++
  else { failed++; console.error("Fail: null draft not finishable") }

  if (!canFinishRouteDraft({ playerId: "p1", points: [point(0, 0)] })) passed++
  else { failed++; console.error("Fail: single-point route not finishable") }

  if (canFinishRouteDraft({ playerId: "p1", points: [point(0, 0), point(10, 10)] })) passed++
  else { failed++; console.error("Fail: two-point route finishable") }

  if (canFinishRouteDraft({ playerId: "p1", points: [point(0, 0), point(5, 5), point(10, 10)] })) passed++
  else { failed++; console.error("Fail: three-point route finishable") }

  // --- commitRouteDraftToPlayers ---
  const players = [
    { id: "p1", route: undefined as unknown },
    { id: "p2", route: undefined as unknown },
  ]
  const draft: RouteDraft = {
    playerId: "p1",
    points: [point(0, 0), point(10, 10)],
  }
  const after = commitRouteDraftToPlayers(draft, players)
  const p1After = after.find((p) => p.id === "p1")
  if (p1After && Array.isArray(p1After.route) && p1After.route.length === 2) passed++
  else { failed++; console.error("Fail: commitRouteDraftToPlayers", { after, p1After }) }

  const p2After = after.find((p) => p.id === "p2")
  if (p2After && p2After.route === undefined) passed++
  else { failed++; console.error("Fail: other player unchanged", { p2After }) }

  // --- commitBlockDraftToPlayers ---
  const playersWithBlock = [
    { id: "b1", blockingLine: undefined as unknown },
    { id: "b2", blockingLine: undefined as unknown },
  ]
  const blockDraft: BlockDraft = { playerId: "b1", endPoint: point(20, 20) }
  const afterBlock = commitBlockDraftToPlayers(blockDraft, playersWithBlock)
  const b1After = afterBlock.find((p) => p.id === "b1")
  if (b1After && b1After.blockingLine && typeof b1After.blockingLine === "object" && "x" in b1After.blockingLine) passed++
  else { failed++; console.error("Fail: commitBlockDraftToPlayers", { afterBlock, b1After }) }

  // --- canStartRouteFromPlayer ---
  if (canStartRouteFromPlayer(players, "p1")) passed++
  else { failed++; console.error("Fail: can start from p1") }
  if (!canStartRouteFromPlayer(players, "p99")) passed++
  else { failed++; console.error("Fail: cannot start from missing p99") }

  if (failed > 0) {
    console.error(`\n${failed} failed, ${passed} passed`)
    process.exit(1)
  }
  console.log(`All ${passed} playbook draft tests passed.`)
}

run()
