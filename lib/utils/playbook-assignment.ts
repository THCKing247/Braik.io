/**
 * Assignment summary and status for playbook plays (position-based markers vs depth chart).
 * Used by browser filters/sort and play cards. No persistence; computed from play + depth chart.
 */

import { getPlayerForSlot, type DepthChartSlot } from "@/lib/constants/playbook-positions"
import type { PlayRecord } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"

export type AssignmentStatus = "complete" | "incomplete" | "none"

export interface AssignmentSummary {
  assigned: number
  total: number
}

/**
 * Returns { assigned, total } for position-based markers on the play, or null if no position-based markers.
 */
export function getAssignmentSummary(
  play: PlayRecord,
  depthChartEntries: DepthChartSlot[] | null | undefined
): AssignmentSummary | null {
  if (!depthChartEntries?.length || !play.canvasData?.players?.length) return null
  const players = (play.canvasData as PlayCanvasData).players ?? []
  const positionBased = players.filter((p: { positionCode?: string | null }) => p.positionCode)
  if (!positionBased.length) return null
  const assigned = positionBased.filter(
    (p: { positionCode?: string | null; positionNumber?: number | null }) =>
      getPlayerForSlot(depthChartEntries, play.side, p.positionCode!, p.positionNumber ?? 1)
  ).length
  return { assigned, total: positionBased.length }
}

/**
 * Derives a single status for badges and filtering.
 * - none: no position-based markers
 * - complete: all position-based markers have assignees
 * - incomplete: at least one unassigned
 */
export function getAssignmentStatus(
  play: PlayRecord,
  depthChartEntries: DepthChartSlot[] | null | undefined
): AssignmentStatus {
  const summary = getAssignmentSummary(play, depthChartEntries)
  if (!summary || summary.total === 0) return "none"
  return summary.assigned === summary.total ? "complete" : "incomplete"
}
