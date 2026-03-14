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

/** Row spacing for football hierarchy: WR/perimeter → OL/trench → QB → RB/backfield. */
function rowTypeSpacingClass(rowType?: string): string {
  switch (rowType) {
    case "skill":
    case "secondary":
      return "mb-2"   /* slightly tighter below WR row */
    case "line":
    case "front":
      return "mb-5"   /* moderate gap below OL/trench */
    case "backfield":
    case "second":
      return "mb-2"   /* slightly tighter between QB and RB */
    default:
      return "mb-3"
  }
}

/** For spread alignment, keep slots on one row (no wrap); others may wrap on small screens. */
function rowWrapClass(alignment: RowAlignment): string {
  return alignment === "spread" ? "flex-nowrap" : "flex-wrap"
}

/** Single flex row for WR/skill spread: one row container, full width, slots distributed. */
function formationRowClass(alignment: RowAlignment, rowType?: string): string {
  const base = "formation-row flex items-start w-full"
  if (alignment === "spread") {
    return `${base} justify-between flex-nowrap max-w-[900px] mx-auto gap-2`
  }
  if (alignment === "center") {
    return `${base} justify-center flex-wrap gap-4`
  }
  if (alignment === "left") return `${base} justify-start flex-wrap gap-3`
  if (alignment === "right") return `${base} justify-end flex-wrap gap-3`
  return `${base} justify-center flex-wrap gap-3`
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
    <div
      className="w-full max-w-4xl mx-auto rounded-xl py-5 px-4"
      style={{
        backgroundColor: "rgb(var(--platinum))",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex flex-col pb-4">
        {rowList.map((formationRow, rowIdx) => {
          const spacingClass = rowTypeSpacingClass(formationRow.rowType)
          const rowClass = formationRowClass(formationRow.alignment, formationRow.rowType)
          const isWrRow = formationRow.rowType === "skill" && formationRow.alignment === "spread"
          return (
            <div
              key={formationRow.id ?? rowIdx}
              className={`${rowClass} ${spacingClass} px-1 ${isWrRow ? "wr-row" : ""}`}
              data-formation-row={formationRow.rowType ?? "default"}
              data-alignment={formationRow.alignment}
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
