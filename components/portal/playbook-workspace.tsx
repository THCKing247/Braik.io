"use client"

import { useState, useEffect, useCallback } from "react"
import { Presentation } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlaybookTree } from "@/components/portal/playbook-tree"
import { PlaybookBuilder } from "@/components/portal/playbook-builder"
import { PlaybookInspector } from "@/components/portal/playbook-inspector"
import { PlaycallerView } from "@/components/portal/playcaller-view"
import { templateDataToCanvasData, canvasPlayersToTemplateData } from "@/lib/utils/playbook-canvas"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import type { FormationRecord, PlayRecord, SideOfBall } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"

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
  const [selectedPlayerInspector, setSelectedPlayerInspector] = useState<{ id: string; label: string; shape: string } | null>(null)
  const [selectedZoneInspector, setSelectedZoneInspector] = useState<{ id: string; type: string; size: string } | null>(null)

  const fetchFormations = useCallback(async () => {
    const res = await fetch(`/api/formations?teamId=${teamId}`)
    if (res.ok) {
      const data = await res.json()
      setFormations(data)
    }
  }, [teamId])

  const fetchPlays = useCallback(async () => {
    const res = await fetch(`/api/plays?teamId=${teamId}`)
    if (res.ok) {
      const data = await res.json()
      setPlays(data)
    }
  }, [teamId])

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([fetchFormations(), fetchPlays()]).finally(() => setLoading(false))
  }, [fetchFormations, fetchPlays])

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
    setSelectedFormationName(play.formation ?? "")
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

  const handleEditFormation = (formation: FormationRecord) => {
    setSelectedPlayId(null)
    setEditingFormation(formation)
    setSelectedSide(formation.side)
    setDesignerMode("formation")
  }

  const handleSavePlay = async (canvasData: PlayCanvasData, playName: string) => {
    const formation = selectedFormationName?.trim() || "Custom"
    try {
      if (selectedPlayId) {
        const res = await fetch(`/api/plays/${selectedPlayId}`, {
          method: "PATCH",
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
        const data = await (await fetch(`/api/plays?teamId=${teamId}`)).json()
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

  const handleSave = (canvasData: PlayCanvasData, name: string) => {
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
      const res = await fetch(`/api/plays/${playId}`, { method: "DELETE" })
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
  }

  const rawCanvasData =
    designerMode === "formation" && editingFormation
      ? templateDataToCanvasData(editingFormation.templateData, editingFormation.side)
      : designerMode === "play" && !selectedPlayId && selectedFormation
      ? templateDataToCanvasData(selectedFormation.templateData, selectedSide)
      : selectedPlay?.canvasData ?? null

  const initialCanvasDataForDesigner = rawCanvasData
    ? (() => {
        const coord = new FieldCoordinateSystem(800, 600, 15, 50)
        const playersWithPixels = rawCanvasData.players.map((p) => {
          const pixel = coord.yardToPixel(p.xYards, p.yYards)
          return { ...p, x: pixel.x, y: pixel.y }
        })
        return { ...rawCanvasData, players: playersWithPixels }
      })()
    : null

  const initialNameForDesigner =
    designerMode === "formation"
      ? editingFormation?.name ?? "New Formation"
      : selectedPlay?.name ?? ""

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading playbooks...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {playcallerMode ? (
        <PlaycallerView
          plays={plays}
          currentIndex={playcallerIndex}
          onClose={() => setPlaycallerMode(false)}
          onIndexChange={setPlaycallerIndex}
        />
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 flex-shrink-0 flex flex-col border-r border-border">
          <div className="p-2 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Playbook</span>
            {plays.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPlaycallerMode(true)
                  setPlaycallerIndex(selectedPlayId ? plays.findIndex((p) => p.id === selectedPlayId) || 0 : 0)
                }}
                title="Presentation / Playcaller mode"
              >
                <Presentation className="h-4 w-4 mr-1" />
                Present
              </Button>
            )}
          </div>
          <PlaybookTree
            formations={formations}
            plays={plays}
            selectedFormationId={selectedFormationId}
            selectedPlayId={selectedPlayId}
            onSelectFormation={handleSelectFormation}
            onSelectPlay={handleSelectPlay}
            onNewFormation={handleNewFormation}
            onNewPlay={handleNewPlay}
            onNewSubFormation={handleNewSubFormation}
            onRenameFormation={handleRenameFormation}
            onDeleteFormation={handleDeleteFormation}
            onRenamePlay={handleRenamePlay}
            onDuplicatePlay={handleDuplicatePlay}
            onDeletePlay={handleDeletePlay}
            onEditFormation={handleEditFormation}
            canEdit={canEdit}
            canEditOffense={canEditOffense}
            canEditDefense={canEditDefense}
            canEditSpecialTeams={canEditSpecialTeams}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
          {(designerMode === "play" || designerMode === "formation") && canEditSide(selectedSide) ? (
            <PlaybookBuilder
              playId={designerMode === "play" ? selectedPlayId : null}
              playData={initialCanvasDataForDesigner}
              playName={initialNameForDesigner}
              side={selectedSide}
              formation={designerMode === "formation" ? (editingFormation?.name ?? "New Formation") : (selectedFormationName || "Custom")}
              onSave={handleSave}
              onClose={handleCloseDesigner}
              canEdit={canEditSide(selectedSide)}
              isTemplateMode={designerMode === "formation"}
              templateName={editingFormation?.name ?? ""}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-sm">Select a play to edit, or create a new formation / play from the tree.</p>
                <p className="text-xs mt-2">Use &quot;New Formation&quot; to save a reusable alignment, then &quot;New play&quot; to draw from it.</p>
              </div>
            </div>
          )}
        </div>

        <PlaybookInspector
          play={selectedPlay ?? null}
          selectedObject={inspectorSelection}
          selectedPlayer={selectedPlayerInspector}
          selectedZone={selectedZoneInspector}
          onPlayNameChange={selectedPlay ? (name) => handleRenamePlay(selectedPlay.id, name) : undefined}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}
