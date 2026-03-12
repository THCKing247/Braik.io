/**
 * Play animation engine: derive animated player positions from saved route/block
 * data without mutating play state. Used by Presenter and optionally by the editor.
 */

import type { RoutePoint, BlockEndPoint } from "@/types/playbook"

export type YardPoint = { xYards: number; yYards: number }

/** Minimal player shape needed for path computation (from PlayCanvasData.players). */
export type PlayerPathSource = {
  xYards: number
  yYards: number
  route?: RoutePoint[] | null
  blockingLine?: BlockEndPoint | null
}

/**
 * Build the full path in yard space for a player.
 * - route: [start, ...route points]
 * - blockingLine: [start, block end]
 * - neither: [start] (stationary)
 * If both route and blockingLine exist, route takes precedence.
 */
export function normalizeRoutePath(player: PlayerPathSource): YardPoint[] {
  const start: YardPoint = { xYards: player.xYards, yYards: player.yYards }

  if (player.route && player.route.length > 0) {
    const rest = player.route.map((pt) => ({ xYards: pt.xYards, yYards: pt.yYards }))
    return [start, ...rest]
  }

  if (player.blockingLine) {
    return [
      start,
      { xYards: player.blockingLine.xYards, yYards: player.blockingLine.yYards },
    ]
  }

  return [start]
}

/**
 * Total path length in yards (sum of segment lengths).
 */
export function getPathLength(points: YardPoint[]): number {
  if (points.length < 2) return 0
  let length = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    length += Math.hypot(b.xYards - a.xYards, b.yYards - a.yYards)
  }
  return length
}

/**
 * Get point along path at progress in [0, 1].
 * Progress is distance-based (equal movement along path), not time-based.
 */
export function getPointAtProgress(points: YardPoint[], progress: number): YardPoint {
  if (!points.length) return { xYards: 0, yYards: 0 }
  if (points.length === 1 || progress <= 0) return { ...points[0] }
  if (progress >= 1) return { ...points[points.length - 1] }

  const totalLength = getPathLength(points)
  const targetDistance = progress * totalLength
  let accumulated = 0

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const segLen = Math.hypot(b.xYards - a.xYards, b.yYards - a.yYards)
    if (accumulated + segLen >= targetDistance) {
      const t = segLen > 0 ? (targetDistance - accumulated) / segLen : 0
      return {
        xYards: a.xYards + (b.xYards - a.xYards) * t,
        yYards: a.yYards + (b.yYards - a.yYards) * t,
      }
    }
    accumulated += segLen
  }

  return { ...points[points.length - 1] }
}

/**
 * Get animated position for a player at progress in [0, 1].
 * Does not mutate the player; returns yard coordinates.
 */
export function getAnimatedPlayerPosition(
  player: PlayerPathSource,
  progress: number
): YardPoint {
  const path = normalizeRoutePath(player)
  return getPointAtProgress(path, progress)
}
