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

/** Scope key for indexing depth chart rows (unit + formation + special team type). */
function getDepthScopeKey(
  unit: string,
  formation: string | null | undefined,
  specialTeamType: string | null | undefined
): string {
  const f = formation ?? ""
  const st = specialTeamType ?? ""
  return `${unit}\x1e${f}\x1e${st}`
}

/** Unique key for one assignment cell within a scope. */
function getAssignmentKey(
  unit: string,
  position: string,
  depthString: number,
  formation: string | null | undefined,
  specialTeamType: string | null | undefined
): string {
  return `${getDepthScopeKey(unit, formation, specialTeamType)}\x1e${position}\x1e${depthString}`
}

function presetHasDisplayableLayout(p: FormationPreset | null): boolean {
  if (!p) return false
  if (p.rows?.length) return p.rows.some((r) => (r.slots?.length ?? 0) > 0)
  return (p.slots?.length ?? 0) > 0
}

function getLabelKey(position: string, unit: string, specialTeamType?: string | null) {
  return specialTeamType ? `${unit}-${position}-${specialTeamType}` : `${unit}-${position}`
}

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

  const resolvedSelectedPresetId = useMemo(() => {
    const fallback = DEFAULT_PRESET_BY_SIDE[selectedUnit]
    const stored = selectedPresetByUnit[selectedUnit]
    const candidate = stored ?? fallback
    return getPreset(selectedUnit, candidate) ? candidate : fallback
  }, [selectedPresetByUnit, selectedUnit])

  useEffect(() => {
    const fallback = DEFAULT_PRESET_BY_SIDE[selectedUnit]
    const stored = selectedPresetByUnit[selectedUnit]
    if (stored === undefined) return
    if (getPreset(selectedUnit, stored)) return
    if (stored === fallback) return
    setSelectedPresetByUnit((prev) => ({ ...prev, [selectedUnit]: fallback }))
  }, [selectedUnit, selectedPresetByUnit])

  useEffect(() => {
    setMissingBannerDismissed(false)
  }, [selectedUnit, resolvedSelectedPresetId])

  const setIndependentDepth = useCallback((value: boolean) => {
    setIndependentDepthByFormation(value)
    try {
      localStorage.setItem(`braik-depth-independent-${teamId}`, value ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [teamId])

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
  }, [selectedUnit, resolvedSelectedPresetId])

  const layoutPresetIdForDisplay = useMemo(() => {
    if (selectedUnit === "special_teams" || independentDepthByFormation) {
      return resolvedSelectedPresetId
    }
    const canonId = DEFAULT_PRESET_BY_SIDE[selectedUnit]
    const canon = getPreset(selectedUnit, canonId)
    if (presetHasDisplayableLayout(canon)) return canonId
    const sel = getPreset(selectedUnit, resolvedSelectedPresetId)
    if (presetHasDisplayableLayout(sel)) return resolvedSelectedPresetId
    return canonId
  }, [selectedUnit, independentDepthByFormation, resolvedSelectedPresetId])

  const displayPreset =
    getPreset(selectedUnit, layoutPresetIdForDisplay) ??
    getPreset(selectedUnit, DEFAULT_PRESET_BY_SIDE[selectedUnit]) ??
    null
  const presetsForSide = useMemo(() => getPresetsForSide(selectedUnit), [selectedUnit])

  /**
   * Persistence scope only: formation id stored on depth rows (canonical when synced; coach-selected when independent).
   * Do not derive from displayPreset, layoutPresetIdForDisplay, or layout-only fallbacks.
   */
  const persistenceFormationId = useMemo((): string | null => {
    if (selectedUnit === "special_teams") return null
    const fallback = DEFAULT_PRESET_BY_SIDE[selectedUnit]
    if (!independentDepthByFormation) return fallback
    const stored = selectedPresetByUnit[selectedUnit]
    const candidate = stored ?? fallback
    return getPreset(selectedUnit, candidate) ? candidate : fallback
  }, [selectedUnit, independentDepthByFormation, selectedPresetByUnit])

  /**
   * Persistence scope only: special-teams subgroup id on depth rows.
   * Do not derive from displayPreset or layoutPresetIdForDisplay.
   */
  const persistenceSpecialTeamType = useMemo((): string | null => {
    if (selectedUnit !== "special_teams") return null
    const fallback = DEFAULT_PRESET_BY_SIDE.special_teams
    const stored = selectedPresetByUnit.special_teams
    const candidate = stored ?? fallback
    return getPreset("special_teams", candidate) ? candidate : fallback
  }, [selectedUnit, selectedPresetByUnit])

  const depthFormationField: string | null =
    selectedUnit === "special_teams" ? null : persistenceFormationId
  const depthSpecialField: string | null =
    selectedUnit === "special_teams" ? persistenceSpecialTeamType : null

  const depthEntriesByScopeKey = useMemo(() => {
    const m = new Map<string, DepthChartEntry[]>()
    for (const e of depthChart) {
      const k = getDepthScopeKey(e.unit, e.formation, e.specialTeamType)
      const arr = m.get(k) ?? []
      arr.push(e)
      m.set(k, arr)
    }
    return m
  }, [depthChart])

  const currentDepthScopeKey = useMemo(
    () => getDepthScopeKey(selectedUnit, depthFormationField, depthSpecialField),
    [selectedUnit, depthFormationField, depthSpecialField]
  )

  const matchesCurrentDepthScope = useCallback(
    (e: DepthChartEntry) =>
      getDepthScopeKey(e.unit, e.formation, e.specialTeamType) === currentDepthScopeKey,
    [currentDepthScopeKey]
  )

  const currentScopeEntries = useMemo(
    () => depthEntriesByScopeKey.get(currentDepthScopeKey) ?? [],
    [depthEntriesByScopeKey, currentDepthScopeKey]
  )

  const depthEntryByAssignmentKey = useMemo(() => {
    const m = new Map<string, DepthChartEntry>()
    for (const e of depthChart) {
      m.set(getAssignmentKey(e.unit, e.position, e.string, e.formation, e.specialTeamType), e)
    }
    return m
  }, [depthChart])

  const findCurrentEntry = useCallback(
    (position: string, depthString: number) =>
      depthEntryByAssignmentKey.get(
        getAssignmentKey(selectedUnit, position, depthString, depthFormationField, depthSpecialField)
      ),
    [depthEntryByAssignmentKey, selectedUnit, depthFormationField, depthSpecialField]
  )

  const getCurrentEntriesByPlayer = useCallback(
    (playerId: string) => currentScopeEntries.filter((e) => e.playerId === playerId),
    [currentScopeEntries]
  )

  const getLabel = useCallback(
    (position: string, defaultLabel: string, unit: string, specialTeamType?: string | null) => {
      return customLabels[getLabelKey(position, unit, specialTeamType)] ?? defaultLabel
    },
    [customLabels]
  )

  const presetWithLabels = useMemo((): FormationPreset | null => {
    if (!displayPreset) return null
    const stType = depthSpecialField
    const withLabel = (s: FormationSlot): FormationSlot => ({
      ...s,
      displayLabel: getLabel(s.slotKey, s.alias ?? s.displayLabel, selectedUnit, stType),
    })
    if (displayPreset.rows?.length) {
      return {
        ...displayPreset,
        rows: displayPreset.rows.map((r) => ({
          ...r,
          slots: r.slots.map(withLabel),
        })),
        slots: displayPreset.rows.flatMap((r) => r.slots.map(withLabel)),
      }
    }
    return {
      ...displayPreset,
      slots: displayPreset.slots.map(withLabel),
    }
  }, [displayPreset, selectedUnit, depthSpecialField, getLabel])

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
    const ids = new Set<string>()
    for (const e of currentScopeEntries) {
      if (e.playerId) ids.add(e.playerId)
    }
    return ids
  }, [currentScopeEntries])

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
    if (!draggingPlayerId || !displayPreset) return null
    const slots = getFormationSlots(displayPreset)
    const player = playersById.get(draggingPlayerId)
    if (!player) return new Set(slots.map((s) => s.slotKey))
    return getValidSlotKeys(player.positionGroup, slots)
  }, [draggingPlayerId, playersById, displayPreset])

  const eligibilityHintsByPlayerId = useMemo(() => {
    if (!displayPreset || !presetWithLabels) return new Map<string, string>()
    const slots = getFormationSlots(displayPreset)
    const slotsWithLabels = getFormationSlots(presetWithLabels)
    const keyToLabel = new Map(slotsWithLabels.map((s) => [s.slotKey, s.displayLabel]))
    const map = new Map<string, string>()
    for (const p of players) {
      const keys = getBestFitSlotKeys(p.positionGroup, slots)
      const labels = keys.slice(0, 3).map((k) => keyToLabel.get(k) ?? k)
      if (labels.length) map.set(p.id, `Best fit: ${labels.join(", ")}`)
    }
    return map
  }, [displayPreset, presetWithLabels, players])

  const handleDragStartPlayer = useCallback((playerId: string) => {
    setDraggingPlayerId(playerId)
  }, [])

  const assignmentsForCurrentView: DepthAssignment[] = useMemo(
    () => currentScopeEntries as DepthAssignment[],
    [currentScopeEntries]
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
    const existingEntry = findCurrentEntry(position, string)

    if (string === 1) {
      getCurrentEntriesByPlayer(playerId).forEach((e) => {
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
      getCurrentEntriesByPlayer(playerId).forEach((e) => {
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
        const droppedEntry = getCurrentEntriesByPlayer(playerId)[0]
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
    const entry = findCurrentEntry(position, string)
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
    const fromEntry = findCurrentEntry(position, fromString)
    const toEntry = findCurrentEntry(position, toString)
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
  const formationName = displayPreset?.name ?? ""
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
        <div className="flex flex-col min-h-0 overflow-hidden p-3 md:p-4 border-r border-border/60">
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-xl border border-border/80 bg-card shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06] p-4">
          <h3 className="text-sm font-semibold mb-3 shrink-0 text-foreground tracking-tight">
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
        </div>

        {/* Right: Depth chart area */}
        <div className="flex flex-col p-4 md:p-6 flex justify-start items-stretch lg:min-w-0 min-h-0">
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
                {isHeadCoach && labelsLoaded && displayPreset && (
                  <PositionLabelEditor
                    teamId={teamId}
                    unit={selectedUnit}
                    positions={getFormationSlots(presetWithLabels ?? displayPreset).map((s) => ({
                      position: s.slotKey,
                      label: s.displayLabel,
                    }))}
                    specialTeamType={depthSpecialField}
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
                  className={`px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                    selectedUnit === unit
                      ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                      : "bg-card/60 text-foreground border-border/60 hover:border-primary/35 hover:bg-muted/70"
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
                  const isSelected = resolvedSelectedPresetId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setSelectedPresetByUnit((prev) => ({ ...prev, [selectedUnit]: p.id }))
                      }
                      className={`shrink-0 rounded-full border px-3.5 py-2 text-left transition-all duration-200 min-w-0 shadow-sm ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-background scale-[1.02]"
                          : "bg-card/80 text-foreground border-border/80 hover:border-primary/40 hover:bg-muted/50 hover:shadow"
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
                {isHeadCoach && labelsLoaded && displayPreset && (
                  <PositionLabelEditor
                    teamId={teamId}
                    unit={selectedUnit}
                    positions={getFormationSlots(presetWithLabels ?? displayPreset).map((s) => ({
                      position: s.slotKey,
                      label: s.displayLabel,
                    }))}
                    specialTeamType={depthSpecialField}
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

          <div className="depth-chart-scroll-area flex-1 overflow-auto py-2 px-1 min-h-0">
            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-muted/20 via-background/40 to-muted/30 p-3 md:p-4 shadow-inner min-h-[200px] ring-1 ring-inset ring-black/[0.03] dark:ring-white/[0.06]">
            {presetWithLabels && (
              <DepthChartGrid
                preset={presetWithLabels}
                assignments={assignmentsForCurrentView}
                playersById={playersById}
                unit={selectedUnit}
                formation={depthFormationField}
                specialTeamType={depthSpecialField}
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
