"use client"

import { PositionColumn } from "./position-column"

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  imageUrl?: string | null
}

interface DepthChartEntry {
  id: string
  unit: string
  position: string
  string: number
  playerId: string | null
  player?: Player | null
  formation?: string | null
  specialTeamType?: string | null
}

interface DepthChartGridProps {
  topRow: Array<{ position: string; label: string }>
  bottomRow: Array<{ position: string; label: string }>
  depthChart: DepthChartEntry[]
  unit: string
  formation?: string | null
  specialTeamType?: string | null
  canEdit: boolean
  onDrop: (position: string, string: number, playerId: string) => void
  onRemove: (position: string, string: number) => void
  onReorder: (position: string, fromString: number, toString: number) => void
}

export function DepthChartGrid({
  topRow,
  bottomRow,
  depthChart,
  unit,
  formation,
  specialTeamType,
  canEdit,
  onDrop,
  onRemove,
  onReorder,
}: DepthChartGridProps) {
  // Get players for each position
  // Note: For duplicate positions (e.g., multiple "DT" or "S"), they share the same depth chart
  // Each column instance will show the same players - this is by design for simplicity
  const getPlayersForPosition = (position: string) => {
    return depthChart
      .filter(
        (e) =>
          e.unit === unit &&
          e.position === position &&
          e.playerId &&
          e.player &&
          (formation ? e.formation === formation : !e.formation) &&
          (specialTeamType ? e.specialTeamType === specialTeamType : !e.specialTeamType)
      )
      .map((e) => ({
        player: e.player!,
        string: e.string,
      }))
      .sort((a, b) => a.string - b.string)
  }

  const renderRow = (positions: Array<{ position: string; label: string }>) => {
    return (
      <div className="flex gap-4 justify-center">
        {positions.map((pos, idx) => {
          const players = getPlayersForPosition(pos.position)
          // Use index in key to allow duplicate positions (e.g., multiple DT columns)
          return (
            <PositionColumn
              key={`${pos.position}-${idx}`}
              position={pos.position}
              positionLabel={pos.label}
              players={players}
              canEdit={canEdit}
              onDrop={onDrop}
              onRemove={onRemove}
              onReorder={onReorder}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-full" style={{ backgroundColor: "rgb(var(--platinum))" }}>
      <div className="flex flex-col gap-6 pb-4">
        {/* Top Row - 6 positions */}
        {renderRow(topRow)}
        {/* Bottom Row - 5 positions */}
        {renderRow(bottomRow)}
      </div>
    </div>
  )
}
