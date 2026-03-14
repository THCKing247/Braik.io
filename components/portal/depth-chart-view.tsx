"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { PlayerCard } from "./player-card"
import { DepthChartGrid } from "./depth-chart-grid"
import { PositionLabelEditor } from "./position-label-editor"
import { DepthChartPrintView } from "./depth-chart-print-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Printer } from "lucide-react"
import {
  getPresetsForSide,
  getPreset,
  getFormationSlots,
  DEFAULT_PRESET_BY_SIDE,
  type DepthAssignment,
  type FormationPreset,
  type FormationSlot,
} from "@/lib/depth-chart/formation-presets"
import { getValidSlotKeys, getBestFitSlotKeys } from "@/lib/depth-chart/eligibility"

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  imageUrl?: string | null
  healthStatus?: "active" | "injured" | "unavailable"
}

interface DepthChartEntry {
  id: string
  unit: string
  position: string
  string: number
  playerId: string | null
  formation?: string | null
  specialTeamType?: string | null
}

type DepthChartUpdate = {
  unit: string
  position: string
  string: number
  playerId: string | null
  formation?: string | null
  specialTeamType?: string | null
}

interface DepthChartViewProps {
  teamId: string
  players: Player[]
  depthChart: DepthChartEntry[]
  onUpdate: (updates: DepthChartUpdate[]) => void
  canEdit: boolean
  isHeadCoach?: boolean
  /** Optional team name for print header */
  teamName?: string | null
}

type Side = "offense" | "defense" | "special_teams"

const DEPTH_CHART_PRINT_STYLES = `
@media print {
  @page {
    margin: 0.5in !important;
    size: auto;
  }
  body * {
    display: none !important;
  }
  body > .depth-chart-print-portal {
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    pointer-events: auto !important;
  }
  body > .depth-chart-print-portal * {
    display: revert !important;
    visibility: visible !important;
    color: black !important;
  }
  body > .depth-chart-print-portal .depth-chart-print-root {
    display: block !important;
    position: static !important;
    margin: 0 auto !important;
    padding: 0.5in !important;
    color: black !important;
    background: white !important;
  }
}
`

