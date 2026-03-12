"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { PlaybookBrowser } from "@/components/portal/playbook-browser"
import { PlaybookBuilder, type CanvasData } from "@/components/portal/playbook-builder"
import { PlaybookInspector, type InspectorSelectedPlayer } from "@/components/portal/playbook-inspector"
import { PlaybookHeader } from "@/components/portal/playbook-header"
import { PlaybookSidebar } from "@/components/portal/playbook-sidebar"
import { PlaycallerView } from "@/components/portal/playcaller-view"
import { templateDataToCanvasData, canvasPlayersToTemplateData } from "@/lib/utils/playbook-canvas"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import type { FormationRecord, SubFormationRecord, PlayRecord, SideOfBall, PlayType, RoutePoint, BlockEndPoint } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"

interface PlaybookWorkspaceProps {
  teamId: string
  canEdit: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
}

type DesignerMode = "idle" | "play" | "formation"

export function PlaybookWorkspace({
  teamId,
  canEdit,
  canEditOffense,
  canEditDefense,
  canEditSpecialTeams,
}: PlaybookWorkspaceProps) {
  const [formations, setFormations] = useState<FormationRecord[]>([])
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null)
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null)
  const [selectedSubFormationId, setSelectedSubFormationId] = useState<string | null>(null)
  const [selectedFormationName, setSelectedFormationName] = useState<string>("")
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [subFormations, setSubFormations] = useState<SubFormationRecord[]>([])
  const [selectedSide, setSelectedSide] = useState<SideOfBall | null>(null)
  const [designerMode, setDesignerMode] = useState<DesignerMode>("idle")
  const [editingFormation, setEditingFormation] = useState<FormationRecord | null>(null)
  const [playcallerMode, setPlaycallerMode] = useState(false)
  const [playcallerIndex, setPlaycallerIndex] = useState(0)
  const [inspectorSelection, setInspectorSelection] = useState<"play" | "player" | "zone" | "route" | null>(null)
  const [selectedPlayerInspector, setSelectedPlayerInspector] = useState<InspectorSelectedPlayer | null>(null)
  const [selectedZoneInspector, setSelectedZoneInspector] = useState<{ id: string; type: string; size: string } | null>(null)
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [focusUnassignedOnce, setFocusUnassignedOnce] = useState(false)
  const [editingPlayType, setEditingPlayType] = useState<PlayType | null>(null)
  type RosterPlayer = { id: string; firstName: string; lastName: string; jerseyNumber: number | null; positionGroup: string | null }
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([])

  const fetchFormations = useCallback(async () => {
    const res = await fetch(`/api/formations?teamId=${teamId}`)
    if (res.ok) {
      const data = await res.json()
      setFormations(data)
    }
  }, [teamId])

  const fetchPlays = useCallback(async () => {
    const res = await fetch(`/api/plays?teamId=${teamId}`, { credentials: "same-origin" })
    if (res.ok) {
      const data = await res.json()
      setPlays(data)
    }
  }, [teamId])

  const fetchSubFormations = useCallback(async () => {
    const res = await fetch(`/api/sub-formations?teamId=${teamId}`)
    if (res.ok) {
      const data = await res.json()
      setSubFormations(data)
    }
  }, [teamId])

  const fetchDepthChart = useCallback(async () => {
    const res = await fetch(`/api/roster/depth-chart?teamId=${teamId}`, { credentials: "same-origin" })
    if (res.ok) {
      const data = await res.json()
      setDepthChartEntries(data.entries ?? [])
    }
  }, [teamId])

  const fetchRoster = useCallback(async () => {
    const res = await fetch(`/api/roster?teamId=${teamId}`, { credentials: "same-origin" })
    if (res.ok) {
      const data = await res.json()
      setRosterPlayers(
        (data ?? []).map((p: { id: string; firstName?: string; lastName?: string; jerseyNumber?: number | null; positionGroup?: string | null }) => ({
          id: p.id,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          jerseyNumber: p.jerseyNumber ?? null,
          positionGroup: p.positionGroup ?? null,
        }))
      )
    }
  }, [teamId])

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([fetchFormations(), fetchPlays(), fetchSubFormations(), fetchDepthChart(), fetchRoster()]).finally(() => setLoading(false))
  }, [fetchFormations, fetchPlays, fetchSubFormations, fetchDepthChart, fetchRoster])

  const onAssignSlot = useCallback(
    async (unit: string, position: string, stringNum: number, playerId: string | null) => {
      const current = depthChartEntries
        .filter((e) => e.unit === unit && e.position.toUpperCase() === position.toUpperCase())
        .sort((a, b) => a.string - b.string)
      const map = new Map<number, string | null>()
      for (const e of current) map.set(e.string, e.playerId ?? null)
      map.set(stringNum, playerId)
      const updates = Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([str, pid]) => ({ unit, position, string: str, playerId: pid }))
      const res = await fetch(`/api/roster/depth-chart?teamId=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
        credentials: "same-origin",
      })
      if (res.ok) await fetchDepthChart()
      return res.ok
    },
    [teamId, depthChartEntries, fetchDepthChart]
  )

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const selectedPlay = plays.find((p) => p.id === selectedPlayId)
  const selectedFormation = formations.find((f) => f.id === selectedFormationId)

  const canEditSide = (side: SideOfBall) => {
    if (side === "offense") return canEdit && canEditOffense
    if (side === "defense") return canEdit && canEditDefense
    return canEdit && canEditSpecialTeams
  }

  const handleSelectPlay = (play: PlayRecord) => {
    setSelectedPlayId(play.id)
    setSelectedFormationId(play.formationId ?? null)
    setSelectedSubFormationId(play.subFormationId ?? null)
    setSelectedFormationName(
      play.formationId ? (formations.find((f) => f.id === play.formationId)?.name ?? play.formation ?? "") : (play.formation ?? "")
    )
    setSelectedSubcategory(play.subcategory ?? null)
    setSelectedSide(play.side as SideOfBall)
    setEditingFormation(null)
    setEditingPlayType(play.playType ?? null)
    setDesignerMode("play")
  }

  const handleReviewAssignments = (play: PlayRecord) => {
    handleSelectPlay(play)
    setFocusUnassignedOnce(true)
  }

  const handleSelectFormation = (formationId: string | null, formationName: string, side: SideOfBall) => {
    setSelectedPlayId(null)
    setSelectedSubFormationId(null)
    setSelectedFormationId(formationId)
    setSelectedFormationName(formationName)
    if (side) setSelectedSide(side)
    setEditingFormation(null)
    setDesignerMode("idle")
  }

  const handleSelectSubFormation = (subFormationId: string | null, _subFormationName: string) => {
    setSelectedPlayId(null)
    setSelectedSubFormationId(subFormationId)
    setDesignerMode("idle")
  }

  const handleBrowserBack = () => {
    if (selectedSubFormationId != null) {
      setSelectedSubFormationId(null)
    } else if (selectedFormationId != null) {
      setSelectedFormationId(null)
      setSelectedFormationName("")
    } else if (selectedSide != null) {
      setSelectedSide(null)
    }
  }

  const handleNewFormation = (side: SideOfBall) => {
    setSelectedPlayId(null)
    setSelectedFormationId(null)
    setSelectedSubFormationId(null)
    setSelectedFormationName("")
    setSelectedSide(side)
    setEditingFormation({
      id: "",
      teamId,
      playbookId: null,
      side,
      name: "New Formation",
      parentFormationId: null,
      templateData: { fieldView: "HALF", shapes: [], paths: [] },
      createdAt: "",
      updatedAt: "",
    })
    setDesignerMode("formation")
  }

  const handleNewPlay = (side: SideOfBall, formationId: string | null, formationName: string, subFormationId?: string | null) => {
    setSelectedPlayId(null)
    setSelectedFormationId(formationId)
    setSelectedSubFormationId(subFormationId ?? null)
    setSelectedFormationName(formationName || "Custom")
    setSelectedSubcategory(null)
    setSelectedSide(side)
    setEditingFormation(null)
    setEditingPlayType(null)
    setDesignerMode("play")
  }

  const handleNewPlayFromFormation = (formation: FormationRecord) => {
    setSelectedPlayId(null)
    setSelectedFormationId(formation.id)
    setSelectedSubFormationId(null)
    setSelectedFormationName(formation.name)
    setSelectedSubcategory(null)
    setSelectedSide(formation.side)
    setEditingFormation(null)
    setDesignerMode("play")
  }

  const handleNewSubFormation = async (formationId: string, formationName: string, side: SideOfBall, name: string) => {
    try {
      const res = await fetch("/api/sub-formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          formationId,
          side,
          name: (name || "New Sub-Formation").trim(),
        }),
      })
      if (!res.ok) throw new Error("Failed to create sub-formation")
      const created = await res.json()
      await fetchSubFormations()
      setSelectedSubFormationId(created.id)
      setSelectedFormationId(formationId)
      setSelectedFormationName(formationName)
      setSelectedSide(side)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create sub-formation")
    }
  }

  const handleEditFormation = (formation: FormationRecord) => {
    setSelectedPlayId(null)
    setEditingFormation(formation)
    setSelectedSide(formation.side)
    setDesignerMode("formation")
  }

  const handleSavePlay = async (canvasData: PlayCanvasData, playName: string) => {
    const formation =
      selectedFormationId && selectedFormationName?.trim()
        ? selectedFormationName.trim()
        : (selectedFormationName?.trim() || "Custom")
    const subFormationIdToSave = selectedSubFormationId && selectedSubFormationId !== "__uncategorized__" ? selectedSubFormationId : null
    const playTypeToSave = editingPlayType ?? selectedPlay?.playType ?? null
    try {
      if (selectedPlayId) {
        const res = await fetch(`/api/plays/${selectedPlayId}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: playName,
            formation,
            formationId: selectedFormationId,
            subFormationId: subFormationIdToSave,
            subcategory: selectedSubcategory,
            playType: playTypeToSave,
            canvasData,
          }),
        })
        if (!res.ok) throw new Error("Failed to update play")
      } else {
        const res = await fetch("/api/plays", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            side: effectiveSide,
            formation,
            formationId: selectedFormationId ?? undefined,
            subFormationId: subFormationIdToSave ?? undefined,
            subcategory: selectedSubcategory ?? undefined,
            name: playName,
            playType: playTypeToSave ?? undefined,
            canvasData,
          }),
        })
        if (!res.ok) throw new Error("Failed to create play")
      }
      await fetchPlays()
      if (!selectedPlayId) {
        const data = await (await fetch(`/api/plays?teamId=${teamId}`, { credentials: "same-origin" })).json()
        const created = data.find((p: PlayRecord) => p.name === playName)
        if (created) setSelectedPlayId(created.id)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save play")
    }
  }

  const handleSaveFormation = async (canvasData: PlayCanvasData, formationName: string) => {
    const sideForFormation = editingFormation?.side ?? selectedSide ?? selectedFormation?.side ?? "offense"
    const templateData = canvasPlayersToTemplateData(canvasData.players, sideForFormation)
    try {
      if (editingFormation?.id) {
        const res = await fetch(`/api/formations/${editingFormation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formationName.trim(), templateData }),
        })
        if (!res.ok) throw new Error("Failed to update formation")
      } else {
        const res = await fetch("/api/formations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            side: sideForFormation,
            name: formationName.trim(),
            templateData,
          }),
        })
        if (!res.ok) throw new Error("Failed to create formation")
      }
      await fetchFormations()
      setEditingFormation(null)
      setDesignerMode("idle")
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save formation")
    }
  }

  /** Persistence path: builder canvasData (incl. route/blockingLine) → PlayCanvasData (normalized) → handleSavePlay → API PATCH/POST canvasData → DB canvas_data. Load: API → selectedPlay.canvasData → initialCanvasDataForDesigner (route/block normalized for render). */
  const handleSaveFromBuilder = (data: CanvasData, name: string) => {
    const coord = new FieldCoordinateSystem(800, 600, 15, 50)
    const canvasData: PlayCanvasData = {
      players: data.players.map((p) => {
        const base = {
          id: p.id,
          x: p.x,
          y: p.y,
          xYards: p.xYards ?? 0,
          yYards: p.yYards ?? 0,
          label: p.label,
          shape: p.shape,
          playerType: p.playerType,
          technique: p.technique,
          gap: p.gap,
          positionCode: (p as { positionCode?: string | null }).positionCode ?? undefined,
          positionNumber: (p as { positionNumber?: number | null }).positionNumber ?? undefined,
        }
        const route: RoutePoint[] | undefined = p.route?.length
          ? p.route.map((pt, i) => {
              const x = "x" in pt ? pt.x! : coord.yardToPixel((pt as { xYards: number }).xYards, (pt as { yYards: number }).yYards).x
              const y = "y" in pt ? pt.y! : coord.yardToPixel((pt as { xYards: number }).xYards, (pt as { yYards: number }).yYards).y
              const xYards = "xYards" in pt ? (pt as { xYards: number }).xYards : coord.pixelToYard(x, y).xYards
              const yYards = "yYards" in pt ? (pt as { yYards: number }).yYards : coord.pixelToYard(x, y).yYards
              return { x, y, xYards, yYards, t: "t" in pt ? pt.t : i / (p.route!.length - 1 || 1) }
            })
          : undefined
        const blockingLine: BlockEndPoint | undefined = p.blockingLine
          ? (() => {
              const bl = p.blockingLine as { x?: number; y?: number; xYards?: number; yYards?: number }
              const xYards = bl.xYards ?? (bl.x != null ? coord.pixelToYard(bl.x, bl.y ?? 0).xYards : 0)
              const yYards = bl.yYards ?? (bl.y != null ? coord.pixelToYard(bl.x ?? 0, bl.y).yYards : 0)
              return { x: bl.x, y: bl.y, xYards, yYards }
            })()
          : undefined
        const animationTiming = (p as { animationTiming?: PlayCanvasData["players"][0]["animationTiming"] }).animationTiming
        const preSnapMotion = (p as { preSnapMotion?: PlayCanvasData["players"][0]["preSnapMotion"] }).preSnapMotion
        return {
          ...base,
          route,
          blockingLine,
          ...(animationTiming != null ? { animationTiming } : {}),
          ...(preSnapMotion != null ? { preSnapMotion } : {}),
        }
      }),
      zones: data.zones.map((z) => ({
        id: z.id,
        x: z.x,
        y: z.y,
        xYards: z.xYards,
        yYards: z.yYards,
        size: z.size,
        type: z.type,
      })),
      manCoverages: data.manCoverages ?? [],
      fieldType: data.fieldType ?? "half",
      side: data.side,
    }
    if (designerMode === "formation") {
      handleSaveFormation(canvasData, name)
    } else {
      handleSavePlay(canvasData, name)
    }
  }

  const handleRenameFormation = async (formationId: string, oldName: string, newName: string) => {
    try {
      const res = await fetch(`/api/formations/${formationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error("Failed to rename")
      await fetchFormations()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to rename formation")
    }
  }

  const handleDeleteFormation = async (formationId: string) => {
    try {
      const res = await fetch(`/api/formations/${formationId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      await fetchFormations()
      await fetchSubFormations()
      if (editingFormation?.id === formationId) {
        setEditingFormation(null)
        setDesignerMode("idle")
      }
      if (selectedFormationId === formationId) {
        setSelectedFormationId(null)
        setSelectedSubFormationId(null)
        setSelectedFormationName("")
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete formation")
    }
  }

  const handleRenameSubFormation = async (subFormationId: string, _oldName: string, newName: string) => {
    try {
      const res = await fetch(`/api/sub-formations/${subFormationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error("Failed to rename")
      await fetchSubFormations()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to rename sub-formation")
    }
  }

  const handleDeleteSubFormation = async (subFormationId: string) => {
    try {
      const res = await fetch(`/api/sub-formations/${subFormationId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      await fetchSubFormations()
      if (selectedSubFormationId === subFormationId) {
        setSelectedSubFormationId(null)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete sub-formation")
    }
  }

  const handleRenamePlay = async (playId: string, newName: string) => {
    try {
      const res = await fetch(`/api/plays/${playId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error("Failed to rename")
      await fetchPlays()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to rename play")
    }
  }

  const handleDuplicatePlay = async (playId: string) => {
    const play = plays.find((p) => p.id === playId)
    if (!play) return
    try {
      const res = await fetch("/api/plays", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          side: play.side,
          formation: play.formation,
          formationId: play.formationId ?? undefined,
          subFormationId: play.subFormationId ?? undefined,
          name: `${play.name} (copy)`,
          playType: play.playType ?? undefined,
          canvasData: play.canvasData,
        }),
      })
      if (!res.ok) throw new Error("Failed to duplicate")
      await fetchPlays()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to duplicate play")
    }
  }

  const handleDeletePlay = async (playId: string) => {
    try {
      const res = await fetch(`/api/plays/${playId}`, { method: "DELETE", credentials: "same-origin" })
      if (!res.ok) throw new Error("Failed to delete")
      await fetchPlays()
      if (selectedPlayId === playId) {
        setSelectedPlayId(null)
        setDesignerMode("idle")
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete play")
    }
  }

  const handleCloseDesigner = () => {
    setDesignerMode("idle")
    setEditingFormation(null)
    setEditingPlayType(null)
    setSelectedPlayerInspector(null)
    setInspectorSelection(null)
    setFocusUnassignedOnce(false)
  }

  const effectiveSide = selectedSide ?? selectedFormation?.side ?? "offense"
  const rawCanvasData =
    designerMode === "formation" && editingFormation
      ? templateDataToCanvasData(editingFormation.templateData, editingFormation.side)
      : designerMode === "play" && !selectedPlayId && selectedFormation
      ? templateDataToCanvasData(selectedFormation.templateData, effectiveSide)
      : selectedPlay?.canvasData ?? null

  // Memoize so the builder receives a stable playData reference. Otherwise every workspace re-render
  // would pass a new object and the builder's playData sync effect would overwrite local state (e.g. a
  // just-finished route) with the old saved data, causing routes to appear lost before save.
  const initialCanvasDataForDesigner: CanvasData | null = useMemo(() => {
    if (!rawCanvasData) return null
    const coord = new FieldCoordinateSystem(800, 600, 15, 50)
    const playersWithPixels = rawCanvasData.players.map((p) => {
      const hasYards = typeof p.xYards === "number" && typeof p.yYards === "number"
      const xYards = hasYards ? p.xYards : (p.x != null && p.y != null ? coord.pixelToYard(p.x, p.y).xYards : 0)
      const yYards = hasYards ? p.yYards : (p.x != null && p.y != null ? coord.pixelToYard(p.x, p.y).yYards : 0)
      const base = { ...p, x: 0, y: 0, xYards, yYards } as CanvasData["players"][number]
      const pixel = coord.yardToPixel(xYards, yYards)
      base.x = pixel.x
      base.y = pixel.y
      // Normalize route points to have x,y for rendering (API may store only xYards/yYards)
      if (p.route?.length) {
        base.route = p.route.map((pt): RoutePoint => {
          const xYards = "xYards" in pt ? (pt as { xYards: number }).xYards : coord.pixelToYard((pt as { x: number }).x, (pt as { y: number }).y).xYards
          const yYards = "yYards" in pt ? (pt as { yYards: number }).yYards : coord.pixelToYard((pt as { x: number }).x, (pt as { y: number }).y).yYards
          const px = coord.yardToPixel(xYards, yYards)
          return { x: px.x, y: px.y, xYards, yYards, t: "t" in pt ? (pt as { t: number }).t : 0 }
        })
      }
      if (p.blockingLine) {
        const bl = p.blockingLine as { x?: number; y?: number; xYards?: number; yYards?: number }
        const xYards = bl.xYards ?? (bl.x != null ? coord.pixelToYard(bl.x, bl.y ?? 0).xYards : 0)
        const yYards = bl.yYards ?? (bl.y != null ? coord.pixelToYard(bl.x ?? 0, bl.y).yYards : 0)
        const bp = coord.yardToPixel(xYards, yYards)
        base.blockingLine = { x: bp.x, y: bp.y, xYards, yYards } as BlockEndPoint
      }
      return base
    })
    const zonesWithPixels = (rawCanvasData.zones ?? []).map((z) => {
      const xY = z.xYards != null && z.yYards != null ? coord.yardToPixel(z.xYards, z.yYards) : { x: z.x ?? 0, y: z.y ?? 0 }
      return { ...z, x: xY.x, y: xY.y, xYards: z.xYards ?? 0, yYards: z.yYards ?? 0 }
    })
    return {
      players: playersWithPixels,
      zones: zonesWithPixels,
      manCoverages: rawCanvasData.manCoverages ?? [],
      fieldType: rawCanvasData.fieldType ?? "half",
      side: rawCanvasData.side,
    }
  }, [rawCanvasData])

  const initialNameForDesigner =
    designerMode === "formation"
      ? editingFormation?.name ?? "New Formation"
      : selectedPlay?.name ?? ""

  const formationCountBySide = useMemo(
    () => ({
      offense: formations.filter((f) => f.side === "offense").length,
      defense: formations.filter((f) => f.side === "defense").length,
      special_teams: formations.filter((f) => f.side === "special_teams").length,
    }),
    [formations]
  )

  const atHub = !designerMode
  const showNewPlayInHeader =
    selectedSide != null && selectedFormationId != null && canEdit

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <p className="text-sm text-slate-500">Loading playbooks...</p>
      </div>
    )
  }

  const browserProps = {
    plays,
    formations,
    subFormations,
    depthChartEntries,
    selectedSide,
    selectedFormationId,
    selectedSubFormationId,
    selectedPlayId,
    onSelectSide: setSelectedSide,
    onSelectFormation: handleSelectFormation,
    onSelectSubFormation: handleSelectSubFormation,
    onSelectPlay: handleSelectPlay,
    onBack: handleBrowserBack,
    onNewPlay: handleNewPlay,
    onNewFormation: handleNewFormation,
    onNewSubFormation: handleNewSubFormation,
    onNewPlayFromFormation: handleNewPlayFromFormation,
    onDuplicatePlay: handleDuplicatePlay,
    onRenamePlay: handleRenamePlay,
    onRenameFormation: handleRenameFormation,
    onRenameSubFormation: handleRenameSubFormation,
    onDeletePlay: handleDeletePlay,
    onDeleteFormation: handleDeleteFormation,
    onDeleteSubFormation: handleDeleteSubFormation,
    onStartPlaycaller: () => {
      setPlaycallerMode(true)
      setPlaycallerIndex(selectedPlayId ? plays.findIndex((p) => p.id === selectedPlayId) || 0 : 0)
    },
    onReviewAssignments: handleReviewAssignments,
    playEditorPath: (playId: string) => `/dashboard/playbooks/play/${playId}`,
    canEdit,
    canEditOffense,
    canEditDefense,
    canEditSpecialTeams,
  }

  return (
    <div className="flex flex-col h-full min-h-[775px] bg-slate-50">
      {playcallerMode ? (
        <PlaycallerView
          plays={plays}
          currentIndex={playcallerIndex}
          onClose={() => setPlaycallerMode(false)}
          onIndexChange={setPlaycallerIndex}
          formations={formations}
          depthChartEntries={depthChartEntries}
        />
      ) : null}

      <PlaybookHeader
        onNewFormation={handleNewFormation}
        onNewPlay={
          selectedFormation
            ? () =>
                handleNewPlay(
                  selectedFormation.side,
                  selectedFormation.id,
                  selectedFormation.name,
                  selectedSubFormationId === "__uncategorized__" ? null : selectedSubFormationId ?? undefined
                )
            : undefined
        }
        canEdit={canEdit}
        showNewPlay={showNewPlayInHeader}
        canEditOffense={canEditOffense}
        canEditDefense={canEditDefense}
        canEditSpecialTeams={canEditSpecialTeams}
      />

      <div className="flex-1 overflow-hidden p-4 md:p-5 lg:p-6">
        <div className="h-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          {atHub ? (
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-[minmax(280px,2.1fr)_minmax(320px,1fr)] gap-5 xl:gap-6 p-5 xl:p-6 overflow-hidden min-h-0">
              <div className="min-w-[280px] overflow-hidden flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
                <PlaybookBrowser {...browserProps} />
              </div>
              <div className="min-w-0 overflow-y-auto flex flex-col xl:pl-0 pt-4 xl:pt-0 border-t xl:border-t-0 border-slate-200/80">
                <PlaybookSidebar
                  formationCountBySide={formationCountBySide}
                  onBrowseOffense={() => setSelectedSide("offense")}
                  onBrowseDefense={() => setSelectedSide("defense")}
                  onBrowseSpecialTeams={() => setSelectedSide("special_teams")}
                  onNewFormation={handleNewFormation}
                  canEdit={canEdit}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-[minmax(280px,320px)_minmax(0,1.6fr)_minmax(280px,0.9fr)] overflow-hidden min-h-0 items-stretch">
              <div className="min-w-[280px] flex flex-col overflow-hidden border-r border-slate-200 bg-white flex-shrink-0">
                <PlaybookBrowser {...browserProps} />
              </div>
              <div className="min-w-0 flex flex-col overflow-hidden bg-white">
                {((designerMode === "formation" && editingFormation) || (designerMode === "play" && !selectedPlayId && selectedFormation)) && canEditSide(effectiveSide) ? (
                  <PlaybookBuilder
                    playId={designerMode === "play" ? selectedPlayId : null}
                    playData={initialCanvasDataForDesigner}
                    playName={initialNameForDesigner}
                    editorSourceKey={designerMode === "play" ? (selectedPlayId ?? `new-${selectedFormationId ?? "custom"}-${selectedSubFormationId ?? "none"}`) : `formation-${editingFormation?.id ?? "new"}`}
                    side={effectiveSide}
                    formation={designerMode === "formation" ? (editingFormation?.name ?? "New Formation") : (selectedFormationName || "Custom")}
                    onSave={handleSaveFromBuilder}
                    onClose={handleCloseDesigner}
                    canEdit={canEditSide(effectiveSide)}
                    isTemplateMode={designerMode === "formation"}
                    templateName={editingFormation?.name ?? ""}
                    onSelectPlayer={(player) => {
                      setSelectedPlayerInspector(player)
                      setInspectorSelection(player ? "player" : null)
                    }}
                    depthChartEntries={depthChartEntries}
                    focusUnassignedOnce={focusUnassignedOnce}
                    onClearFocusUnassigned={() => setFocusUnassignedOnce(false)}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/30">
                    <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                      <p className="text-sm font-semibold text-slate-800">Browse by side → formation → sub-formation</p>
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed">Open a play to edit, or create a new formation or play from the browser.</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex flex-col overflow-hidden border-l border-slate-200 bg-slate-50/50">
                <PlaybookInspector
                  play={selectedPlay ?? null}
                  formations={formations}
                  depthChartEntries={depthChartEntries}
                  rosterPlayers={rosterPlayers}
                  onAssignSlot={onAssignSlot}
                  selectedObject={inspectorSelection}
                  selectedPlayer={selectedPlayerInspector}
                  selectedZone={selectedZoneInspector}
                  onPlayNameChange={selectedPlay ? (name) => handleRenamePlay(selectedPlay.id, name) : undefined}
                  playType={editingPlayType ?? selectedPlay?.playType ?? null}
                  onPlayTypeChange={setEditingPlayType}
                  canEdit={canEdit}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
