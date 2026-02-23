"use client"

import { useState, useEffect } from "react"
import { PlayerCard } from "./player-card"
import { DepthChartGrid } from "./depth-chart-grid"
import { PositionLabelEditor } from "./position-label-editor"

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

interface DepthChartViewProps {
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
  isHeadCoach?: boolean
}

// Position definitions for each unit (always 11 positions split into 6 top, 5 bottom)
const OFFENSE_POSITIONS = {
  topRow: [
    { position: "LT", label: "LT" },
    { position: "LG", label: "LG" },
    { position: "C", label: "C" },
    { position: "RG", label: "RG" },
    { position: "RT", label: "RT" },
    { position: "TE", label: "TE" },
  ],
  bottomRow: [
    { position: "QB", label: "QB" },
    { position: "RB", label: "RB" },
    { position: "WR", label: "WR" },
    { position: "WR", label: "WR" },
    { position: "FLEX", label: "FLEX" },
  ],
}

const DEFENSE_POSITIONS = {
  topRow: [
    { position: "DE", label: "DE" },
    { position: "DT", label: "DT" },
    { position: "DT", label: "DT" },
    { position: "DE", label: "DE" },
    { position: "OLB", label: "OLB" },
    { position: "MLB", label: "MLB" },
  ],
  bottomRow: [
    { position: "OLB", label: "OLB" },
    { position: "CB", label: "CB" },
    { position: "CB", label: "CB" },
    { position: "S", label: "S" },
    { position: "FLEX", label: "FLEX" },
  ],
}

const SPECIAL_TEAMS_POSITIONS: Record<string, { topRow: Array<{ position: string; label: string }>; bottomRow: Array<{ position: string; label: string }> }> = {
  kickoff: {
    topRow: [
      { position: "L1", label: "L1" },
      { position: "L2", label: "L2" },
      { position: "L3", label: "L3" },
      { position: "L4", label: "L4" },
      { position: "L5", label: "L5" },
      { position: "K", label: "K" },
    ],
    bottomRow: [
      { position: "R1", label: "R1" },
      { position: "R2", label: "R2" },
      { position: "R3", label: "R3" },
      { position: "R4", label: "R4" },
      { position: "R5", label: "R5" },
    ],
  },
  field_goal: {
    topRow: [
      { position: "T", label: "LT" },
      { position: "G", label: "LG" },
      { position: "LS", label: "LS" },
      { position: "G", label: "RG" },
      { position: "T", label: "RT" },
      { position: "Holder", label: "Holder" },
    ],
    bottomRow: [
      { position: "TE", label: "TE" },
      { position: "TE", label: "TE" },
      { position: "Wing", label: "Wing" },
      { position: "Wing", label: "Wing" },
      { position: "K", label: "K" },
    ],
  },
  punt: {
    topRow: [
      { position: "T", label: "LT" },
      { position: "G", label: "LG" },
      { position: "LS", label: "LS" },
      { position: "G", label: "RG" },
      { position: "T", label: "RT" },
      { position: "Back Guard", label: "Back Guard" },
    ],
    bottomRow: [
      { position: "Wing", label: "Wing" },
      { position: "Wing", label: "Wing" },
      { position: "Wide Gunner", label: "Wide Gunner" },
      { position: "Wide Gunner", label: "Wide Gunner" },
      { position: "P", label: "P" },
    ],
  },
  kick_return: {
    topRow: [
      { position: "F1", label: "F1" },
      { position: "F2", label: "F2" },
      { position: "F3", label: "F3" },
      { position: "F4", label: "F4" },
      { position: "F5", label: "F5" },
      { position: "B1", label: "B1" },
    ],
    bottomRow: [
      { position: "B2", label: "B2" },
      { position: "B3", label: "B3" },
      { position: "B4", label: "B4" },
      { position: "Deep Back", label: "Deep Back" },
      { position: "Deep Back", label: "Deep Back" },
    ],
  },
  punt_return: {
    topRow: [
      { position: "DL", label: "DL" },
      { position: "DL", label: "DL" },
      { position: "DL", label: "DL" },
      { position: "DL", label: "DL" },
      { position: "LB", label: "LB" },
      { position: "LB", label: "LB" },
    ],
    bottomRow: [
      { position: "LB", label: "LB" },
      { position: "LB", label: "LB" },
      { position: "CB", label: "CB" },
      { position: "CB", label: "CB" },
      { position: "Deep Returner", label: "Deep Returner" },
    ],
  },
  field_goal_block: {
    topRow: [
      { position: "DL", label: "DL" },
      { position: "DL", label: "DL" },
      { position: "DL", label: "DL" },
      { position: "DL", label: "DL" },
      { position: "DL", label: "DL" },
      { position: "DL", label: "DL" },
    ],
    bottomRow: [
      { position: "LB", label: "LB" },
      { position: "LB", label: "LB" },
      { position: "LB", label: "LB" },
      { position: "Safety", label: "Safety" },
      { position: "Safety", label: "Safety" },
    ],
  },
}

