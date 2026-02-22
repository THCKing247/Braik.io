"use client"

import { useState } from "react"
import { PlayerCard } from "./player-card"

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

interface PositionAnchor {
  position: string
  label: string
  column: number // 1-12 grid
  row: number // 1-6+ depth
  width?: number // columns to span
}

interface FormationBlueprint {
  name: string
  positions: PositionAnchor[]
}

interface FormationCanvasProps {
  teamId: string
  players: Player[]
  depthChart: DepthChartEntry[]
  onUpdate: (updates: Array<{
    unit: string
    position: string
    string: number
    playerId: string | null
    formation?: string | null
    specialTeamType?: string | null
  }>) => void
  canEdit: boolean
  unit: "offense" | "defense" | "special_teams"
  formation: string
  specialTeamType?: string
  primaryColor?: string
  secondaryColor?: string
}

// Offensive Formation Blueprints
const OFFENSIVE_FORMATIONS: Record<string, FormationBlueprint> = {
  pro_style: {
    name: "Pro Style",
    positions: [
      { position: "LT", label: "LT", column: 4, row: 4 },
      { position: "LG", label: "LG", column: 5, row: 4 },
      { position: "C", label: "C", column: 6, row: 4 },
      { position: "RG", label: "RG", column: 7, row: 4 },
      { position: "RT", label: "RT", column: 8, row: 4 },
      { position: "TE", label: "TE", column: 9, row: 4 },
      { position: "QB", label: "QB", column: 6, row: 5 },
      { position: "RB", label: "RB", column: 6, row: 6 },
      { position: "WRX", label: "WR X", column: 2, row: 6 },
      { position: "WRZ", label: "WR Z", column: 11, row: 6 },
    ]
  },
  i_style: {
    name: "I-Formation",
    positions: [
      { position: "LT", label: "LT", column: 4, row: 4 },
      { position: "LG", label: "LG", column: 5, row: 4 },
      { position: "C", label: "C", column: 6, row: 4 },
      { position: "RG", label: "RG", column: 7, row: 4 },
      { position: "RT", label: "RT", column: 8, row: 4 },
      { position: "QB", label: "QB", column: 6, row: 5 },
      { position: "FB", label: "FB", column: 6, row: 6 },
      { position: "RB", label: "HB", column: 6, row: 7 },
      { position: "WRX", label: "WR X", column: 2, row: 6 },
      { position: "WRZ", label: "WR Z", column: 11, row: 6 },
    ]
  },
  shotgun_twins: {
    name: "Shotgun (Twins)",
    positions: [
      { position: "LT", label: "LT", column: 4, row: 4 },
      { position: "LG", label: "LG", column: 5, row: 4 },
      { position: "C", label: "C", column: 6, row: 4 },
      { position: "RG", label: "RG", column: 7, row: 4 },
      { position: "RT", label: "RT", column: 8, row: 4 },
      { position: "QB", label: "QB", column: 6, row: 6 },
      { position: "RB", label: "RB", column: 6, row: 7 },
      { position: "H", label: "H", column: 6, row: 5 },
      { position: "Y", label: "Y", column: 9, row: 4 },
      { position: "WR1", label: "WR", column: 2, row: 6 },
      { position: "WR2", label: "WR", column: 3, row: 6 },
      { position: "WR3", label: "WR", column: 11, row: 6 },
    ]
  },
  shotgun_one_back: {
    name: "Shotgun (One Back)",
    positions: [
      { position: "LT", label: "LT", column: 4, row: 4 },
      { position: "LG", label: "LG", column: 5, row: 4 },
      { position: "C", label: "C", column: 6, row: 4 },
      { position: "RG", label: "RG", column: 7, row: 4 },
      { position: "RT", label: "RT", column: 8, row: 4 },
      { position: "QB", label: "QB", column: 6, row: 6 },
      { position: "RB", label: "RB", column: 6, row: 7 },
      { position: "H", label: "H", column: 6, row: 5 },
      { position: "Y", label: "Y", column: 9, row: 4 },
      { position: "X", label: "X", column: 2, row: 6 },
      { position: "WRZ", label: "Z", column: 11, row: 6 },
    ]
  },
}

