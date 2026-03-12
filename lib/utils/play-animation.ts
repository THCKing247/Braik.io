/**
 * Play animation engine: derive animated player positions from saved route/block
 * data without mutating play state. Used by Presenter and optionally by the editor.
 */

import type { RoutePoint, BlockEndPoint, AnimationTiming, PreSnapMotion } from "@/types/playbook"

export type YardPoint = { xYards: number; yYards: number }

/** Fraction of the full animation timeline [0, 1] reserved for pre-snap motion. Main play runs from this to 1. */
export const PRE_SNAP_PHASE = 0.2

/**
 * Timing is default when: no animationTiming, or startDelay is 0/unset and durationScale is 1/unset.
 * Custom = startDelay set and !== 0, or durationScale set and !== 1.
 */
export function hasCustomAnimationTiming(
  timing?: AnimationTiming | null
): boolean {
  if (!timing) return false
  if (timing.startDelay != null && timing.startDelay !== 0) return true
  if (timing.durationScale != null && timing.durationScale !== 1) return true
  return false
}

/** Human-readable summary for UI, e.g. "Delay 0.2 · Scale 0.5". Only meaningful when hasCustomAnimationTiming(timing). */
export function formatAnimationTimingSummary(
  timing?: AnimationTiming | null
): string {
  if (!timing) return ""
  const delay = timing.startDelay ?? 0
  const scale = timing.durationScale ?? 1
  return `Delay ${delay} · Scale ${scale}`
}

/** Minimal player shape needed for path computation (from PlayCanvasData.players). */
export type PlayerPathSource = {
  xYards: number
  yYards: number
  route?: RoutePoint[] | null
  blockingLine?: BlockEndPoint | null
  /** Optional per-player timing (applies to main phase only). When absent, global progress is used directly. */
  animationTiming?: AnimationTiming | null
  /** Optional pre-snap motion. Runs in [0, PRE_SNAP_PHASE]; main route/block runs after. */
  preSnapMotion?: PreSnapMotion | null
}

/**
 * Map global progress [0, 1] to per-player effective progress [0, 1] using optional timing.
 * - No timing or defaults: effectiveProgress = globalProgress.
 * - startDelay: player stays at 0 until globalProgress >= startDelay.
 * - durationScale: fraction of remaining timeline (after startDelay) used to go 0→1; 1 = normal, 0.5 = faster, 2 = slower.
 */
export function getEffectiveProgress(
  globalProgress: number,
  timing?: AnimationTiming | null
): number {
  if (!timing || (timing.startDelay == null && timing.durationScale == null)) {
    return Math.max(0, Math.min(1, globalProgress))
  }
  const startDelay = Math.max(0, Math.min(1, timing.startDelay ?? 0))
  const durationScale = Math.max(0.01, timing.durationScale ?? 1)
  if (globalProgress <= startDelay) return 0
  const remaining = 1 - startDelay
  const segment = remaining * durationScale
  if (segment <= 0) return 1
  const effective = (globalProgress - startDelay) / segment
  return Math.max(0, Math.min(1, effective))
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
 * Build pre-snap path: [formation start, ...points] in yard space.
 */
function getPreSnapPath(player: PlayerPathSource): YardPoint[] {
  const start: YardPoint = { xYards: player.xYards, yYards: player.yYards }
  const motion = player.preSnapMotion
  if (!motion?.points?.length) return [start]
  return [start, ...motion.points.map((p) => ({ xYards: p.xYards, yYards: p.yYards }))]
}

/**
 * Get the end point of pre-snap motion (formation position if no motion).
 */
function getPreSnapEndPoint(player: PlayerPathSource): YardPoint {
  const path = getPreSnapPath(player)
  return path.length > 0 ? { ...path[path.length - 1] } : { xYards: player.xYards, yYards: player.yYards }
}

/**
 * Get animated position for a player at global progress in [0, 1].
 * - If globalProgress <= PRE_SNAP_PHASE: pre-snap phase. Players with preSnapMotion move along it; others stay at formation.
 * - If globalProgress > PRE_SNAP_PHASE: main phase. Progress mapped to [0,1]; players with preSnapMotion start from end of motion; animationTiming applies to main phase only.
 * Does not mutate the player; returns yard coordinates.
 */
export function getAnimatedPlayerPosition(
  player: PlayerPathSource,
  globalProgress: number
): YardPoint {
  if (globalProgress <= PRE_SNAP_PHASE) {
    if (!player.preSnapMotion?.points?.length) {
      return { xYards: player.xYards, yYards: player.yYards }
    }
    const preSnapPath = getPreSnapPath(player)
    const preSnapProgress = globalProgress / PRE_SNAP_PHASE
    const duration = player.preSnapMotion.duration ?? 1
    const effectivePreSnap = duration > 0 ? Math.min(1, preSnapProgress / duration) : 1
    return getPointAtProgress(preSnapPath, effectivePreSnap)
  }

  const mainPhaseLength = 1 - PRE_SNAP_PHASE
  const mainProgress = (globalProgress - PRE_SNAP_PHASE) / mainPhaseLength
  const effectiveMain = getEffectiveProgress(mainProgress, player.animationTiming)

  const startForMain = player.preSnapMotion?.points?.length
    ? getPreSnapEndPoint(player)
    : { xYards: player.xYards, yYards: player.yYards }
  const virtualPlayer: PlayerPathSource = {
    ...player,
    xYards: startForMain.xYards,
    yYards: startForMain.yYards,
  }
  const path = normalizeRoutePath(virtualPlayer)
  return getPointAtProgress(path, effectiveMain)
}
