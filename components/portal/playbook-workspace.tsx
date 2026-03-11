"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { PlaybookBrowser } from "@/components/portal/playbook-browser"
import { PlaybookBuilder, type CanvasData } from "@/components/portal/playbook-builder"
import { PlaybookInspector, type InspectorSelectedPlayer } from "@/components/portal/playbook-inspector"
import { PlaycallerView } from "@/components/portal/playcaller-view"
import { templateDataToCanvasData, canvasPlayersToTemplateData } from "@/lib/utils/playbook-canvas"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import type { FormationRecord, PlayRecord, SideOfBall, RoutePoint, BlockEndPoint } from "@/types/playbook"
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
  const [selectedFormationName, setSelectedFormationName] = useState<string>("")
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [selectedSide, setSelectedSide] = useState<SideOfBall>("offense")
  const [designerMode, setDesignerMode] = useState<DesignerMode>("idle")
  const [editingFormation, setEditingFormation] = useState<FormationRecord | null>(null)
  const [playcallerMode, setPlaycallerMode] = useState(false)
  const [playcallerIndex, setPlaycallerIndex] = useState(0)
  const [inspectorSelection, setInspectorSelection] = useState<"play" | "player" | "zone" | "route" | null>(null)
  const [selectedPlayerInspector, setSelectedPlayerInspector] = useState<InspectorSelectedPlayer | null>(null)
  const [selectedZoneInspector, setSelectedZoneInspector] = useState<{ id: string; type: string; size: string } | null>(null)
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  type RosterPlayer = { id: string; firstName: string; lastName: string; jerseyNumber: number | null }
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
        (data ?? []).map((p: { id: string; firstName?: string; lastName?: string; jerseyNumber?: number | null }) => ({
          id: p.id,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          jerseyNumber: p.jerseyNumber ?? null,
        }))
      )
    }
  }, [teamId])

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([fetchFormations(), fetchPlays(), fetchDepthChart(), fetchRoster()]).finally(() => setLoading(false))
  }, [fetchFormations, fetchPlays, fetchDepthChart, fetchRoster])

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
    setSelectedFormationName(
      play.formationId ? (formations.find((f) => f.id === play.formationId)?.name ?? play.formation ?? "") : (play.formation ?? "")
    )
    setSelectedSubcategory(play.subcategory ?? null)
    setSelectedSide(play.side as SideOfBall)
    setEditingFormation(null)
    setDesignerMode("play")
  }

  const handleSelectFormation = (formationId: string | null, formationName: string, side: SideOfBall) => {
    setSelectedPlayId(null)
    setSelectedFormationId(formationId)
    setSelectedFormationName(formationName)
    setSelectedSide(side)
    setEditingFormation(null)
    setDesignerMode("idle")
  }

  const handleNewFormation = (side: SideOfBall) => {
    setSelectedPlayId(null)
    setSelectedFormationId(null)
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

  const handleNewPlay = (side: SideOfBall, formationId: string | null, formationName: string, subcategory?: string | null) => {
    setSelectedPlayId(null)
    setSelectedFormationId(formationId)
    setSelectedFormationName(formationName || "Custom")
    setSelectedSubcategory(subcategory ?? null)
    setSelectedSide(side)
    setEditingFormation(null)
    setDesignerMode("play")
  }

  const handleNewSubFormation = (side: SideOfBall, formationName: string, subFormationName: string) => {
    setSelectedPlayId(null)
    setSelectedFormationId(null)
    setSelectedFormationName(formationName)
    setSelectedSubcategory(subFormationName)
    setSelectedSide(side)
    setEditingFormation(null)
    setDesignerMode("play")
  }

  const handleNewPlayFromFormation = (formation: FormationRecord) => {
    setSelectedPlayId(null)
    setSelectedFormationId(formation.id)
    setSelectedFormationName(formation.name)
    setSelectedSubcategory(null)
    setSelectedSide(formation.side)
    setEditingFormation(null)
    setDesignerMode("play")
  }

  const handleEditFormation = (formation: FormationRecord) => {
    setSelectedPlayId(null)
    setEditingFormation(formation)
    setSelectedSide(formation.side)
    setDesignerMode("formation")
  }

  const handleSavePlay = async (canvasData: PlayCanvasData, playName: string) => {
    // When linked to a formation, use the formation's name for denormalized play.formation (search/compat). Otherwise use current name or Custom.
    const formation =
      selectedFormationId && selectedFormationName?.trim()
        ? selectedFormationName.trim()
        : (selectedFormationName?.trim() || "Custom")
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
            subcategory: selectedSubcategory,
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
            side: selectedSide,
            formation,
            formationId: selectedFormationId ?? undefined,
            subcategory: selectedSubcategory ?? undefined,
            name: playName,
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
    const templateData = canvasPlayersToTemplateData(canvasData.players, selectedSide)
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
            side: selectedSide,
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
        return { ...base, route, blockingLine }
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
      if (editingFormation?.id === formationId) {
        setEditingFormation(null)
        setDesignerMode("idle")
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete formation")
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
          name: `${play.name} (copy)`,
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
    setSelectedPlayerInspector(null)
    setInspectorSelection(null)
  }

  const rawCanvasData =
    designerMode === "formation" && editingFormation
      ? templateDataToCanvasData(editingFormation.templateData, editingFormation.side)
      : designerMode === "play" && !selectedPlayId && selectedFormation
      ? templateDataToCanvasData(selectedFormation.templateData, selectedSide)
      : selectedPlay?.canvasData ?? null

  const initialCanvasDataForDesigner: CanvasData | null = rawCanvasData
    ? (() => {
        const coord = new FieldCoordinateSystem(800, 600, 15, 50)
        const playersWithPixels = rawCanvasData.players.map((p) => {
          const pixel = coord.yardToPixel(p.xYards, p.yYards)
          const base = { ...p, x: pixel.x, y: pixel.y, xYards: p.xYards, yYards: p.yYards }
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
          return base as CanvasData["players"][number]
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
      })()
    : null

  const initialNameForDesigner =
    designerMode === "formation"
      ? editingFormation?.name ?? "New Formation"
      : selectedPlay?.name ?? ""

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <p className="text-sm text-slate-500">Loading playbooks...</p>
      </div>
    )
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

      <div className="flex flex-1 overflow-hidden gap-px">
        <div className="w-[360px] lg:w-[400px] flex-shrink-0 flex flex-col overflow-hidden rounded-l-lg border border-slate-200 bg-white shadow-sm">
          <PlaybookBrowser
            plays={plays}
            formations={formations}
            selectedPlayId={selectedPlayId}
            onSelectPlay={handleSelectPlay}
            onNewPlay={handleNewPlay}
            onNewFormation={handleNewFormation}
            onNewPlayFromFormation={handleNewPlayFromFormation}
            onDuplicatePlay={handleDuplicatePlay}
            onRenamePlay={handleRenamePlay}
            onDeletePlay={handleDeletePlay}
            onStartPlaycaller={() => {
              setPlaycallerMode(true)
              setPlaycallerIndex(selectedPlayId ? plays.findIndex((p) => p.id === selectedPlayId) || 0 : 0)
            }}
            canEdit={canEdit}
            canEditOffense={canEditOffense}
            canEditDefense={canEditDefense}
            canEditSpecialTeams={canEditSpecialTeams}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
          {(designerMode === "play" || designerMode === "formation") && canEditSide(selectedSide) ? (
            <PlaybookBuilder
              playId={designerMode === "play" ? selectedPlayId : null}
              playData={initialCanvasDataForDesigner}
              playName={initialNameForDesigner}
              side={selectedSide}
              formation={designerMode === "formation" ? (editingFormation?.name ?? "New Formation") : (selectedFormationName || "Custom")}
              onSave={handleSaveFromBuilder}
              onClose={handleCloseDesigner}
              canEdit={canEditSide(selectedSide)}
              isTemplateMode={designerMode === "formation"}
              templateName={editingFormation?.name ?? ""}
              onSelectPlayer={(player) => {
                setSelectedPlayerInspector(player)
                setInspectorSelection(player ? "player" : null)
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-sm rounded-xl border border-slate-200 bg-slate-50/80 p-8 text-center shadow-sm">
                <p className="text-sm font-medium text-slate-700">Select a play to start editing</p>
                <p className="text-sm text-slate-500 mt-2">Or create a new formation or play from the catalog.</p>
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                  <Button size="sm" variant="default" onClick={() => handleNewPlay("offense", null, "Custom")}>
                    New Play
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleNewFormation("offense")}>
                    New Formation
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden rounded-r-lg border border-slate-200 bg-white shadow-sm">
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
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  )
}