// Defensive Formation Blueprints
const DEFENSIVE_FORMATIONS: Record<string, FormationBlueprint> = {
  "4-3": {
    name: "4-3",
    positions: [
      { position: "DE", label: "DE", column: 3, row: 3 },
      { position: "DT", label: "DT", column: 5, row: 3 },
      { position: "DT", label: "DT", column: 7, row: 3 },
      { position: "DE", label: "DE", column: 9, row: 3 },
      { position: "OLB", label: "OLB", column: 2, row: 2 },
      { position: "MLB", label: "MLB", column: 6, row: 2 },
      { position: "OLB", label: "OLB", column: 10, row: 2 },
      { position: "CB", label: "CB", column: 1, row: 1 },
      { position: "S", label: "S", column: 4, row: 1 },
      { position: "S", label: "S", column: 8, row: 1 },
      { position: "CB", label: "CB", column: 12, row: 1 },
    ]
  },
  "4-4": {
    name: "4-4",
    positions: [
      { position: "DE", label: "DE", column: 3, row: 3 },
      { position: "DT", label: "DT", column: 5, row: 3 },
      { position: "DT", label: "DT", column: 7, row: 3 },
      { position: "DE", label: "DE", column: 9, row: 3 },
      { position: "OLB", label: "OLB", column: 2, row: 2 },
      { position: "ILB", label: "ILB", column: 5, row: 2 },
      { position: "ILB", label: "ILB", column: 7, row: 2 },
      { position: "OLB", label: "OLB", column: 10, row: 2 },
      { position: "CB", label: "CB", column: 1, row: 1 },
      { position: "S", label: "S", column: 4, row: 1 },
      { position: "S", label: "S", column: 9, row: 1 },
      { position: "CB", label: "CB", column: 12, row: 1 },
    ]
  },
  "3-4": {
    name: "3-4",
    positions: [
      { position: "DE", label: "DE", column: 4, row: 3 },
      { position: "NT", label: "NT", column: 6, row: 3 },
      { position: "DE", label: "DE", column: 8, row: 3 },
      { position: "OLB", label: "OLB", column: 2, row: 2 },
      { position: "ILB", label: "ILB", column: 5, row: 2 },
      { position: "ILB", label: "ILB", column: 7, row: 2 },
      { position: "OLB", label: "OLB", column: 10, row: 2 },
      { position: "CB", label: "CB", column: 1, row: 1 },
      { position: "S", label: "S", column: 4, row: 1 },
      { position: "S", label: "S", column: 9, row: 1 },
      { position: "CB", label: "CB", column: 12, row: 1 },
    ]
  },
  "3-3-5": {
    name: "3-3-5",
    positions: [
      { position: "DE", label: "DE", column: 4, row: 3 },
      { position: "NT", label: "NT", column: 6, row: 3 },
      { position: "DE", label: "DE", column: 8, row: 3 },
      { position: "OLB", label: "OLB", column: 2, row: 2 },
      { position: "ILB", label: "ILB", column: 6, row: 2 },
      { position: "OLB", label: "OLB", column: 10, row: 2 },
      { position: "CB", label: "CB", column: 1, row: 1 },
      { position: "S", label: "S", column: 3, row: 1 },
      { position: "S", label: "S", column: 6, row: 1 },
      { position: "S", label: "S", column: 9, row: 1 },
      { position: "CB", label: "CB", column: 12, row: 1 },
    ]
  },
}

// Special Teams Formations
const SPECIAL_TEAMS_FORMATIONS: Record<string, FormationBlueprint> = {
  kickoff: {
    name: "Kickoff",
    positions: [
      { position: "K", label: "K", column: 6, row: 6 },
    ]
  },
  kick_return: {
    name: "Kick Return",
    positions: [
      { position: "KR", label: "KR", column: 6, row: 6 },
      { position: "UP", label: "UP", column: 6, row: 5 },
    ]
  },
  punt: {
    name: "Punt",
    positions: [
      { position: "P", label: "P", column: 6, row: 6 },
      { position: "LS", label: "LS", column: 6, row: 4 },
    ]
  },
  punt_return: {
    name: "Punt Return",
    positions: [
      { position: "PR", label: "PR", column: 6, row: 6 },
      { position: "UP", label: "UP", column: 6, row: 5 },
    ]
  },
  field_goal: {
    name: "Field Goal",
    positions: [
      { position: "K", label: "K", column: 6, row: 6 },
      { position: "LS", label: "LS", column: 6, row: 4 },
      { position: "H", label: "H", column: 6, row: 5 },
    ]
  },
  field_goal_block: {
    name: "Field Goal Block",
    positions: [
      { position: "B", label: "B", column: 6, row: 3 },
    ]
  },
}