const SPECIAL_TEAM_TYPES = [
  { id: "kickoff", name: "Kickoff" },
  { id: "field_goal", name: "Field Goal" },
  { id: "punt", name: "Punt" },
  { id: "kick_return", name: "Kick Return" },
  { id: "punt_return", name: "Punt Return" },
  { id: "field_goal_block", name: "Field Goal Block" },
]

export function DepthChartView({
  teamId,
  players,
  depthChart,
  onUpdate,
  canEdit,
  isHeadCoach = false,
}: DepthChartViewProps) {
  const [selectedUnit, setSelectedUnit] = useState<"offense" | "defense" | "special_teams">("offense")
  const [selectedSpecialTeamType, setSelectedSpecialTeamType] = useState<string>("kickoff")
  const [filters, setFilters] = useState({
    offense: true,
    defense: true,
    athlete: true,
  })
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({})
  const [labelsLoaded, setLabelsLoaded] = useState(false)

  // Load custom position labels
  useEffect(() => {
    const loadLabels = async () => {
      try {
        const response = await fetch(`/api/roster/depth-chart/position-labels?teamId=${teamId}`)
        if (response.ok) {
          const data = await response.json()
          setCustomLabels(data.labels || {})
        }
      } catch (error) {
        console.error("Failed to load position labels:", error)
      } finally {
        setLabelsLoaded(true)
      }
    }
    loadLabels()
  }, [teamId])

  // Get label key for a position
  const getLabelKey = (position: string, unit: string, specialTeamType?: string | null) => {
    return specialTeamType
      ? `${unit}-${position}-${specialTeamType}`
      : `${unit}-${position}`
  }

  // Get custom label or fallback to default
  const getLabel = (position: string, defaultLabel: string, unit: string, specialTeamType?: string | null) => {
    const key = getLabelKey(position, unit, specialTeamType)
    return customLabels[key] || defaultLabel
  }

  // Get positions for current unit (returns both rows) with custom labels applied
  const getPositions = () => {
    let basePositions
    if (selectedUnit === "offense") {
      basePositions = OFFENSE_POSITIONS
    } else if (selectedUnit === "defense") {
      basePositions = DEFENSE_POSITIONS
    } else {
      basePositions = SPECIAL_TEAMS_POSITIONS[selectedSpecialTeamType] || SPECIAL_TEAMS_POSITIONS.kickoff
    }

    // Apply custom labels
    return {
      topRow: basePositions.topRow.map((pos) => ({
        ...pos,
        label: getLabel(pos.position, pos.label, selectedUnit, selectedUnit === "special_teams" ? selectedSpecialTeamType : null),
      })),
      bottomRow: basePositions.bottomRow.map((pos) => ({
        ...pos,
        label: getLabel(pos.position, pos.label, selectedUnit, selectedUnit === "special_teams" ? selectedSpecialTeamType : null),
      })),
    }
  }

  const handleLabelsUpdated = async () => {
    // Reload labels after update
    try {
      const response = await fetch(`/api/roster/depth-chart/position-labels?teamId=${teamId}`)
      if (response.ok) {
        const data = await response.json()
        setCustomLabels(data.labels || {})
      }
    } catch (error) {
      console.error("Failed to reload position labels:", error)
    }
  }

  // Determine if player is offense-eligible
  const isOffenseEligible = (player: Player) => {
    const offensePositions = ["QB", "RB", "WR", "TE", "OL"]
    return player.positionGroup && offensePositions.includes(player.positionGroup)
  }

  // Determine if player is defense-eligible
  const isDefenseEligible = (player: Player) => {
    const defensePositions = ["DL", "LB", "DB"]
    return player.positionGroup && defensePositions.includes(player.positionGroup)
  }

  // Determine if player is athlete (eligible for both - no specific positionGroup)
  const isAthlete = (player: Player) => {
    return !player.positionGroup
  }

  // Get players not assigned to current unit, filtered by eligibility
  const getPlayersInUnit = () => {
    const unassignedPlayers = players.filter((p) => {
      const inChart = depthChart.some(
        (e) =>
          e.playerId === p.id &&
          e.unit === selectedUnit &&
          (selectedUnit === "special_teams" 
            ? e.specialTeamType === selectedSpecialTeamType
            : !e.specialTeamType && !e.formation)
      )
      return !inChart
    })

    // Apply filters
    return unassignedPlayers.filter((p) => {
      if (filters.offense && isOffenseEligible(p)) return true
      if (filters.defense && isDefenseEligible(p)) return true
      if (filters.athlete && isAthlete(p)) return true
      return false
    })
  }

  // Handle dropping a player into a slot
  const handleDrop = (position: string, string: number, playerId: string) => {
    const updates = []

    // Check if there's already a player in this slot
    const existingEntry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === string &&
        (selectedUnit === "special_teams"
          ? e.specialTeamType === selectedSpecialTeamType
          : !e.specialTeamType && !e.formation)
    )

    // If dropping on starter (string 1), shift everyone down
    if (string === 1) {
      // Remove player from any existing position in this unit
      depthChart
        .filter(
          (e) =>
            e.playerId === playerId &&
            e.unit === selectedUnit &&
            (selectedUnit === "special_teams"
              ? e.specialTeamType === selectedSpecialTeamType
              : !e.specialTeamType && !e.formation)
        )
        .forEach((e) => {
          updates.push({
            unit: e.unit,
            position: e.position,
            string: e.string,
            playerId: null,
            formation: null,
            specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
          })
        })

      // Shift existing starter down
      if (existingEntry && existingEntry.playerId) {
        updates.push({
          unit: selectedUnit,
          position: position,
          string: 2,
          playerId: existingEntry.playerId,
          formation: null,
          specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
        })
      }

      // Set new starter
      updates.push({
        unit: selectedUnit,
        position: position,
        string: 1,
        playerId: playerId,
        formation: null,
        specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
      })
    } else {
      // Dropping on backup slot
      // Remove player from any existing position
      depthChart
        .filter(
          (e) =>
            e.playerId === playerId &&
            e.unit === selectedUnit &&
            (selectedUnit === "special_teams"
              ? e.specialTeamType === selectedSpecialTeamType
              : !e.specialTeamType && !e.formation)
        )
        .forEach((e) => {
          updates.push({
            unit: e.unit,
            position: e.position,
            string: e.string,
            playerId: null,
            formation: null,
            specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
          })
        })

      // If slot is occupied, swap
      if (existingEntry && existingEntry.playerId) {
        // Find where the dropped player currently is
        const droppedPlayerEntry = depthChart.find(
          (e) =>
            e.playerId === playerId &&
            e.unit === selectedUnit &&
            (selectedUnit === "special_teams"
              ? e.specialTeamType === selectedSpecialTeamType
              : !e.specialTeamType && !e.formation)
        )

        if (droppedPlayerEntry) {
          // Swap positions
          updates.push({
            unit: selectedUnit,
            position: position,
            string: string,
            playerId: existingEntry.playerId,
            formation: null,
            specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
          })
          updates.push({
            unit: selectedUnit,
            position: droppedPlayerEntry.position,
            string: droppedPlayerEntry.string,
            playerId: playerId,
            formation: null,
            specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
          })
        } else {
          // Just place in slot
          updates.push({
            unit: selectedUnit,
            position: position,
            string: string,
            playerId: playerId,
            formation: null,
            specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
          })
        }
      } else {
        // Empty slot, just place player
        updates.push({
          unit: selectedUnit,
          position: position,
          string: string,
          playerId: playerId,
          formation: null,
          specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
        })
      }
    }

    if (updates.length > 0) {
      onUpdate(updates)
    }
  }

  // Handle removing a player from a slot
  const handleRemove = (position: string, string: number) => {
    const entry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === string &&
        (selectedUnit === "special_teams"
          ? e.specialTeamType === selectedSpecialTeamType
          : !e.specialTeamType && !e.formation)
    )

    if (entry) {
      onUpdate([
        {
          unit: selectedUnit,
          position: position,
          string: string,
          playerId: null,
          formation: null,
          specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
        },
      ])
    }
  }

  // Handle reordering within a slot (promoting/demoting)
  const handleReorder = (position: string, fromString: number, toString: number) => {
    const fromEntry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === fromString &&
        (selectedUnit === "special_teams"
          ? e.specialTeamType === selectedSpecialTeamType
          : !e.specialTeamType && !e.formation)
    )

    const toEntry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === toString &&
        (selectedUnit === "special_teams"
          ? e.specialTeamType === selectedSpecialTeamType
          : !e.specialTeamType && !e.formation)
    )

    const updates = []

    if (fromEntry && fromEntry.playerId) {
      // Swap the players
      if (toEntry && toEntry.playerId) {
        updates.push({
          unit: selectedUnit,
          position: position,
          string: toString,
          playerId: fromEntry.playerId,
          formation: null,
          specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
        })
        updates.push({
          unit: selectedUnit,
          position: position,
          string: fromString,
          playerId: toEntry.playerId,
          formation: null,
          specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
        })
      } else {
        // Move player to empty slot
        updates.push({
          unit: selectedUnit,
          position: position,
          string: fromString,
          playerId: null,
          formation: null,
          specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
        })
        updates.push({
          unit: selectedUnit,
          position: position,
          string: toString,
          playerId: fromEntry.playerId,
          formation: null,
          specialTeamType: selectedUnit === "special_teams" ? selectedSpecialTeamType : null,
        })
      }

      if (updates.length > 0) {
        onUpdate(updates)
      }
    }
  }

  return (
    <div
      className="rounded-lg"
      style={{ backgroundColor: "rgb(var(--platinum))", minHeight: "calc(100vh - 200px)", height: "100%" }}
    >
      {/* Grid Layout: Available Players (Left) | Depth Chart (Center) */}
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: "280px 1fr",
          gap: 0,
        }}
      >
        {/* Available Players - Left Sidebar */}
        <div
          className="overflow-y-auto"
          style={{
            padding: "16px",
            borderRight: "1px solid #2a2a2a",
          }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: "#000000" }}>Available Players</h3>
          
          {/* Filter Toggles */}
          <div className="mb-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setFilters({ ...filters, offense: !filters.offense })}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border ${
                filters.offense ? "" : "opacity-60 hover:opacity-100"
              }`}
              style={{
                color: filters.offense ? "#000000" : "#000000",
              }}
              style={{
                backgroundColor: filters.offense ? "rgb(var(--braik-navy))" : "transparent",
                borderColor: "#3B82F6",
              }}
            >
              Offense
            </button>
            <button
              onClick={() => setFilters({ ...filters, defense: !filters.defense })}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border ${
                filters.defense ? "" : "opacity-60 hover:opacity-100"
              }`}
              style={{
                color: filters.defense ? "#000000" : "#000000",
              }}
              style={{
                backgroundColor: filters.defense ? "rgb(var(--braik-navy))" : "transparent",
                borderColor: "#3B82F6",
              }}
            >
              Defense
            </button>
            <button
              onClick={() => setFilters({ ...filters, athlete: !filters.athlete })}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border ${
                filters.athlete ? "" : "opacity-60 hover:opacity-100"
              }`}
              style={{
                color: filters.athlete ? "#000000" : "#000000",
              }}
              style={{
                backgroundColor: filters.athlete ? "rgb(var(--braik-navy))" : "transparent",
                borderColor: "#3B82F6",
              }}
            >
              Athlete
            </button>
          </div>

          <div className="space-y-2 flex flex-col items-center">
            {getPlayersInUnit().map((player) => (
              <div key={player.id} style={{ width: '100%', maxWidth: '230px' }}>
                <PlayerCard
                  player={player}
                  canEdit={false}
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("playerId", player.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                />
              </div>
            ))}
            {getPlayersInUnit().length === 0 && (
              <div className="text-xs text-center py-4" style={{ color: "#666666" }}>
                All players assigned
              </div>
            )}
          </div>
        </div>

        {/* Depth Chart Area - Center */}
        <div
          className="flex flex-col"
          style={{
            padding: "24px",
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "stretch",
          }}
        >
          {/* Unit Selector and Edit Button */}
          <div className="mb-4 flex gap-2 items-center justify-between">
            <div className="flex gap-2">
              {(["offense", "defense", "special_teams"] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => {
                    setSelectedUnit(unit)
                    if (unit === "special_teams") {
                      setSelectedSpecialTeamType("kickoff")
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all border-2 ${
                    selectedUnit === unit ? "" : "opacity-60 hover:opacity-100"
                  }`}
                  style={{
                    color: selectedUnit === unit ? "#000000" : "#000000",
                  }}
                  style={{
                    backgroundColor: selectedUnit === unit ? "rgb(var(--braik-navy))" : "transparent",
                    borderColor: "#3B82F6",
                  }}
                >
                  {unit === "offense" ? "Offense" : unit === "defense" ? "Defense" : "Special Teams"}
                </button>
              ))}
            </div>
            {/* Edit Position Labels Button - Head Coach Only */}
            {isHeadCoach && labelsLoaded && (
              <PositionLabelEditor
                teamId={teamId}
                unit={selectedUnit}
                positions={[...getPositions().topRow, ...getPositions().bottomRow]}
                specialTeamType={selectedUnit === "special_teams" ? selectedSpecialTeamType : null}
                onLabelsUpdated={handleLabelsUpdated}
              />
            )}
          </div>

          {/* Special Team Type Selector (only for special teams) */}
          {selectedUnit === "special_teams" && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {SPECIAL_TEAM_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedSpecialTeamType(type.id)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all border ${
                      selectedSpecialTeamType === type.id
                        ? ""
                        : "opacity-60 hover:opacity-100"
                    }`}
                    style={{
                      color: selectedSpecialTeamType === type.id ? "#000000" : "#000000",
                    }}
                    style={{
                      backgroundColor:
                        selectedSpecialTeamType === type.id ? "rgb(var(--braik-navy))" : "transparent",
                      borderColor: "#3B82F6",
                    }}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Depth Chart Grid */}
          <div className="flex-1 overflow-auto">
            <DepthChartGrid
              topRow={getPositions().topRow}
              bottomRow={getPositions().bottomRow}
              depthChart={depthChart}
              unit={selectedUnit}
              formation={null}
              specialTeamType={selectedUnit === "special_teams" ? selectedSpecialTeamType : null}
              canEdit={canEdit}
              onDrop={handleDrop}
              onRemove={handleRemove}
              onReorder={handleReorder}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
