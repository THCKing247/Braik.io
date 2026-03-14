"use client"

import { useMemo } from "react"
import { PositionColumn } from "./position-column"
import type {
  FormationPreset,
  FormationRow,
  FormationSlot,
  DepthAssignment,
  RowAlignment,
} from "@/lib/depth-chart/formation-presets"
import { getAcceptedGroupsDisplay } from "@/lib/depth-chart/eligibility"

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
  playersById: Map<string, RosterPlayerForGrid>
  unit: string
  formation?: string | null
  specialTeamType?: string | null
  canEdit: boolean
  validSlotKeysForDraggingPlayer: Set<string> | null
  onDragStartPlayer?: (playerId: string) => void
  onDrop: (position: string, string: number, playerId: string) => void
  onRemove: (position: string, string: number) => void
  onReorder: (position: string, fromString: number, toString: number) => void
}

/** Legacy: group slots by gridRow when preset has no rows. */
function slotsByRow(slots: FormationSlot[]): FormationSlot[][] {
  const byRow = new Map<number, FormationSlot[]>()
  for (const s of slots) {
    const r = s.gridRow ?? 0
    const row = byRow.get(r) ?? []
    row.push(s)
    byRow.set(r, row)
  }
  const sortedRows = [...byRow.keys()].sort((a, b) => a - b)
  return sortedRows.map((r) => (byRow.get(r) ?? []).sort((a, b) => (a.gridCol ?? 0) - (b.gridCol ?? 0)))
}

function rowAlignmentClass(alignment: RowAlignment): string {
  switch (alignment) {
    case "center":
      return "justify-center"
    case "spread":
      return "justify-between"
    case "left":
      return "justify-start"
    case "right":
      return "justify-end"
    default:
      return "justify-center"
  }
}

/** Extra bottom spacing for row type to separate formation sections (trench / backfield / skill). */
function rowTypeSpacingClass(rowType?: string): string {
  switch (rowType) {
    case "line":
    case "front":
      return "mb-3"
    case "backfield":
    case "second":
      return "mb-4"
    case "skill":
    case "secondary":
      return "mb-3"
    default:
      return "mb-2"
  }
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
  const useRows = preset.rows && preset.rows.length > 0
  const rowList: FormationRow[] = useMemo(() => {
    if (useRows) return preset.rows!
    const legacyRows = slotsByRow(preset.slots)
    return legacyRows.map((slots) => ({
      alignment: "center" as RowAlignment,
      slots,
    }))
  }, [preset.rows, preset.slots, useRows])

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
      <div className="flex flex-col gap-1 pb-4">
        {rowList.map((formationRow, rowIdx) => {
          const alignClass = rowAlignmentClass(formationRow.alignment)
          const spacingClass = rowTypeSpacingClass(formationRow.rowType)
          return (
            <div
              key={formationRow.id ?? rowIdx}
              className={`flex flex-wrap gap-3 items-start ${alignClass} ${spacingClass} px-2`}
            >
              {formationRow.slots.map((slot, colIdx) => {
                const players = getResolvedPlayersForSlot(slot.slotKey)
                const isSlotValid =
                  validSlotKeysForDraggingPlayer === null || validSlotKeysForDraggingPlayer.has(slot.slotKey)
                return (
                  <PositionColumn
                    key={`${slot.slotKey}-${rowIdx}-${colIdx}`}
                    position={slot.slotKey}
                    positionLabel={slot.displayLabel}
                    secondaryLabel={slot.alias && slot.positionGroup ? slot.positionGroup : undefined}
                    emptySlotHint={getAcceptedGroupsDisplay(slot)}
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
          )
        })}
      </div>
    </div>
  )
}