export function FormationCanvas({
  teamId,
  players,
  depthChart,
  onUpdate,
  canEdit,
  unit,
  formation,
  specialTeamType,
  primaryColor = "#1e3a5f",
  secondaryColor = "#FFFFFF",
}: FormationCanvasProps) {
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null)
  const [dragOverAnchor, setDragOverAnchor] = useState<{ position: string; string: number } | null>(null)

  // Get current formation blueprint
  const getFormationBlueprint = (): FormationBlueprint => {
    if (unit === "offense") {
      return OFFENSIVE_FORMATIONS[formation] || OFFENSIVE_FORMATIONS.pro_style
    } else if (unit === "defense") {
      return DEFENSIVE_FORMATIONS[formation] || DEFENSIVE_FORMATIONS["4-3"]
    } else {
      return SPECIAL_TEAMS_FORMATIONS[specialTeamType || "kickoff"] || SPECIAL_TEAMS_FORMATIONS.kickoff
    }
  }

  const blueprint = getFormationBlueprint()

  const getPlayerInSlot = (position: string, string: number): Player | null => {
    const entry = depthChart.find(
      (e) =>
        e.unit === unit &&
        e.position === position &&
        e.string === string &&
        e.playerId &&
        (formation ? e.formation === formation : !e.formation) &&
        (specialTeamType ? e.specialTeamType === specialTeamType : !e.specialTeamType)
    )
    return entry?.player || null
  }

  const handleDrop = (position: string, string: number) => {
    if (!draggedPlayerId || !canEdit) return

    const updates: Array<{
      unit: string
      position: string
      string: number
      playerId: string | null
      formation?: string | null
      specialTeamType?: string | null
    }> = []

    // Remove player from any other depth chart slot in this unit/formation
    const otherEntries = depthChart.filter(
      (e) =>
        e.playerId === draggedPlayerId &&
        e.unit === unit &&
        (formation ? e.formation === formation : !e.formation) &&
        (specialTeamType ? e.specialTeamType === specialTeamType : !e.specialTeamType) &&
        !(e.position === position && e.string === string)
    )

    otherEntries.forEach((entry) => {
      updates.push({
        unit: entry.unit,
        position: entry.position,
        string: entry.string,
        playerId: null,
        formation: entry.formation || null,
        specialTeamType: entry.specialTeamType || null,
      })
    })

    // Add player to this slot
    updates.push({
      unit,
      position,
      string,
      playerId: draggedPlayerId,
      formation: formation || null,
      specialTeamType: specialTeamType || null,
    })

    onUpdate(updates)
    setDraggedPlayerId(null)
    setDragOverAnchor(null)
  }

  const handleRemovePlayer = (position: string, string: number) => {
    if (!canEdit) return

    onUpdate([{
      unit,
      position,
      string,
      playerId: null,
      formation: formation || null,
      specialTeamType: specialTeamType || null,
    }])
  }

  const renderPositionAnchor = (anchor: PositionAnchor, position: string, stringNum: number) => {
    // Use the position directly (e.g., "WRX", "WRZ", "WR1", etc.)
    // This allows us to distinguish between different WR positions in formations
    const player = getPlayerInSlot(position, stringNum)
    const isDraggingOver = dragOverAnchor?.position === position && dragOverAnchor?.string === stringNum
    const isStarter = stringNum === 1

    // Calculate grid position (12-column grid, 6-row depth)
    // Offset for stacking backups behind starter
    const columnOffset = stringNum === 2 ? -0.3 : stringNum === 3 ? 0.3 : 0
    const rowOffset = stringNum === 2 ? 0.2 : stringNum === 3 ? -0.2 : 0
    
    const leftPercent = ((anchor.column - 1 + columnOffset) / 12) * 100
    const topPercent = ((anchor.row - 1 + rowOffset) / 6) * 100

    return (
      <div
        key={`${anchor.position}-${stringNum}`}
        className="absolute"
        style={{
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          transform: "translate(-50%, -50%)",
          zIndex: isStarter ? 10 : 5 - stringNum,
        }}
      >
        <div
          className={`transition-all ${
            isDraggingOver ? "scale-110" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDragOverAnchor({ position: position, string: stringNum })
          }}
          onDragLeave={() => {
            setDragOverAnchor(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const playerId = e.dataTransfer.getData("playerId")
            if (playerId) {
              setDraggedPlayerId(playerId)
              handleDrop(position, stringNum)
            }
            setDragOverAnchor(null)
          }}
        >
            {isStarter ? (
            // Starter - show full card
            player ? (
              <div className="relative">
                <div
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("playerId", player.id)
                    e.dataTransfer.effectAllowed = "move"
                    setDraggedPlayerId(player.id)
                  }}
                >
                  <PlayerCard
                    player={player}
                    canEdit={canEdit}
                    size="small"
                  />
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleRemovePlayer(position, stringNum)}
                    className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700 z-20"
                    title="Remove player"
                  >
                    ×
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`w-16 h-20 rounded border-2 flex flex-col items-center justify-center cursor-pointer ${
                  isDraggingOver ? "scale-110" : "hover:scale-105"
                } transition-all`}
                style={{
                  backgroundColor: isDraggingOver ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.1)",
                  borderColor: isDraggingOver ? "#3B82F6" : "#E5E7EB",
                }}
              >
                <div className="text-[10px] text-white/60 font-semibold">{anchor.label}</div>
                <div className="text-[8px] text-white/40 mt-1">1st</div>
              </div>
            )
          ) : (
            // Backup strings - show compact indicator
            player ? (
              <div
                className="w-12 h-8 rounded border text-xs flex items-center justify-center cursor-pointer hover:scale-105 transition-all"
                style={{
                  backgroundColor: "#1E3A8A",
                  borderColor: "#E5E7EB",
                  color: "#FFFFFF",
                }}
                onClick={() => {
                    // Promote to starter
                  if (canEdit) {
                    const starter = getPlayerInSlot(position, 1)
                    const updates = []
                    if (starter) {
                      updates.push({
                        unit,
                        position: position,
                        string: 1,
                        playerId: player.id,
                        formation: formation || null,
                        specialTeamType: specialTeamType || null,
                      })
                      updates.push({
                        unit,
                        position: position,
                        string: stringNum,
                        playerId: starter.id,
                        formation: formation || null,
                        specialTeamType: specialTeamType || null,
                      })
                    } else {
                      updates.push({
                        unit,
                        position: position,
                        string: 1,
                        playerId: player.id,
                        formation: formation || null,
                        specialTeamType: specialTeamType || null,
                      })
                      updates.push({
                        unit,
                        position: position,
                        string: stringNum,
                        playerId: null,
                        formation: formation || null,
                        specialTeamType: specialTeamType || null,
                      })
                    }
                    onUpdate(updates)
                  }
                }}
                title={`${player.firstName} ${player.lastName} - Click to promote`}
              >
                {player.jerseyNumber ? `#${player.jerseyNumber}` : player.firstName[0]}
              </div>
            ) : (
              <div
                className={`w-10 h-6 rounded border text-[8px] flex items-center justify-center ${
                  isDraggingOver ? "" : ""
                }`}
                style={{
                  backgroundColor: isDraggingOver ? "color-mix(in srgb, var(--accent-primary) 20%, transparent)" : "rgba(255, 255, 255, 0.05)",
                  borderColor: isDraggingOver ? "#3B82F6" : "#E5E7EB",
                  color: secondaryColor,
                }}
              >
                {stringNum === 2 ? "2nd" : "3rd"}
              </div>
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full" style={{ minHeight: "600px" }}>
      {/* Football Field Background */}
      <div
        className="absolute inset-0 rounded-lg overflow-hidden"
        style={{
          background: "linear-gradient(to bottom, #0d4d0d 0%, #1a7a1a 50%, #0d4d0d 100%)",
          backgroundImage: `
            repeating-linear-gradient(90deg, transparent, transparent 9.09%, rgba(255,255,255,0.1) 9.09%, rgba(255,255,255,0.1) 9.5%),
            repeating-linear-gradient(0deg, transparent, transparent 16.66%, rgba(255,255,255,0.1) 16.66%, rgba(255,255,255,0.1) 17%)
          `,
        }}
      >
        {/* Yard lines */}
        <div className="absolute inset-0 flex">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <div
              key={i}
              className="flex-1 border-l border-white/20"
              style={{ borderLeftWidth: i === 6 ? "2px" : "1px" }}
            />
          ))}
        </div>
      </div>

      {/* Formation Canvas - 12 column grid */}
      <div className="relative w-full" style={{ minHeight: "600px", aspectRatio: "16/9" }}>
        {blueprint.positions.map((anchor, idx) => {
          // Use unique key for rendering, but store using anchor.position
          const positionKey = `${anchor.position}-${idx}`
          return (
            <div key={positionKey}>
              {[1, 2, 3].map((stringNum) => (
                <div key={`${positionKey}-${stringNum}`}>
                  {renderPositionAnchor(anchor, anchor.position, stringNum)}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Position Labels */}
      {blueprint.positions.map((anchor, idx) => {
        const positionKey = `${anchor.position}-${idx}`
        const leftPercent = ((anchor.column - 1) / 12) * 100
        const topPercent = ((anchor.row - 1) / 6) * 100
        return (
          <div
            key={`label-${positionKey}`}
            className="absolute pointer-events-none z-0"
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent + 10}%`,
              transform: "translateX(-50%)",
              fontSize: "10px",
              color: "rgba(255, 255, 255, 0.5)",
              fontWeight: "bold",
              textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {anchor.label}
          </div>
        )
      })}
    </div>
  )
}
