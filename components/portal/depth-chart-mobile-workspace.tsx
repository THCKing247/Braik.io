"use client"

import React, { useMemo, useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Users, LayoutGrid, Lightbulb, UserPlus, Filter, ChevronDown, MessageCircle } from "lucide-react"
import { MobileBottomSheet } from "./depth-chart-mobile-sheet"
import { DepthSlotCard } from "./depth-slot-card"
import { FormationFieldView, getSlotPositions } from "./depth-chart-formation-field"
import { CallUpSuggestionsPanel } from "./callup-suggestions-panel"
import {
  getPresetsForSide,
  getPreset,
  getFormationSlots,
  DEFAULT_PRESET_BY_SIDE,
  type DepthAssignment,
  type FormationPreset,
  type FormationSlot,
} from "@/lib/depth-chart/formation-presets"
import { getValidSlotKeys, getBestFitSlotKeys, getAcceptedGroupsDisplay } from "@/lib/depth-chart/eligibility"
import { getPlayerPhotoUrl, type RosterPlayerForSlot } from "@/lib/depth-chart/player-resolve"

type Side = "offense" | "defense" | "special_teams"
type MobileMode = "roster" | "formation" | "suggestions"

interface MobilePlayer {
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

export interface DepthChartMobileWorkspaceProps {
  teamId: string
  players: MobilePlayer[]
  depthChart: DepthChartEntry[]
  onUpdate: (updates: DepthChartUpdate[]) => void
  canEdit: boolean
  isHeadCoach?: boolean
  programId?: string | null
  /** When false, hide Suggested Call-Ups (e.g. program has no JV/Freshman teams). */
  showCallUpSuggestions?: boolean
  onClose: () => void
  onSave?: () => void | Promise<void>
  hasUnsavedChanges?: boolean
}

function getInitials(first: string, last: string) {
  return `${(first ?? "")[0] ?? ""}${(last ?? "")[0] ?? ""}`.toUpperCase() || "?"
}

export function DepthChartMobileWorkspace({
  teamId,
  players,
  depthChart,
  onUpdate,
  canEdit,
  isHeadCoach = false,
  programId,
  showCallUpSuggestions = true,
  onClose,
  onSave,
  hasUnsavedChanges = false,
}: DepthChartMobileWorkspaceProps) {
  const [mode, setMode] = useState<MobileMode>("roster")
  const [selectedUnit, setSelectedUnit] = useState<Side>("offense")
  const [selectedPresetByUnit, setSelectedPresetByUnit] = useState<Record<Side, string>>(() => ({
    offense: DEFAULT_PRESET_BY_SIDE.offense,
    defense: DEFAULT_PRESET_BY_SIDE.defense,
    special_teams: DEFAULT_PRESET_BY_SIDE.special_teams,
  }))
  const [searchQuery, setSearchQuery] = useState("")
  const [positionFilter, setPositionFilter] = useState("")
  const [sideFilter, setSideFilter] = useState<"all" | "offense" | "defense" | "athlete">("all")
  const [activeOnly, setActiveOnly] = useState(false)
  const [unassignedOnly, setUnassignedOnly] = useState(true)
  const [rosterSort, setRosterSort] = useState<"name_az" | "jersey" | "position">("name_az")

  const [assignSheetSlot, setAssignSheetSlot] = useState<{ position: string; string: number; label?: string } | null>(null)
  /** When set, Assign sheet will use this player when user picks a slot (e.g. from Player Quick View). */
  const [assignPreSelectedPlayerId, setAssignPreSelectedPlayerId] = useState<string | null>(null)
  const [playerQuickView, setPlayerQuickView] = useState<MobilePlayer | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [slotDetails, setSlotDetails] = useState<{
    position: string
    string: number
    label?: string
    player: RosterPlayerForSlot
  } | null>(null)
  const [formationPickerOpen, setFormationPickerOpen] = useState(false)
  /** When true, Slot Actions sheet shows slot picker for Swap. */
  const [slotActionsSwapMode, setSlotActionsSwapMode] = useState(false)
  /** Search inside Assign Player sheet when selecting a player. */
  const [assignSheetSearch, setAssignSheetSearch] = useState("")
  /** When false, Formation mode shows structured list instead of field (fallback). */
  const [useFormationFieldView, setUseFormationFieldView] = useState(true)
  const [missingBannerDismissed, setMissingBannerDismissed] = useState(false)

  const selectedPresetId = selectedPresetByUnit[selectedUnit] ?? DEFAULT_PRESET_BY_SIDE[selectedUnit]
  const preset = getPreset(selectedUnit, selectedPresetId) ?? getPreset(selectedUnit, DEFAULT_PRESET_BY_SIDE[selectedUnit])
  const presetsForSide = useMemo(() => getPresetsForSide(selectedUnit), [selectedUnit])

  const currentFormation = selectedUnit === "special_teams" ? null : selectedPresetId
  const currentSpecialTeamType = selectedUnit === "special_teams" ? selectedPresetId : null
  const persistDepthFormation = selectedUnit === "special_teams" ? null : selectedPresetId
  const depthFormationField = selectedUnit === "special_teams" ? null : persistDepthFormation
  const depthSpecialField = selectedUnit === "special_teams" ? currentSpecialTeamType : null

  const matchesPersistedDepthRow = useCallback(
    (e: DepthChartEntry) =>
      selectedUnit === "special_teams"
        ? e.specialTeamType === currentSpecialTeamType
        : !e.specialTeamType && e.formation === persistDepthFormation,
    [selectedUnit, currentSpecialTeamType, persistDepthFormation]
  )

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

  const missingFormationSlots = useMemo(() => {
    if (!preset) return []
    const slots = getFormationSlots(preset)
    const missing: string[] = []
    for (const s of slots) {
      const hasStarter = assignmentsForCurrentView.some(
        (a) => a.position === s.slotKey && a.string === 1 && a.playerId
      )
      if (!hasStarter) missing.push(`${s.displayLabel}${s.alias ? ` (${s.alias})` : ""}`)
    }
    return missing
  }, [preset, assignmentsForCurrentView])

  useEffect(() => {
    setMissingBannerDismissed(false)
  }, [selectedUnit, selectedPresetId])

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
          } as RosterPlayerForSlot,
        ])
      ),
    [players]
  )

  const assignedPlayerIdsOnCurrentSide = useMemo(
    () =>
      new Set(
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
      ),
    [depthChart, selectedUnit, persistDepthFormation, currentSpecialTeamType]
  )

  const isOffenseEligible = (p: MobilePlayer) =>
    p.positionGroup && ["QB", "RB", "WR", "TE", "OL"].includes(p.positionGroup)
  const isDefenseEligible = (p: MobilePlayer) =>
    p.positionGroup && ["DL", "LB", "DB"].includes(p.positionGroup)
  const isAthlete = (p: MobilePlayer) => !p.positionGroup

  const filteredRoster = useMemo(() => {
    let list = players
    if (unassignedOnly) list = list.filter((p) => !assignedPlayerIdsOnCurrentSide.has(p.id))
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (p) =>
          (p.firstName?.toLowerCase() ?? "").includes(q) ||
          (p.lastName?.toLowerCase() ?? "").includes(q) ||
          `${(p.firstName ?? "").toLowerCase()} ${(p.lastName ?? "").toLowerCase()}`.includes(q)
      )
    }
    if (positionFilter) {
      const pos = positionFilter.toUpperCase()
      list = list.filter((p) => (p.positionGroup?.toUpperCase() ?? "") === pos)
    }
    if (sideFilter !== "all") {
      if (sideFilter === "offense") list = list.filter(isOffenseEligible)
      else if (sideFilter === "defense") list = list.filter(isDefenseEligible)
      else list = list.filter(isAthlete)
    }
    if (activeOnly) list = list.filter((p) => (p.healthStatus ?? p.status) === "active")
    return list
  }, [
    players,
    searchQuery,
    positionFilter,
    sideFilter,
    activeOnly,
    unassignedOnly,
    assignedPlayerIdsOnCurrentSide,
  ])

  const positionOptions = useMemo(() => {
    const set = new Set(players.map((p) => p.positionGroup).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [players])

  const sortedRoster = useMemo(() => {
    const list = [...filteredRoster]
    if (rosterSort === "jersey") {
      list.sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999))
    } else if (rosterSort === "position") {
      list.sort((a, b) =>
        (a.positionGroup ?? "").localeCompare(b.positionGroup ?? "", undefined, { sensitivity: "base" })
      )
    } else {
      list.sort((a, b) => {
        const na = `${(a.lastName ?? "")} ${(a.firstName ?? "")}`.toLowerCase()
        const nb = `${(b.lastName ?? "")} ${(b.firstName ?? "")}`.toLowerCase()
        return na.localeCompare(nb)
      })
    }
    return list
  }, [filteredRoster, rosterSort])

  const handleDrop = useCallback(
    (position: string, string: number, playerId: string) => {
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
            (e) => e.playerId === playerId && e.unit === selectedUnit && matchesPersistedDepthRow(e)
          )
          .forEach((e) => {
            updates.push({
              unit: e.unit,
              position: e.position,
              string: e.string,
              playerId: null,
              formation: depthFormationField ?? undefined,
              specialTeamType: depthSpecialField ?? undefined,
            })
          })
        if (existingEntry?.playerId) {
          updates.push({
            unit: selectedUnit,
            position,
            string: 2,
            playerId: existingEntry.playerId,
            formation: depthFormationField ?? undefined,
            specialTeamType: depthSpecialField ?? undefined,
          })
        }
        updates.push({
          unit: selectedUnit,
          position,
          string: 1,
          playerId,
          formation: depthFormationField ?? undefined,
          specialTeamType: depthSpecialField ?? undefined,
        })
      } else {
        depthChart
          .filter(
            (e) => e.playerId === playerId && e.unit === selectedUnit && matchesPersistedDepthRow(e)
          )
          .forEach((e) => {
            updates.push({
              unit: e.unit,
              position: e.position,
              string: e.string,
              playerId: null,
              formation: depthFormationField ?? undefined,
              specialTeamType: depthSpecialField ?? undefined,
            })
          })
        if (existingEntry?.playerId) {
          const droppedEntry = depthChart.find(
            (e) => e.playerId === playerId && e.unit === selectedUnit && matchesPersistedDepthRow(e)
          )
          if (droppedEntry) {
            updates.push({
              unit: selectedUnit,
              position,
              string,
              playerId: existingEntry.playerId,
              formation: depthFormationField ?? undefined,
              specialTeamType: depthSpecialField ?? undefined,
            })
            updates.push({
              unit: selectedUnit,
              position: droppedEntry.position,
              string: droppedEntry.string,
              playerId,
              formation: depthFormationField ?? undefined,
              specialTeamType: depthSpecialField ?? undefined,
            })
          } else {
            updates.push({
              unit: selectedUnit,
              position,
              string,
              playerId,
              formation: depthFormationField ?? undefined,
              specialTeamType: depthSpecialField ?? undefined,
            })
          }
        } else {
          updates.push({
            unit: selectedUnit,
            position,
            string,
            playerId,
            formation: depthFormationField ?? undefined,
            specialTeamType: depthSpecialField ?? undefined,
          })
        }
      }
      if (updates.length > 0) onUpdate(updates)
      setAssignSheetSlot(null)
      setAssignPreSelectedPlayerId(null)
    },
    [
      depthChart,
      selectedUnit,
      matchesPersistedDepthRow,
      depthFormationField,
      depthSpecialField,
      onUpdate,
    ]
  )

  const handleRemove = useCallback(
    (position: string, string: number) => {
      onUpdate([
        {
          unit: selectedUnit,
          position,
          string,
          playerId: null,
          formation: depthFormationField ?? undefined,
          specialTeamType: depthSpecialField ?? undefined,
        },
      ])
      setSlotDetails(null)
    },
    [selectedUnit, depthFormationField, depthSpecialField, onUpdate]
  )

  const handleSwap = useCallback(
    (posA: string, strA: number, posB: string, strB: number) => {
      const entryA = depthChart.find(
        (e) =>
          e.unit === selectedUnit &&
          e.position === posA &&
          e.string === strA &&
          matchesPersistedDepthRow(e)
      )
      const entryB = depthChart.find(
        (e) =>
          e.unit === selectedUnit &&
          e.position === posB &&
          e.string === strB &&
          matchesPersistedDepthRow(e)
      )
      if (entryA?.playerId && entryB?.playerId) {
        onUpdate([
          {
            unit: selectedUnit,
            position: posA,
            string: strA,
            playerId: entryB.playerId,
            formation: depthFormationField ?? undefined,
            specialTeamType: depthSpecialField ?? undefined,
          },
          {
            unit: selectedUnit,
            position: posB,
            string: strB,
            playerId: entryA.playerId,
            formation: depthFormationField ?? undefined,
            specialTeamType: depthSpecialField ?? undefined,
          },
        ])
      }
      setSlotDetails(null)
      setSlotActionsSwapMode(false)
    },
    [
      depthChart,
      selectedUnit,
      matchesPersistedDepthRow,
      depthFormationField,
      depthSpecialField,
      onUpdate,
    ]
  )

  const handleReorder = useCallback(
    (position: string, fromString: number, toString: number) => {
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
            formation: depthFormationField ?? undefined,
            specialTeamType: depthSpecialField ?? undefined,
          })
          updates.push({
            unit: selectedUnit,
            position,
            string: fromString,
            playerId: toEntry.playerId,
            formation: depthFormationField ?? undefined,
            specialTeamType: depthSpecialField ?? undefined,
          })
        } else {
          updates.push({
            unit: selectedUnit,
            position,
            string: fromString,
            playerId: null,
            formation: depthFormationField ?? undefined,
            specialTeamType: depthSpecialField ?? undefined,
          })
          updates.push({
            unit: selectedUnit,
            position,
            string: toString,
            playerId: fromEntry.playerId,
            formation: depthFormationField ?? undefined,
            specialTeamType: depthSpecialField ?? undefined,
          })
        }
        if (updates.length > 0) onUpdate(updates)
      }
      setSlotDetails(null)
    },
    [depthChart, selectedUnit, matchesPersistedDepthRow, depthFormationField, depthSpecialField, onUpdate]
  )

  const eligibilityHintsByPlayerId = useMemo(() => {
    if (!preset) return new Map<string, string>()
    const slots = getFormationSlots(preset)
    const map = new Map<string, string>()
    for (const p of players) {
      const keys = getBestFitSlotKeys(p.positionGroup, slots)
      const labels = keys.slice(0, 3)
      if (labels.length) map.set(p.id, `Best fit: ${labels.join(", ")}`)
    }
    return map
  }, [preset, players])

  const getResolvedPlayersForSlot = useCallback(
    (slotKey: string) => {
      return assignmentsForCurrentView
        .filter(
          (e) =>
            e.unit === selectedUnit &&
            e.position === slotKey &&
            e.playerId != null &&
            (currentFormation ? e.formation === currentFormation : !e.formation) &&
            (currentSpecialTeamType ? e.specialTeamType === currentSpecialTeamType : !e.specialTeamType)
        )
        .map((e) => {
          const player = playersById.get(e.playerId!)
          return { player: player ?? null, string: e.string }
        })
        .filter((x) => x.player != null)
        .sort((a, b) => a.string - b.string) as Array<{ player: RosterPlayerForSlot; string: number }>
    },
    [
      assignmentsForCurrentView,
      selectedUnit,
      currentFormation,
      currentSpecialTeamType,
      playersById,
    ]
  )

  const unitLabel =
    selectedUnit === "offense" ? "Offense" : selectedUnit === "defense" ? "Defense" : "Special Teams"
  const formationName = preset?.name ?? ""

  const segmentTabs = useMemo(
    () =>
      showCallUpSuggestions
        ? ([
            { id: "roster" as const, label: "Roster", icon: Users },
            { id: "formation" as const, label: "Formation", icon: LayoutGrid },
            { id: "suggestions" as const, label: "Suggestions", icon: Lightbulb },
          ] as const)
        : ([
            { id: "roster" as const, label: "Roster", icon: Users },
            { id: "formation" as const, label: "Formation", icon: LayoutGrid },
          ] as const),
    [showCallUpSuggestions]
  )

  useEffect(() => {
    if (!showCallUpSuggestions && mode === "suggestions") setMode("roster")
  }, [showCallUpSuggestions, mode])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
        <h1 className="min-w-0 truncate text-lg font-semibold text-foreground">Depth Chart</h1>
        <div className="flex shrink-0 items-center gap-2">
          {hasUnsavedChanges && onSave && (
            <Button type="button" size="sm" className="min-h-10 rounded-xl" onClick={() => void onSave()}>
              Save
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Segment: Roster | Formation | Suggestions */}
      <div className="shrink-0 border-b border-border bg-muted/30 px-2 py-2">
        <div className="flex rounded-xl bg-background p-1 shadow-sm">
          {segmentTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unit switcher */}
      <div className="shrink-0 overflow-x-auto border-b border-border px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2">
          {(["offense", "defense", "special_teams"] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setSelectedUnit(unit)}
              className={`min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors ${
                selectedUnit === unit
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-foreground hover:bg-muted"
              }`}
            >
              {unit === "offense" ? "Offense" : unit === "defense" ? "Defense" : "Special Teams"}
            </button>
          ))}
        </div>
      </div>

      {/* Context controls: Formation + Filters (always visible, no side-by-side layout) */}
      <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
        <div className="flex gap-2">
          {preset && (
            <button
              type="button"
              onClick={() => setFormationPickerOpen(true)}
              className="flex min-h-[44px] flex-1 items-center justify-between rounded-xl border border-border bg-background px-4 text-left text-sm font-medium text-foreground shadow-sm"
            >
              <span className="truncate">{formationName}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] shrink-0 rounded-xl px-4"
            onClick={() => setFiltersOpen(true)}
          >
            <Filter className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Filters</span>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {mode === "roster" && (
          <div className="space-y-4 p-4">
            <Input
              type="search"
              placeholder="Search players…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 rounded-xl text-base"
            />
            {/* Filter summary chips: only when filters are active; chips clear that filter */}
            {(positionFilter || sideFilter !== "all" || activeOnly || unassignedOnly) && (
              <div className="flex flex-wrap gap-2">
                {positionFilter && (
                  <button
                    type="button"
                    onClick={() => setPositionFilter("")}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-foreground"
                  >
                    Position: {positionFilter}
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {sideFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setSideFilter("all")}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-foreground capitalize"
                  >
                    Side: {sideFilter}
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {activeOnly && (
                  <button
                    type="button"
                    onClick={() => setActiveOnly(false)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-foreground"
                  >
                    Active only
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {unassignedOnly && (
                  <button
                    type="button"
                    onClick={() => setUnassignedOnly(false)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-foreground"
                  >
                    Unassigned only
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            <ul className="space-y-3">
              {sortedRoster.map((player) => {
                const hint = eligibilityHintsByPlayerId.get(player.id)
                return (
                  <li key={player.id} className="list-none">
                    <button
                      type="button"
                      onClick={() => setPlayerQuickView(player)}
                      className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {player.imageUrl?.trim() ? (
                          <Image
                            src={player.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-base font-bold text-muted-foreground">
                            {getInitials(player.firstName, player.lastName)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {player.firstName} {player.lastName}
                          </span>
                          {player.jerseyNumber != null && (
                            <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
                              #{player.jerseyNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {player.positionGroup ?? "—"} · {(player.healthStatus ?? player.status) || "—"}
                        </p>
                        {hint && (
                          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                        )}
                      </div>
                      {canEdit && (
                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0 rounded-xl"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAssignSheetSlot({ position: "", string: 1, label: "Select a slot" })
                            setAssignPreSelectedPlayerId(null)
                          }}
                        >
                          <UserPlus className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Assign</span>
                        </Button>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            {sortedRoster.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
                {unassignedOnly ? "All players assigned or no matches." : "No players match filters."}
              </div>
            )}
          </div>
        )}

        {mode === "formation" && preset && (
          <div className="space-y-4 p-4 pb-8">
            {missingFormationSlots.length > 0 && !missingBannerDismissed && (
              <div className="flex flex-wrap items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">Missing starters: </span>
                  {preset.name} — {missingFormationSlots.join(", ")}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-amber-300 bg-background px-2 py-1 text-xs font-medium"
                  onClick={() => setMissingBannerDismissed(true)}
                >
                  Ignore
                </button>
              </div>
            )}
            {(() => {
              const fieldPositions = getSlotPositions(preset)
              const showField = useFormationFieldView && fieldPositions.length > 0

              return (
                <>
                  {showField ? (
                    <>
                      <FormationFieldView
                        preset={preset}
                        getResolvedPlayersForSlot={getResolvedPlayersForSlot}
                        selectedSlotKey={assignSheetSlot?.position ?? null}
                        canEdit={canEdit}
                        onTapEmpty={(slotKey, str, label) =>
                          setAssignSheetSlot({ position: slotKey, string: str, label })
                        }
                        onTapFilled={(slotKey, str, label, player) =>
                          setSlotDetails({
                            position: slotKey,
                            string: str,
                            label,
                            player,
                          })
                        }
                      />
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => setUseFormationFieldView(false)}
                          className="text-sm font-medium text-muted-foreground underline hover:text-foreground"
                        >
                          List view
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {fieldPositions.length > 0 && (
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => setUseFormationFieldView(true)}
                            className="text-sm font-medium text-muted-foreground underline hover:text-foreground"
                          >
                            Field view
                          </button>
                        </div>
                      )}
                      <div className="space-y-6">
                        {(() => {
                          const rows = preset.rows?.length
                            ? preset.rows
                            : [{ alignment: "center" as const, slots: preset.slots }]
                          return rows.map((row, rowIdx) => (
                            <div key={row.id ?? rowIdx} className="space-y-3">
                              {row.slots.map((slot) => {
                                const resolved = getResolvedPlayersForSlot(slot.slotKey)
                                const starter = resolved.find((r) => r.string === 1)?.player
                                const second = resolved.find((r) => r.string === 2)?.player
                                const third = resolved.find((r) => r.string === 3)?.player
                                const slotLabel = slot.displayLabel + (slot.alias ? ` (${slot.alias})` : "")
                                return (
                                  <div
                                    key={slot.slotKey}
                                    className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                                  >
                                    <div className="mb-3 flex items-center justify-between">
                                      <span className="font-semibold text-foreground">{slotLabel}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {getAcceptedGroupsDisplay(slot)}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                      {[1, 2, 3].map((str) => {
                                        const p = str === 1 ? starter : str === 2 ? second : third
                                        const depthLevel = (str === 1 ? 1 : str === 2 ? 2 : 3) as 1 | 2 | 3
                                        if (p) {
                                          return (
                                            <div key={str} className="flex items-center gap-3">
                                              <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">
                                                {str}
                                              </span>
                                              <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={() =>
                                                  setSlotDetails({
                                                    position: slot.slotKey,
                                                    string: str,
                                                    label: slotLabel,
                                                    player: p,
                                                  })
                                                }
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault()
                                                    setSlotDetails({
                                                      position: slot.slotKey,
                                                      string: str,
                                                      label: slotLabel,
                                                      player: p,
                                                    })
                                                  }
                                                }}
                                                className="min-h-[56px] flex-1 cursor-pointer rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-muted/50"
                                              >
                                                <DepthSlotCard
                                                  player={p}
                                                  depthLevel={depthLevel}
                                                  canEdit={canEdit}
                                                  onRemove={
                                                    canEdit
                                                      ? () => handleRemove(slot.slotKey, str)
                                                      : undefined
                                                  }
                                                  onPromote={
                                                    canEdit && str !== 1
                                                      ? () => handleReorder(slot.slotKey, str, 1)
                                                      : undefined
                                                  }
                                                />
                                              </div>
                                            </div>
                                          )
                                        }
                                        return (
                                          <div key={str} className="flex items-center gap-3">
                                            <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">
                                              {str}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                canEdit &&
                                                setAssignSheetSlot({
                                                  position: slot.slotKey,
                                                  string: str,
                                                  label: slotLabel,
                                                })
                                              }
                                              className="flex min-h-[56px] flex-1 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                                            >
                                              + Assign player
                                            </button>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ))
                        })()}
                      </div>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        )}

        {mode === "suggestions" && showCallUpSuggestions && (
          <div className="space-y-4 p-4 pb-8">
            {programId ? (
              <CallUpSuggestionsPanel programId={programId} />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Suggestions require a program. Switch to Formation or Roster to manage depth.
              </div>
            )}
          </div>
        )}
      </div>

      {/* —— Bottom sheets —— */}

      {/* Assign Player sheet */}
      <MobileBottomSheet
        open={!!assignSheetSlot}
        onClose={() => {
          setAssignSheetSlot(null)
          setAssignPreSelectedPlayerId(null)
          setAssignSheetSearch("")
        }}
        title="Assign Player"
        subtitle={assignSheetSlot?.position ? assignSheetSlot.label : "Select a slot, then choose a player"}
      >
        <div className="space-y-2 px-4 pt-2">
          {assignSheetSlot && !assignSheetSlot.position && preset && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {assignPreSelectedPlayerId ? "Choose a slot to assign this player:" : "Choose a slot to assign a player:"}
              </p>
              {getFormationSlots(preset).map((slot) => (
                <div key={slot.slotKey} className="flex flex-wrap gap-2">
                  {[1, 2, 3].map((str) => {
                    const resolved = getResolvedPlayersForSlot(slot.slotKey)
                    const hasPlayer = resolved.some((r) => r.string === str)
                    const preSelected = assignPreSelectedPlayerId
                    const eligible =
                      !preSelected ||
                      (preset && getValidSlotKeys(playersById.get(preSelected)?.positionGroup ?? null, getFormationSlots(preset)).has(slot.slotKey))
                    return (
                      <button
                        key={`${slot.slotKey}-${str}`}
                        type="button"
                        onClick={() => {
                          if (preSelected && eligible) {
                            handleDrop(slot.slotKey, str, preSelected)
                            setAssignSheetSlot(null)
                            setAssignPreSelectedPlayerId(null)
                          } else if (!preSelected) {
                            setAssignSheetSlot({
                              position: slot.slotKey,
                              string: str,
                              label: `${slot.displayLabel}${slot.alias ? ` (${slot.alias})` : ""} — ${str === 1 ? "Starter" : str === 2 ? "2nd" : "3rd"}`,
                            })
                          }
                        }}
                        className={`min-h-[44px] rounded-xl border-2 px-4 text-sm font-medium ${
                          !eligible
                            ? "border-border bg-muted/20 text-muted-foreground opacity-60"
                            : hasPlayer
                              ? "border-border bg-muted/30 text-muted-foreground"
                              : "border-primary/50 bg-primary/5 text-foreground hover:bg-primary/10"
                        }`}
                      >
                        {slot.displayLabel} {str}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
          {assignSheetSlot?.position && preset && (
            <>
              <div className="sticky top-0 z-10 bg-background pb-2">
                <Input
                  type="search"
                  placeholder="Search by name or jersey…"
                  value={assignSheetSearch}
                  onChange={(e) => setAssignSheetSearch(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
              {(() => {
                const slots = getFormationSlots(preset)
                const slotKey = assignSheetSlot.position
                const eligible = filteredRoster.filter((p) =>
                  getValidSlotKeys(p.positionGroup, slots).has(slotKey)
                )
                const bySearch =
                  assignSheetSearch.trim() === ""
                    ? eligible
                    : eligible.filter((p) => {
                        const q = assignSheetSearch.trim().toLowerCase()
                        const name = `${(p.firstName ?? "")} ${(p.lastName ?? "")}`.toLowerCase()
                        const jersey = String(p.jerseyNumber ?? "")
                        return name.includes(q) || jersey.includes(q)
                      })
                const recommendedFirst = [...bySearch].sort((a, b) => {
                  const bestA = getBestFitSlotKeys(a.positionGroup, slots)
                  const bestB = getBestFitSlotKeys(b.positionGroup, slots)
                  const aFirst = bestA[0] === slotKey ? 1 : 0
                  const bFirst = bestB[0] === slotKey ? 1 : 0
                  if (bFirst !== aFirst) return aFirst - bFirst
                  return 0
                })
                if (recommendedFirst.length === 0)
                  return (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No eligible players. Try a different search or adjust filters.
                    </p>
                  )
                return (
                  <div key="assign-list" className="grid gap-2 md:grid-cols-2">
                    {recommendedFirst.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    if (assignSheetSlot?.position)
                      handleDrop(assignSheetSlot.position, assignSheetSlot.string, player.id)
                  }}
                  className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                    {player.imageUrl?.trim() ? (
                      <Image
                        src={player.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
                        {getInitials(player.firstName, player.lastName)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground">
                      {player.firstName} {player.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      #{player.jerseyNumber ?? "—"} · {player.positionGroup ?? "—"}
                    </div>
                  </div>
                  <Button size="sm" className="shrink-0 rounded-xl">
                    Assign
                  </Button>
                </button>
              ))}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </MobileBottomSheet>

      {/* Player Quick View sheet */}
      <MobileBottomSheet
        open={!!playerQuickView}
        onClose={() => setPlayerQuickView(null)}
        title={playerQuickView ? `${playerQuickView.firstName} ${playerQuickView.lastName}` : ""}
        subtitle={
          playerQuickView
            ? `#${playerQuickView.jerseyNumber ?? "—"} · ${playerQuickView.positionGroup ?? "—"}`
            : undefined
        }
      >
        <div className="space-y-4 px-4 pt-2">
          {playerQuickView && (
            <>
              <div className="flex justify-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-muted">
                  {playerQuickView.imageUrl?.trim() ? (
                    <Image
                      src={playerQuickView.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                      {getInitials(playerQuickView.firstName, playerQuickView.lastName)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  className="min-h-[48px] w-full rounded-xl"
                  onClick={() => {
                    setAssignSheetSlot({ position: "", string: 1, label: "Select a slot" })
                    setAssignPreSelectedPlayerId(playerQuickView.id)
                    setPlayerQuickView(null)
                  }}
                >
                  <UserPlus className="mr-2 h-5 w-5" />
                  Assign to position
                </Button>
                <Button variant="outline" className="min-h-[48px] w-full rounded-xl" asChild>
                  <a href={`/dashboard/roster/${playerQuickView.id}?teamId=${teamId}`}>
                    View profile
                  </a>
                </Button>
                <Button variant="outline" className="min-h-[48px] w-full rounded-xl" asChild>
                  <a href={`/dashboard/messages?teamId=${encodeURIComponent(teamId)}`}>
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Message
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </MobileBottomSheet>

      {/* Filters sheet */}
      <MobileBottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
      >
        <div className="space-y-4 px-4 pt-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Position</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-background px-4 text-foreground"
            >
              <option value="">All positions</option>
              {positionOptions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Side</label>
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as typeof sideFilter)}
              className="h-12 w-full rounded-xl border border-border bg-background px-4 text-foreground"
            >
              <option value="all">All</option>
              <option value="offense">Offense</option>
              <option value="defense">Defense</option>
              <option value="athlete">Athlete</option>
            </select>
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border px-4">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-5 w-5 rounded border-border"
            />
            <span className="text-sm font-medium text-foreground">Active only</span>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border px-4">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
              className="h-5 w-5 rounded border-border"
            />
            <span className="text-sm font-medium text-foreground">Unassigned only</span>
          </label>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Sort</label>
            <select
              value={rosterSort}
              onChange={(e) => setRosterSort(e.target.value as typeof rosterSort)}
              className="h-12 w-full rounded-xl border border-border bg-background px-4 text-foreground"
            >
              <option value="name_az">Name A–Z</option>
              <option value="jersey">Jersey number</option>
              <option value="position">Position</option>
            </select>
          </div>
          <Button
            className="min-h-[48px] w-full rounded-xl"
            onClick={() => setFiltersOpen(false)}
          >
            Apply filters
          </Button>
        </div>
      </MobileBottomSheet>

      {/* Slot Actions sheet (filled slot): Reassign, Swap, Remove, View — no inline menus */}
      <MobileBottomSheet
        open={!!slotDetails}
        onClose={() => {
          setSlotDetails(null)
          setSlotActionsSwapMode(false)
        }}
        title={slotActionsSwapMode ? "Swap with…" : (slotDetails?.label ?? "Slot")}
        subtitle={
          !slotActionsSwapMode && slotDetails
            ? `#${slotDetails.player.jerseyNumber ?? "—"} · ${slotDetails.player.positionGroup ?? "—"}`
            : slotActionsSwapMode && slotDetails
              ? `Swap ${slotDetails.player.firstName} ${slotDetails.player.lastName} with another slot`
              : undefined
        }
      >
        <div className="space-y-3 px-4 pt-2">
          {slotDetails && !slotActionsSwapMode && (
            <>
              <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                  {getPlayerPhotoUrl(slotDetails.player) ? (
                    <Image
                      src={getPlayerPhotoUrl(slotDetails.player)!}
                      alt=""
                      width={56}
                      height={56}
                      className="rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-base font-bold text-muted-foreground">
                      {getInitials(
                        slotDetails.player.firstName,
                        slotDetails.player.lastName
                      )}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">
                    {slotDetails.player.firstName} {slotDetails.player.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    #{slotDetails.player.jerseyNumber ?? "—"} · {slotDetails.player.positionGroup ?? "—"}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="min-h-[48px] w-full rounded-xl"
                  onClick={() => {
                    setAssignSheetSlot({
                      position: slotDetails.position,
                      string: slotDetails.string,
                      label: slotDetails.label,
                    })
                    setSlotDetails(null)
                  }}
                >
                  Reassign
                </Button>
                {canEdit && (
                  <Button
                    variant="outline"
                    className="min-h-[48px] w-full rounded-xl"
                    onClick={() => setSlotActionsSwapMode(true)}
                  >
                    Swap
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="outline"
                    className="min-h-[48px] w-full rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleRemove(slotDetails.position, slotDetails.string)}
                  >
                    Remove from slot
                  </Button>
                )}
                <Button variant="ghost" className="min-h-[48px] w-full rounded-xl" asChild>
                  <a href={`/dashboard/roster/${slotDetails.player.id}?teamId=${teamId}`}>
                    View player
                  </a>
                </Button>
              </div>
            </>
          )}
          {slotDetails && slotActionsSwapMode && preset && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Select a slot to swap with:</p>
              {assignmentsForCurrentView
                .filter(
                  (e) =>
                    e.playerId != null &&
                    !(e.position === slotDetails.position && e.string === slotDetails.string)
                )
                .map((e) => {
                  const slot = getFormationSlots(preset!).find((s) => s.slotKey === e.position)
                  const label = slot?.displayLabel ?? e.position
                  const otherPlayer = playersById.get(e.playerId!)
                  const strLabel = e.string === 1 ? "Starter" : e.string === 2 ? "2nd" : "3rd"
                  return (
                    <button
                      key={`${e.position}-${e.string}`}
                      type="button"
                      onClick={() =>
                        handleSwap(slotDetails.position, slotDetails.string, e.position, e.string)
                      }
                      className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">
                          {label} — {strLabel}
                        </div>
                        {otherPlayer && (
                          <div className="text-sm text-muted-foreground">
                            {otherPlayer.firstName} {otherPlayer.lastName} · #{otherPlayer.jerseyNumber ?? "—"}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              <Button
                variant="ghost"
                className="min-h-[48px] w-full rounded-xl"
                onClick={() => setSlotActionsSwapMode(false)}
              >
                Back
              </Button>
            </div>
          )}
        </div>
      </MobileBottomSheet>

      {/* Formation Picker sheet */}
      <MobileBottomSheet
        open={formationPickerOpen}
        onClose={() => setFormationPickerOpen(false)}
        title="Formation"
        subtitle={unitLabel}
      >
        <div className="space-y-2 px-4 pt-2">
          {presetsForSide.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedPresetByUnit((prev) => ({ ...prev, [selectedUnit]: p.id }))
                setFormationPickerOpen(false)
              }}
              className={`flex w-full flex-col items-start rounded-xl border-2 p-4 text-left transition-colors ${
                selectedPresetId === p.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <span className="font-semibold text-foreground">{p.name}</span>
              {p.subtitle && (
                <span className="text-sm text-muted-foreground">{p.subtitle}</span>
              )}
            </button>
          ))}
        </div>
      </MobileBottomSheet>
    </div>
  )
}
