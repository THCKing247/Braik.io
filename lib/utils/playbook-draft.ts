/**
 * Testable pure helpers for playbook route/block draft logic.
 * Used by playbook-builder and by regression tests.
 */

export interface DraftPoint {
  x: number
  y: number
  xYards: number
  yYards: number
}

export interface RouteDraft {
  playerId: string
  points: DraftPoint[]
}

export interface BlockDraft {
  playerId: string
  endPoint: DraftPoint
}

/** Minimum two points (origin + at least one waypoint) required to finish a route. */
export function canFinishRouteDraft(draft: RouteDraft | null): boolean {
  return draft !== null && draft.points.length >= 2
}

/** Apply a finished route draft to a players array; returns new array with route on the draft's player. */
export function commitRouteDraftToPlayers<T extends { id: string; route?: unknown }>(
  draft: RouteDraft,
  players: T[]
): T[] {
  const pts = draft.points
  return players.map((p) =>
    p.id === draft.playerId
      ? {
          ...p,
          route: pts.map((pt, i) => ({
            x: pt.x,
            y: pt.y,
            xYards: pt.xYards,
            yYards: pt.yYards,
            t: pts.length === 1 ? 1 : i / (pts.length - 1),
          })),
        }
      : p
  )
}

/** Apply a finished block draft to a players array. */
export function commitBlockDraftToPlayers<T extends { id: string; blockingLine?: unknown }>(
  draft: BlockDraft,
  players: T[]
): T[] {
  const ep = draft.endPoint
  return players.map((p) =>
    p.id === draft.playerId
      ? { ...p, blockingLine: { x: ep.x, y: ep.y, xYards: ep.xYards, yYards: ep.yYards } }
      : p
  )
}

/** True if the given player exists in the list (for "start route from player" validation). */
export function canStartRouteFromPlayer(players: { id: string }[], playerId: string): boolean {
  return players.some((p) => p.id === playerId)
}
