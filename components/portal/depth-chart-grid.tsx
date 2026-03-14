"use client"

import { useMemo } from "react"
import { PositionColumn } from "./position-column"
import type { FormationPreset, FormationSlot, DepthAssignment } from "@/lib/depth-chart/formation-presets"

export interface RosterPlayerForGrid {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  status?: string
  imageUrl?: string | null
  photo_url?: string | null
  avatar_url?: string | null
}

interface DepthChartGridProps {
  preset: FormationPreset
  assignments: DepthAssignment[]
  /** Roster players; used to resolve player by playerId at render time (no stale copy in assignment). */
  playersById: Map<string, RosterPlayerForGrid>
  unit: string
  formation?: string | null
  specialTeamType?: string | null
  canEdit: boolean
  /** When set, slot keys in this set are valid drop targets for the currently dragged player; others are dimmed. */
  validSlotKeysForDraggingPlayer: Set<string> | null
  /** Called when drag starts from an assigned slot so valid/invalid slot guidance matches roster drag. */
  onDragStartPlayer?: (playerId: string) => void
  onDrop: (position: string, string: number, playerId: string) => void
  onRemove: (position: string, string: number) => void
  onReorder: (position: string, fromString: number, toString: number) => void
}

/** Group slots by row for display (top row = row 0, bottom = row 1). */
function slotsByRow(slots: FormationSlot[]): FormationSlot[][] {
  const byRow = new Map<number, FormationSlot[]>()
  for (const s of slots) {
    const row = byRow.get(s.gridRow) ?? []
    row.push(s)
    byRow.set(s.gridRow, row)
  }
  const rows: FormationSlot[][] = []
  const sortedRows = [...byRow.keys()].sort((a, b) => a - b)
  for (const r of sortedRows) {
    rows.push((byRow.get(r) ?? []).sort((a, b) => a.gridCol - b.gridCol))
  }
  return rows
}

export function DepthChartGrid({
  preset,
  assignments,
  playersById,
  unit,
  formation,
  specialTeamType,
  canEdit,
  validSlotKeysForDraggingPlayer,
  onDragStartPlayer,
  onDrop,
  onRemove,
  onReorder,
}: DepthChartGridProps) {
  const slotRows = useMemo(() => slotsByRow(preset.slots), [preset.slots])

  /** Resolve players from roster by playerId only; never use entry.player. Missing/deleted players show as empty slot. */
  const getResolvedPlayersForSlot = (slotKey: string) => {
    return assignments
      .filter(
        (e) =>
          e.unit === unit &&
          e.position === slotKey &&
          e.playerId != null &&
          (formation ? e.formation === formation : !e.formation) &&
          (specialTeamType ? e.specialTeamType === specialTeamType : !e.specialTeamType)
      )
      .map((e) => {
        const player = playersById.get(e.playerId!)
        return { player: player ?? null, string: e.string }
      })
      .filter((x) => x.player != null)
      .sort((a, b) => a.string - b.string) as Array<{ player: RosterPlayerForGrid; string: number }>
  }

  return (
    <div className="w-full" style={{ backgroundColor: "rgb(var(--platinum))" }}>
      <div className="flex flex-col gap-4 pb-4">
        {slotRows.map((rowSlots, rowIdx) => (
          <div key={rowIdx} className="flex gap-3 justify-center flex-wrap">
            {rowSlots.map((slot, colIdx) => {
              const players = getResolvedPlayersForSlot(slot.slotKey)
              const isSlotValid =
                validSlotKeysForDraggingPlayer === null || validSlotKeysForDraggingPlayer.has(slot.slotKey)
              return (
                <PositionColumn
                  key={`${slot.slotKey}-${rowIdx}-${colIdx}`}
                  position={slot.slotKey}
                  positionLabel={slot.displayLabel}
                  players={players}
                  canEdit={canEdit}
                  isSlotValidForDrop={validSlotKeysForDraggingPlayer === null ? null : isSlotValid}
                  onDragStartPlayer={onDragStartPlayer}
                  onDrop={onDrop}
                  onRemove={onRemove}
                  onReorder={onReorder}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