export function DepthChartView({
  teamId,
  players,
  depthChart,
  onUpdate,
  canEdit,
  isHeadCoach = false,
  teamName = null,
}: DepthChartViewProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [selectedUnit, setSelectedUnit] = useState<Side>("offense")
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [selectedPresetByUnit, setSelectedPresetByUnit] = useState<Record<Side, string>>(() => ({
    offense: DEFAULT_PRESET_BY_SIDE.offense,
    defense: DEFAULT_PRESET_BY_SIDE.defense,
    special_teams: DEFAULT_PRESET_BY_SIDE.special_teams,
  }))
  const selectedPresetId = selectedPresetByUnit[selectedUnit] ?? DEFAULT_PRESET_BY_SIDE[selectedUnit]
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({})
  const [labelsLoaded, setLabelsLoaded] = useState(false)

  // Roster list filters (only affect left sidebar, not slots)
  const [searchQuery, setSearchQuery] = useState("")
  const [positionFilter, setPositionFilter] = useState<string>("")
  const [sideOfBallFilter, setSideOfBallFilter] = useState<"all" | "offense" | "defense" | "athlete">("all")
  const [activeOnly, setActiveOnly] = useState(false)
  const [unassignedOnly, setUnassignedOnly] = useState(true)
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null)

  // Clear drag state on dragend (drop, cancel, or release outside) so UI never stays stuck
  useEffect(() => {
    const clearDrag = () => setDraggingPlayerId(null)
    document.addEventListener("dragend", clearDrag)
    return () => document.removeEventListener("dragend", clearDrag)
  }, [])

  // Clear drag state when switching unit/preset so valid-slot guidance is not stale
  useEffect(() => {
    setDraggingPlayerId(null)
  }, [selectedUnit, selectedPresetId])

  const preset = getPreset(selectedUnit, selectedPresetId) ?? getPreset(selectedUnit, DEFAULT_PRESET_BY_SIDE[selectedUnit]) ?? null
  const presetsForSide = useMemo(() => getPresetsForSide(selectedUnit), [selectedUnit])

  useEffect(() => {
    if (selectedUnit && selectedPresetId && !getPreset(selectedUnit, selectedPresetId)) {
      setSelectedPresetByUnit((prev) => ({ ...prev, [selectedUnit]: DEFAULT_PRESET_BY_SIDE[selectedUnit] }))
    }
  }, [selectedUnit, selectedPresetId])

  // Formation/specialTeamType for current view (used when saving and filtering assignments)
  const currentFormation = selectedUnit === "special_teams" ? null : selectedPresetId
  const currentSpecialTeamType = selectedUnit === "special_teams" ? selectedPresetId : null

  const getLabelKey = (position: string, unit: string, specialTeamType?: string | null) => {
    return specialTeamType ? `${unit}-${position}-${specialTeamType}` : `${unit}-${position}`
  }

  const getLabel = (position: string, defaultLabel: string, unit: string, specialTeamType?: string | null) => {
    return customLabels[getLabelKey(position, unit, specialTeamType)] ?? defaultLabel
  }

  const presetWithLabels = useMemo((): FormationPreset | null => {
    if (!preset) return null
    const stType = selectedUnit === "special_teams" ? currentSpecialTeamType : null
    const withLabel = (s: FormationSlot): FormationSlot => ({
      ...s,
      displayLabel: getLabel(s.slotKey, s.alias ?? s.displayLabel, selectedUnit, stType),
    })
    if (preset.rows?.length) {
      return {
        ...preset,
        rows: preset.rows.map((r) => ({
          ...r,
          slots: r.slots.map(withLabel),
        })),
        slots: preset.rows.flatMap((r) => r.slots.map(withLabel)),
      }
    }
    return {
      ...preset,
      slots: preset.slots.map(withLabel),
    }
  }, [preset, customLabels, selectedUnit, currentSpecialTeamType])

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

  const handleLabelsUpdated = async () => {
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

  const isOffenseEligible = (p: Player) =>
    p.positionGroup && ["QB", "RB", "WR", "TE", "OL"].includes(p.positionGroup)
  const isDefenseEligible = (p: Player) =>
    p.positionGroup && ["DL", "LB", "DB"].includes(p.positionGroup)
  const isAthlete = (p: Player) => !p.positionGroup

  const assignedPlayerIdsOnCurrentSide = useMemo(() => {
    return new Set(
      depthChart
        .filter(
          (e) =>
            e.unit === selectedUnit &&
            e.playerId &&
            (selectedUnit === "special_teams"
              ? e.specialTeamType === currentSpecialTeamType
              : !e.specialTeamType && e.formation === currentFormation)
        )
        .map((e) => e.playerId!)
        .filter(Boolean)
    )
  }, [depthChart, selectedUnit, currentFormation, currentSpecialTeamType])

  const filteredRosterForSidebar = useMemo(() => {
    let list = players

    if (unassignedOnly) {
      list = list.filter((p) => !assignedPlayerIdsOnCurrentSide.has(p.id))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (p) =>
          (p.firstName?.toLowerCase() ?? "").includes(q) ||
          (p.lastName?.toLowerCase() ?? "").includes(q) ||
          `${(p.firstName ?? "").toLowerCase()} ${(p.lastName ?? "").toLowerCase()}`.includes(q) ||
          `${(p.lastName ?? "").toLowerCase()} ${(p.firstName ?? "").toLowerCase()}`.includes(q)
      )
    }

    if (positionFilter) {
      const pos = positionFilter.toUpperCase()
      list = list.filter((p) => (p.positionGroup?.toUpperCase() ?? "") === pos)
    }

    if (sideOfBallFilter !== "all") {
      if (sideOfBallFilter === "offense") list = list.filter(isOffenseEligible)
      else if (sideOfBallFilter === "defense") list = list.filter(isDefenseEligible)
      else list = list.filter(isAthlete)
    }

    if (activeOnly) {
      list = list.filter((p) => (p.healthStatus ?? p.status) === "active")
    }

    return list
  }, [
    players,
    searchQuery,
    positionFilter,
    sideOfBallFilter,
    activeOnly,
    unassignedOnly,
    assignedPlayerIdsOnCurrentSide,
  ])

  const playersById = useMemo(
    () =>
      new Map(
        players.map((p) => [
          p.id,
          {
            ...p,
            imageUrl: p.imageUrl ?? undefined,
            image_url: (p as unknown as Record<string, unknown>).image_url as string | null | undefined,
            avatar_url: (p as unknown as Record<string, unknown>).avatar_url as string | null | undefined,
            photo_url: (p as unknown as Record<string, unknown>).photo_url as string | null | undefined,
          },
        ])
      ),
    [players]
  )

  const validSlotKeysForDraggingPlayer = useMemo(() => {
    if (!draggingPlayerId || !preset) return null
    const slots = getFormationSlots(preset)
    const player = playersById.get(draggingPlayerId)
    if (!player) return new Set(slots.map((s) => s.slotKey))
    return getValidSlotKeys(player.positionGroup, slots)
  }, [draggingPlayerId, playersById, preset])

  const eligibilityHintsByPlayerId = useMemo(() => {
    if (!preset || !presetWithLabels) return new Map<string, string>()
    const slots = getFormationSlots(preset)
    const slotsWithLabels = getFormationSlots(presetWithLabels)
    const keyToLabel = new Map(slotsWithLabels.map((s) => [s.slotKey, s.displayLabel]))
    const map = new Map<string, string>()
    for (const p of players) {
      const keys = getBestFitSlotKeys(p.positionGroup, slots)
      const labels = keys.slice(0, 3).map((k) => keyToLabel.get(k) ?? k)
      if (labels.length) map.set(p.id, `Best fit: ${labels.join(", ")}`)
    }
    return map
  }, [preset, presetWithLabels, players])

  const handleDragStartPlayer = useCallback((playerId: string) => {
    setDraggingPlayerId(playerId)
  }, [])

  const assignmentsForCurrentView: DepthAssignment[] = useMemo(
    () =>
      depthChart.filter(
        (e) =>
          e.unit === selectedUnit &&
          (selectedUnit === "special_teams"
            ? e.specialTeamType === currentSpecialTeamType
            : !e.specialTeamType && e.formation === currentFormation)
      ) as DepthAssignment[],
    [depthChart, selectedUnit, currentFormation, currentSpecialTeamType]
  )

  const handleDrop = (position: string, string: number, playerId: string) => {
    const updates: DepthChartUpdate[] = []
    const existingEntry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === string &&
        (selectedUnit === "special_teams"
          ? e.specialTeamType === currentSpecialTeamType
          : !e.specialTeamType && (currentFormation ? e.formation === currentFormation : true))
    )

    if (string === 1) {
      depthChart
        .filter(
          (e) =>
            e.playerId === playerId &&
            e.unit === selectedUnit &&
            (selectedUnit === "special_teams"
              ? e.specialTeamType === currentSpecialTeamType
              : !e.specialTeamType && (currentFormation ? e.formation === currentFormation : true))
        )
        .forEach((e) => {
          updates.push({
            unit: e.unit,
            position: e.position,
            string: e.string,
            playerId: null,
            formation: currentFormation ?? null,
            specialTeamType: currentSpecialTeamType ?? null,
          })
        })
      if (existingEntry?.playerId) {
        updates.push({
          unit: selectedUnit,
          position,
          string: 2,
          playerId: existingEntry.playerId,
          formation: currentFormation ?? null,
          specialTeamType: currentSpecialTeamType ?? null,
        })
      }
      updates.push({
        unit: selectedUnit,
        position,
        string: 1,
        playerId,
        formation: currentFormation ?? null,
        specialTeamType: currentSpecialTeamType ?? null,
      })
    } else {
      depthChart
        .filter(
          (e) =>
            e.playerId === playerId &&
            e.unit === selectedUnit &&
            (selectedUnit === "special_teams"
              ? e.specialTeamType === currentSpecialTeamType
              : !e.specialTeamType && (currentFormation ? e.formation === currentFormation : true))
        )
        .forEach((e) => {
          updates.push({
            unit: e.unit,
            position: e.position,
            string: e.string,
            playerId: null,
            formation: currentFormation ?? null,
            specialTeamType: currentSpecialTeamType ?? null,
          })
        })
      if (existingEntry?.playerId) {
        const droppedEntry = depthChart.find(
          (e) =>
            e.playerId === playerId &&
            e.unit === selectedUnit &&
            (selectedUnit === "special_teams"
              ? e.specialTeamType === currentSpecialTeamType
              : !e.specialTeamType && (currentFormation ? e.formation === currentFormation : true))
        )
        if (droppedEntry) {
          updates.push({
            unit: selectedUnit,
            position,
            string,
            playerId: existingEntry.playerId,
            formation: currentFormation ?? null,
            specialTeamType: currentSpecialTeamType ?? null,
          })
          updates.push({
            unit: selectedUnit,
            position: droppedEntry.position,
            string: droppedEntry.string,
            playerId,
            formation: currentFormation ?? null,
            specialTeamType: currentSpecialTeamType ?? null,
          })
        } else {
          updates.push({
            unit: selectedUnit,
            position,
            string,
            playerId,
            formation: currentFormation ?? null,
            specialTeamType: currentSpecialTeamType ?? null,
          })
        }
      } else {
        updates.push({
          unit: selectedUnit,
          position,
          string,
          playerId,
          formation: currentFormation ?? null,
          specialTeamType: currentSpecialTeamType ?? null,
        })
      }
    }
    if (updates.length > 0) onUpdate(updates)
  }

  const handleRemove = (position: string, string: number) => {
    const entry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === string &&
        (selectedUnit === "special_teams"
          ? e.specialTeamType === currentSpecialTeamType
          : !e.specialTeamType && (currentFormation ? e.formation === currentFormation : true))
    )
    if (entry) {
      onUpdate([
        {
          unit: selectedUnit,
          position,
          string,
          playerId: null,
          formation: currentFormation ?? null,
          specialTeamType: currentSpecialTeamType ?? null,
        },
      ])
    }
  }

  const handleReorder = (position: string, fromString: number, toString: number) => {
    const fromEntry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === fromString &&
        (selectedUnit === "special_teams"
          ? e.specialTeamType === currentSpecialTeamType
          : !e.specialTeamType && (currentFormation ? e.formation === currentFormation : true))
    )
    const toEntry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === toString &&
        (selectedUnit === "special_teams"
          ? e.specialTeamType === currentSpecialTeamType
          : !e.specialTeamType && (currentFormation ? e.formation === currentFormation : true))
    )
    const updates: DepthChartUpdate[] = []
    if (fromEntry?.playerId) {
      if (toEntry?.playerId) {
        updates.push({
          unit: selectedUnit,
          position,
          string: toString,
          playerId: fromEntry.playerId,
          formation: currentFormation ?? null,
          specialTeamType: currentSpecialTeamType ?? null,
        })
        updates.push({
          unit: selectedUnit,
          position,
          string: fromString,
          playerId: toEntry.playerId,
          formation: currentFormation ?? null,
          specialTeamType: currentSpecialTeamType ?? null,
        })
      } else {
        updates.push({
          unit: selectedUnit,
          position,
          string: fromString,
          playerId: null,
          formation: currentFormation ?? null,
          specialTeamType: currentSpecialTeamType ?? null,
        })
        updates.push({
          unit: selectedUnit,
          position,
          string: toString,
          playerId: fromEntry.playerId,
          formation: currentFormation ?? null,
          specialTeamType: currentSpecialTeamType ?? null,
        })
      }
      if (updates.length > 0) onUpdate(updates)
    }
  }

  const positionOptions = useMemo(() => {
    const set = new Set(players.map((p) => p.positionGroup).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [players])

  const unitLabel =
    selectedUnit === "offense" ? "Offense" : selectedUnit === "defense" ? "Defense" : "Special Teams"
  const formationName = preset?.name ?? ""
  const generatedDate = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  const printBody =
    presetWithLabels && assignmentsForCurrentView ? (
      <DepthChartPrintView
        teamName={teamName}
        unitLabel={unitLabel}
        formationName={formationName}
        generatedDate={generatedDate}
        slots={getFormationSlots(presetWithLabels)}
        assignments={assignmentsForCurrentView}
        playersById={playersById}
      />
    ) : null

  const handlePrint = useCallback(() => {
    if (!printRef.current) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print())
    })
  }, [])

  return (
    <React.Fragment>
    <div
      className="rounded-lg"
      style={{
        backgroundColor: "rgb(var(--platinum))",
        minHeight: "calc(100vh - 200px)",
        height: "100%",
      }}
    >
      <div
        className="grid h-full"
        style={{ gridTemplateColumns: "280px 1fr", gap: 0 }}
      >
        {/* Left: Roster list with filters */}
        <div
          className="overflow-y-auto flex flex-col"
          style={{ padding: "16px", borderRight: "1px solid #2a2a2a" }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: "#000000" }}>
            Available Players
          </h3>

          {/* Roster filters */}
          <div className="space-y-2 mb-4">
            <input
              type="search"
              placeholder="Search name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[#2a2a2a] px-3 py-2 text-sm bg-white"
            />
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full rounded-md border border-[#2a2a2a] px-3 py-2 text-sm bg-white"
            >
              <option value="">All positions</option>
              {positionOptions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
            <select
              value={sideOfBallFilter}
              onChange={(e) => setSideOfBallFilter(e.target.value as typeof sideOfBallFilter)}
              className="w-full rounded-md border border-[#2a2a2a] px-3 py-2 text-sm bg-white"
            >
              <option value="all">All sides</option>
              <option value="offense">Offense</option>
              <option value="defense">Defense</option>
              <option value="athlete">Athlete</option>
            </select>
            <label className="flex items-center gap-2 text-sm" style={{ color: "#000000" }}>
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              Active only
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: "#000000" }}>
              <input
                type="checkbox"
                checked={unassignedOnly}
                onChange={(e) => setUnassignedOnly(e.target.checked)}
              />
              Unassigned only
            </label>
          </div>

          <div
            className="space-y-2 flex flex-col items-center flex-1"
            onDragEnd={() => setDraggingPlayerId(null)}
          >
            {filteredRosterForSidebar.map((player) => (
              <div
                key={player.id}
                style={{ width: "100%", maxWidth: "230px" }}
                onDragStart={() => canEdit && setDraggingPlayerId(player.id)}
                onDragEnd={() => setDraggingPlayerId(null)}
              >
                <PlayerCard
                  player={player}
                  canEdit={false}
                  draggable={canEdit}
                  eligibilityHint={eligibilityHintsByPlayerId.get(player.id)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("playerId", player.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                />
              </div>
            ))}
            {filteredRosterForSidebar.length === 0 && (
              <div className="text-xs text-center py-4" style={{ color: "#666666" }}>
                {unassignedOnly ? "All players assigned or no matches" : "No players match filters"}
              </div>
            )}
          </div>
        </div>

        {/* Right: Depth chart area */}
        <div
          className="flex flex-col"
          style={{ padding: "24px", display: "flex", justifyContent: "flex-start", alignItems: "stretch" }}
        >
          {/* Unit tabs + Formation selector + Print */}
          <div className="mb-4 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap items-center">
              {(["offense", "defense", "special_teams"] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => setSelectedUnit(unit)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all border-2 ${
                    selectedUnit === unit ? "" : "opacity-60 hover:opacity-100"
                  }`}
                  style={{
                    color: "#000000",
                    backgroundColor: selectedUnit === unit ? "rgb(var(--braik-navy))" : "transparent",
                    borderColor: "#3B82F6",
                  }}
                >
                  {unit === "offense" ? "Offense" : unit === "defense" ? "Defense" : "Special Teams"}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-sm font-medium shrink-0" style={{ color: "#000000" }}>
                Formation
              </span>
              <div className="flex flex-wrap gap-2 overflow-x-auto overflow-y-hidden py-0.5">
                {presetsForSide.map((p) => {
                  const isSelected = selectedPresetId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setSelectedPresetByUnit((prev) => ({ ...prev, [selectedUnit]: p.id }))
                      }
                      className={`shrink-0 rounded-lg border-2 px-3 py-2 text-left transition-all min-w-0 ${
                        isSelected ? "" : "opacity-70 hover:opacity-100"
                      }`}
                      style={{
                        color: "#000000",
                        backgroundColor: isSelected ? "rgb(var(--braik-navy))" : "transparent",
                        borderColor: isSelected ? "#2563eb" : "#94a3b8",
                      }}
                    >
                      <span className="block text-xs font-semibold truncate max-w-[100px] sm:max-w-none">
                        {p.name}
                      </span>
                      {p.subtitle && (
                        <span
                          className="block text-[10px] mt-0.5 truncate max-w-[100px] sm:max-w-none"
                          style={{ color: isSelected ? "rgba(255,255,255,0.9)" : "#64748b" }}
                        >
                          {p.subtitle}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPrintPreview(true)}
                className="shrink-0"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Print
              </Button>
            </div>
            {isHeadCoach && labelsLoaded && preset && (
              <PositionLabelEditor
                teamId={teamId}
                unit={selectedUnit}
                positions={getFormationSlots(presetWithLabels ?? preset).map((s) => ({
                  position: s.slotKey,
                  label: s.displayLabel,
                }))}
                specialTeamType={selectedUnit === "special_teams" ? currentSpecialTeamType : null}
                onLabelsUpdated={handleLabelsUpdated}
              />
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {presetWithLabels && (
              <DepthChartGrid
                preset={presetWithLabels}
                assignments={assignmentsForCurrentView}
                playersById={playersById}
                unit={selectedUnit}
                formation={currentFormation}
                specialTeamType={currentSpecialTeamType}
                canEdit={canEdit}
                validSlotKeysForDraggingPlayer={validSlotKeysForDraggingPlayer}
                onDragStartPlayer={handleDragStartPlayer}
                onDrop={handleDrop}
                onRemove={handleRemove}
                onReorder={handleReorder}
              />
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Print preview modal */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white border border-slate-200">
            <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between border-b">
              <CardTitle className="text-lg text-slate-900">Print depth chart</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1.5" />
                  Print
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPrintPreview(false)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4">
              <p className="text-sm text-slate-600 mb-3">
                Printing: {unitLabel} — {formationName}. Use your browser&apos;s &quot;Save as PDF&quot; in the print dialog to export PDF.
              </p>
              {printBody && (
                <div className="bg-white text-black border border-slate-200 rounded p-4">
                  {printBody}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Printable content in portal for @media print */}
      {showPrintPreview &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <div
            className="depth-chart-print-portal"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              top: 0,
              width: "1px",
              height: "1px",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div ref={printRef} style={{ width: "8.5in" }}>
              {printBody}
            </div>
          </div>,
          document.body
        )}

      <style dangerouslySetInnerHTML={{ __html: DEPTH_CHART_PRINT_STYLES }} />
    </React.Fragment>
  )
}
