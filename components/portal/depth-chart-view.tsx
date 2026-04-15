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
  /** Full-page depth editor: sticky save/cancel aligned with Print / position labels */
  editorExitActions?: {
    onSave: () => void | Promise<void>
    onCancel: () => void
    hasUnsavedChanges: boolean
    isSaving: boolean
  }
}

type Side = "offense" | "defense" | "special_teams"

const ROSTER_SCROLL_STYLES = `
.roster-scroll-container {
  overflow-y: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none;
}
.roster-scroll-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Edge */
}
`

/** Depth chart main scroll only — hide scrollbar visually, keep scroll (desktop depth modal). */
const DEPTH_CHART_AREA_SCROLL_STYLES = `
.depth-chart-scroll-area {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.depth-chart-scroll-area::-webkit-scrollbar {
  display: none;
}
`

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
  editorExitActions,
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
  /** When false (default), offense/defense depth is stored on the canonical formation and shown on every formation. */
  const [independentDepthByFormation, setIndependentDepthByFormation] = useState(false)
  const [missingBannerDismissed, setMissingBannerDismissed] = useState(false)

  const depthInferredRef = useRef(false)
  useEffect(() => {
    depthInferredRef.current = false
  }, [teamId])
  useEffect(() => {
    if (depthInferredRef.current) return
    try {
      const key = `braik-depth-independent-${teamId}`
      const v = localStorage.getItem(key)
      if (v === "1" || v === "0") {
        setIndependentDepthByFormation(v === "1")
        depthInferredRef.current = true
        return
      }
      if (depthChart.length === 0) return
      depthInferredRef.current = true
      const canonOff = DEFAULT_PRESET_BY_SIDE.offense
      const canonDef = DEFAULT_PRESET_BY_SIDE.defense
      const offForms = new Set(
        depthChart
          .filter((e) => e.unit === "offense" && e.playerId && e.formation)
          .map((e) => e.formation as string)
      )
      const defForms = new Set(
        depthChart
          .filter((e) => e.unit === "defense" && e.playerId && e.formation)
          .map((e) => e.formation as string)
      )
      const offenseIndependent =
        offForms.size > 1 || (offForms.size === 1 && !offForms.has(canonOff))
      const defenseIndependent =
        defForms.size > 1 || (defForms.size === 1 && !defForms.has(canonDef))
      setIndependentDepthByFormation(offenseIndependent || defenseIndependent)
    } catch {
      depthInferredRef.current = true
    }
  }, [teamId, depthChart])

  useEffect(() => {
    setMissingBannerDismissed(false)
  }, [selectedUnit, selectedPresetId])

  const setIndependentDepth = (value: boolean) => {
    setIndependentDepthByFormation(value)
    try {
      localStorage.setItem(`braik-depth-independent-${teamId}`, value ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  const handleIndependentCheckboxChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        if (selectedUnit === "special_teams") {
          setIndependentDepth(true)
          return
        }
        const canon = DEFAULT_PRESET_BY_SIDE[selectedUnit]
        const presetIds = getPresetsForSide(selectedUnit).map((p) => p.id)
        const updates: DepthChartUpdate[] = []
        const baseRows = depthChart.filter(
          (e) => e.unit === selectedUnit && !e.specialTeamType && e.formation === canon
        )
        for (const formId of presetIds) {
          if (formId === canon) continue
          const hasAny = depthChart.some(
            (e) =>
              e.unit === selectedUnit &&
              !e.specialTeamType &&
              e.formation === formId &&
              e.playerId
          )
          if (hasAny) continue
          for (const e of baseRows) {
            if (e.playerId) {
              updates.push({
                unit: e.unit,
                position: e.position,
                string: e.string,
                playerId: e.playerId,
                formation: formId,
                specialTeamType: null,
              })
            }
          }
        }
        if (updates.length > 0) onUpdate(updates)
        setIndependentDepth(true)
        return
      }
      if (selectedUnit !== "special_teams") {
        const canon = DEFAULT_PRESET_BY_SIDE[selectedUnit]
        const hasOther = depthChart.some(
          (e) =>
            e.unit === selectedUnit &&
            !e.specialTeamType &&
            e.formation &&
            e.formation !== canon &&
            e.playerId
        )
        if (hasOther) {
          const ok = window.confirm(
            "Turning this off shows only the default formation depth. Saved assignments for other formations stay in the database but are hidden until you turn this back on. Continue?"
          )
          if (!ok) return
        }
      }
      setIndependentDepth(false)
    },
    [depthChart, selectedUnit, onUpdate, setIndependentDepth]
  )

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

  /** DB formation id for offense/defense depth rows; canonical preset when synced. Null for special teams. */
  const persistDepthFormation = useMemo(() => {
    if (selectedUnit === "special_teams") return null
    if (!independentDepthByFormation) return DEFAULT_PRESET_BY_SIDE[selectedUnit]
    return currentFormation
  }, [selectedUnit, independentDepthByFormation, currentFormation])

  const depthFormationField =
    selectedUnit === "special_teams" ? null : persistDepthFormation ?? null
  const depthSpecialField =
    selectedUnit === "special_teams" ? currentSpecialTeamType ?? null : null

  const matchesPersistedDepthRow = (e: DepthChartEntry) =>
    selectedUnit === "special_teams"
      ? e.specialTeamType === currentSpecialTeamType
      : !e.specialTeamType && e.formation === persistDepthFormation

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
              : !e.specialTeamType && e.formation === persistDepthFormation)
        )
        .map((e) => e.playerId!)
        .filter(Boolean)
    )
  }, [depthChart, selectedUnit, persistDepthFormation, currentSpecialTeamType])

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
            : !e.specialTeamType && e.formation === persistDepthFormation)
      ) as DepthAssignment[],
    [depthChart, selectedUnit, persistDepthFormation, currentSpecialTeamType]
  )

  const missingBannerSlots = useMemo(() => {
    if (!presetWithLabels) return []
    const slots = getFormationSlots(presetWithLabels)
    const missing: string[] = []
    for (const s of slots) {
      const hasStarter = assignmentsForCurrentView.some(
        (a) => a.position === s.slotKey && a.string === 1 && a.playerId
      )
      if (!hasStarter) missing.push(`${s.displayLabel}${s.alias ? ` (${s.alias})` : ""}`)
    }
    return missing
  }, [presetWithLabels, assignmentsForCurrentView])

  const handleDrop = (position: string, string: number, playerId: string) => {
    const updates: DepthChartUpdate[] = []
    const existingEntry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === string &&
        matchesPersistedDepthRow(e)
    )

    if (string === 1) {
      depthChart
        .filter(
          (e) =>
            e.playerId === playerId &&
            e.unit === selectedUnit &&
            matchesPersistedDepthRow(e)
        )
        .forEach((e) => {
          updates.push({
            unit: e.unit,
            position: e.position,
            string: e.string,
            playerId: null,
            formation: depthFormationField,
            specialTeamType: depthSpecialField,
          })
        })
      if (existingEntry?.playerId) {
        updates.push({
          unit: selectedUnit,
          position,
          string: 2,
          playerId: existingEntry.playerId,
          formation: depthFormationField,
          specialTeamType: depthSpecialField,
        })
      }
      updates.push({
        unit: selectedUnit,
        position,
        string: 1,
        playerId,
        formation: depthFormationField,
        specialTeamType: depthSpecialField,
      })
    } else {
      depthChart
        .filter(
          (e) =>
            e.playerId === playerId &&
            e.unit === selectedUnit &&
            matchesPersistedDepthRow(e)
        )
        .forEach((e) => {
          updates.push({
            unit: e.unit,
            position: e.position,
            string: e.string,
            playerId: null,
            formation: depthFormationField,
            specialTeamType: depthSpecialField,
          })
        })
      if (existingEntry?.playerId) {
        const droppedEntry = depthChart.find(
          (e) =>
            e.playerId === playerId &&
            e.unit === selectedUnit &&
            matchesPersistedDepthRow(e)
        )
        if (droppedEntry) {
          updates.push({
            unit: selectedUnit,
            position,
            string,
            playerId: existingEntry.playerId,
            formation: depthFormationField,
            specialTeamType: depthSpecialField,
          })
          updates.push({
            unit: selectedUnit,
            position: droppedEntry.position,
            string: droppedEntry.string,
            playerId,
            formation: depthFormationField,
            specialTeamType: depthSpecialField,
          })
        } else {
          updates.push({
            unit: selectedUnit,
            position,
            string,
            playerId,
            formation: depthFormationField,
            specialTeamType: depthSpecialField,
          })
        }
      } else {
        updates.push({
          unit: selectedUnit,
          position,
          string,
          playerId,
          formation: depthFormationField,
          specialTeamType: depthSpecialField,
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
        matchesPersistedDepthRow(e)
    )
    if (entry) {
      onUpdate([
        {
          unit: selectedUnit,
          position,
          string,
          playerId: null,
          formation: depthFormationField,
          specialTeamType: depthSpecialField,
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
        matchesPersistedDepthRow(e)
    )
    const toEntry = depthChart.find(
      (e) =>
        e.unit === selectedUnit &&
        e.position === position &&
        e.string === toString &&
        matchesPersistedDepthRow(e)
    )
    const updates: DepthChartUpdate[] = []
    if (fromEntry?.playerId) {
      if (toEntry?.playerId) {
        updates.push({
          unit: selectedUnit,
          position,
          string: toString,
          playerId: fromEntry.playerId,
          formation: depthFormationField,
          specialTeamType: depthSpecialField,
        })
        updates.push({
          unit: selectedUnit,
          position,
          string: fromString,
          playerId: toEntry.playerId,
          formation: depthFormationField,
          specialTeamType: depthSpecialField,
        })
      } else {
        updates.push({
          unit: selectedUnit,
          position,
          string: fromString,
          playerId: null,
          formation: depthFormationField,
          specialTeamType: depthSpecialField,
        })
        updates.push({
          unit: selectedUnit,
          position,
          string: toString,
          playerId: fromEntry.playerId,
          formation: depthFormationField,
          specialTeamType: depthSpecialField,
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
      className="rounded-lg flex flex-col min-h-0 flex-1"
      style={{
        backgroundColor: "rgb(var(--platinum))",
        minHeight: "calc(100vh - 200px)",
      }}
    >
      <div
        className="grid flex-1 min-h-0 overflow-hidden"
        style={{ gridTemplateColumns: "280px 1fr", gap: 0 }}
      >
        {/* Left: Roster list with filters */}
        <div
          className="flex flex-col min-h-0 overflow-hidden p-4 border-r border-border"
        >
          <h3 className="text-sm font-semibold mb-3 shrink-0 text-foreground">
            Available Players
          </h3>

          {/* Roster filters */}
          <div className="space-y-2 mb-4 shrink-0">
            <input
              type="search"
              placeholder="Search name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-theme w-full rounded-md border border-border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
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
              className="w-full rounded-md border border-border px-3 py-2 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="all">All sides</option>
              <option value="offense">Offense</option>
              <option value="defense">Defense</option>
              <option value="athlete">Athlete</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              Active only
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={unassignedOnly}
                onChange={(e) => setUnassignedOnly(e.target.checked)}
              />
              Unassigned only
            </label>
          </div>

          <div
            className="roster-scroll-container flex-1 min-h-0 flex flex-col items-center space-y-2"
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
              <div className="text-xs text-center py-4 text-muted-foreground">
                {unassignedOnly ? "All players assigned or no matches" : "No players match filters"}
              </div>
            )}
          </div>
        </div>

        {/* Right: Depth chart area */}
        <div
          className="flex flex-col p-6 flex justify-start items-stretch lg:min-w-0"
        >
          {editorExitActions ? (
            <div className="sticky top-0 z-20 -mx-2 mb-4 flex w-full min-w-0 flex-wrap items-center gap-2 border-b border-border/80 bg-[rgb(var(--platinum))] px-2 pb-3 pt-1 print:hidden">
              <div className="min-w-0 flex-1 basis-full sm:basis-auto sm:min-h-[2.25rem] sm:max-w-[50%]">
                {editorExitActions.hasUnsavedChanges ? (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400/90 sm:text-sm">
                    Unsaved changes
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none sm:justify-end">
                {canEdit ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9 shrink-0"
                      disabled={editorExitActions.isSaving}
                      onClick={editorExitActions.onCancel}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="min-h-9 min-w-[7.5rem] shrink-0"
                      disabled={!editorExitActions.hasUnsavedChanges || editorExitActions.isSaving}
                      onClick={() => void editorExitActions.onSave()}
                      title={!editorExitActions.hasUnsavedChanges ? "No changes to save" : undefined}
                    >
                      {editorExitActions.isSaving ? "Saving…" : "Save Changes"}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9 shrink-0"
                    disabled={editorExitActions.isSaving}
                    onClick={editorExitActions.onCancel}
                  >
                    Close
                  </Button>
                )}
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
            </div>
          ) : null}

          {/* Unit tabs + Formation selector + Print */}
          <div className="mb-4 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap items-center">
              {(["offense", "defense", "special_teams"] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => setSelectedUnit(unit)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all border-2 ${
                    selectedUnit === unit
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-foreground border-border opacity-60 hover:opacity-100 hover:border-primary/50"
                  }`}
                >
                  {unit === "offense" ? "Offense" : unit === "defense" ? "Defense" : "Special Teams"}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-sm font-medium shrink-0 text-foreground">
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
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-foreground border-border opacity-70 hover:opacity-100 hover:border-primary/50"
                      }`}
                    >
                      <span className="block text-xs font-semibold truncate max-w-[100px] sm:max-w-none">
                        {p.name}
                      </span>
                      {p.subtitle && (
                        <span
                          className={`block text-[10px] mt-0.5 truncate max-w-[100px] sm:max-w-none ${
                            isSelected ? "text-primary-foreground/90" : "text-muted-foreground"
                          }`}
                        >
                          {p.subtitle}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {(selectedUnit === "offense" || selectedUnit === "defense") && (
                <label className="flex items-start gap-2 text-sm text-foreground max-w-[220px] print:hidden cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={independentDepthByFormation}
                    onChange={(e) => handleIndependentCheckboxChange(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Different players per formation</span>
                    <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                      Off by default: same depth applies to every formation on this side.
                    </span>
                  </span>
                </label>
              )}
            </div>
            {!editorExitActions ? (
              <>
                <div className="flex flex-wrap items-center justify-end gap-2 print:hidden sm:justify-start">
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
              </>
            ) : null}
          </div>

          {missingBannerSlots.length > 0 && !missingBannerDismissed && (
            <div className="mb-3 flex flex-wrap items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">Missing starters: </span>
                {formationName} ({unitLabel}) — {missingBannerSlots.join(", ")}
              </span>
              <button
                type="button"
                className="shrink-0 rounded-md border border-amber-300 bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
                onClick={() => setMissingBannerDismissed(true)}
              >
                Ignore
              </button>
            </div>
          )}

          <div className="depth-chart-scroll-area flex-1 overflow-auto py-2 px-2 min-h-0">
            {presetWithLabels && (
              <DepthChartGrid
                preset={presetWithLabels}
                assignments={assignmentsForCurrentView}
                playersById={playersById}
                unit={selectedUnit}
                formation={depthFormationField}
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
          <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border">
            <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between border-b">
              <CardTitle className="text-lg text-foreground">Print depth chart</CardTitle>
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
              <p className="text-sm text-muted-foreground mb-3">
                Printing: {unitLabel} — {formationName}. Use your browser&apos;s &quot;Save as PDF&quot; in the print dialog to export PDF.
              </p>
              {printBody && (
                <div className="bg-card text-foreground border border-border rounded p-4">
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

      <style dangerouslySetInnerHTML={{ __html: ROSTER_SCROLL_STYLES }} />
      <style dangerouslySetInnerHTML={{ __html: DEPTH_CHART_AREA_SCROLL_STYLES }} />
      <style dangerouslySetInnerHTML={{ __html: DEPTH_CHART_PRINT_STYLES }} />
    </React.Fragment>
  )
}
