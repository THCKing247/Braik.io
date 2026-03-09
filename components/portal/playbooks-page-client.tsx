"use client"

import { useState, useEffect } from "react"
import { PlaybooksManager } from "@/components/portal/playbooks-manager"
import { PlaybookFileTree } from "@/components/portal/playbook-file-tree"
import { PlaybookBuilder } from "@/components/portal/playbook-builder"

interface Play {
  id: string
  teamId: string
  playbookId: string | null
  side: string
  formation: string
  subcategory: string | null
  name: string
  canvasData: any
  createdAt: string
  updatedAt: string
}

interface PlaybooksPageClientProps {
  teamId: string
  fileBasedPlaybooks: any[]
  builderPlays?: Play[]
  canUpload: boolean
  canEditAll: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
  userRole: string
}

export function PlaybooksPageClient({
  teamId,
  fileBasedPlaybooks,
  builderPlays: initialBuilderPlays = [],
  canUpload,
  canEditAll,
  canEditOffense,
  canEditDefense,
  canEditSpecialTeams,
  userRole,
}: PlaybooksPageClientProps) {
  const [viewMode, setViewMode] = useState<"files" | "builder">("builder")
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null)
  const [selectedFormation, setSelectedFormation] = useState<string>("")
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [selectedSide, setSelectedSide] = useState<"offense" | "defense" | "special_teams">("offense")
  const [pendingFormations, setPendingFormations] = useState<Array<{ side: string; formation: string }>>([])
  const [builderPlays, setBuilderPlays] = useState<Play[]>(initialBuilderPlays)
  const [loading, setLoading] = useState(initialBuilderPlays.length === 0)

  // Load plays if not provided
  useEffect(() => {
    if (initialBuilderPlays.length === 0) {
      loadPlays()
    }
  }, [teamId])

  const loadPlays = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/plays?teamId=${teamId}`)
      if (response.ok) {
        const plays = await response.json()
        // Convert API response to Play format
        const formattedPlays: Play[] = plays.map((p: any) => ({
          id: p.id,
          teamId: p.teamId,
          playbookId: p.playbookId,
          side: p.side,
          formation: p.formation,
          subcategory: p.subcategory,
          name: p.name,
          canvasData: p.canvasData,
          createdAt: typeof p.createdAt === 'string' ? p.createdAt : p.createdAt,
          updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : p.updatedAt,
        }))
        setBuilderPlays(formattedPlays)
      }
    } catch (error) {
      console.error("Error loading plays:", error)
    } finally {
      setLoading(false)
    }
  }

  const selectedPlay = builderPlays.find((p) => p.id === selectedPlayId)

  const handleSelectPlay = (playId: string) => {
    const play = builderPlays.find((p) => p.id === playId)
    if (play) {
      setSelectedPlayId(playId)
      setSelectedFormation(play.formation)
      setSelectedSubcategory(play.subcategory)
      setSelectedSide(play.side as "offense" | "defense" | "special_teams")
      setViewMode("builder")
    }
  }

  const handleNewPlay = (side: string, formation: string, subcategory?: string | null) => {
    if (!formation.trim()) {
      alert("Please enter a formation name")
      return
    }
    setSelectedPlayId(null)
    setSelectedFormation(formation)
    setSelectedSubcategory(subcategory || null)
    setSelectedSide(side as "offense" | "defense" | "special_teams")
    setViewMode("builder")
  }

  const handleNewSubFormation = (side: string, formation: string, subFormationName: string) => {
    // Sub-formation is created when first play is saved under it
    setSelectedPlayId(null)
    setSelectedFormation(formation)
    setSelectedSubcategory(subFormationName)
    setSelectedSide(side as "offense" | "defense" | "special_teams")
    setViewMode("builder")
  }

  const handleNewFormation = (side: string, formationName: string) => {
    // Add formation to pending list so it appears in tree immediately
    setPendingFormations((prev) => {
      const exists = prev.some((f) => f.side === side && f.formation === formationName)
      if (!exists) {
        return [...prev, { side, formation: formationName }]
      }
      return prev
    })
    setSelectedPlayId(null)
    setSelectedFormation(formationName)
    setSelectedSubcategory(null)
    setSelectedSide(side as "offense" | "defense" | "special_teams")
    setViewMode("builder")
  }

  const handleRenameFormation = async (side: string, oldFormation: string, newFormation: string) => {
    // Update all plays in this formation
    const playsToUpdate = builderPlays.filter(
      (p) => p.side === side && p.formation === oldFormation
    )

    try {
      await Promise.all(
        playsToUpdate.map((play) =>
          fetch(`/api/plays/${play.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ formation: newFormation }),
          })
        )
      )
      // Update pending formations if needed
      setPendingFormations((prev) => 
        prev.map((f) => f.side === side && f.formation === oldFormation 
          ? { ...f, formation: newFormation }
          : f
        )
      )
      await loadPlays() // Reload plays instead of full page reload
    } catch (error) {
      alert("Error renaming formation")
    }
  }

  const handleSavePlay = async (canvasData: any, playName: string) => {
    if (!selectedFormation.trim()) {
      alert("Please select or create a formation first")
      return
    }

    try {
      const url = selectedPlayId ? `/api/plays/${selectedPlayId}` : "/api/plays"
      const method = selectedPlayId ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          side: selectedSide,
          formation: selectedFormation.trim(),
          subcategory: selectedSubcategory || null,
          name: playName,
          canvasData,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save play")
      }

      // Remove formation from pending once play is saved
      setPendingFormations((prev) => 
        prev.filter((f) => !(f.side === selectedSide && f.formation === selectedFormation))
      )
      await loadPlays() // Reload plays instead of full page reload
    } catch (error) {
      alert("Error saving play")
    }
  }

  const handleDeletePlay = async (playId: string) => {
    try {
      const response = await fetch(`/api/plays/${playId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete play")
      }

      await loadPlays() // Reload plays instead of full page reload
    } catch (error) {
      alert("Error deleting play")
    }
  }

  const handleRenamePlay = async (playId: string, newName: string) => {
    try {
      const response = await fetch(`/api/plays/${playId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      })

      if (!response.ok) {
        throw new Error("Failed to rename play")
      }

      await loadPlays() // Reload plays instead of full page reload
    } catch (error) {
      alert("Error renaming play")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div>Loading plays...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Tree */}
        <div className="w-64 border-r flex-shrink-0 overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
          <PlaybookFileTree
            plays={builderPlays.map(p => ({
              id: p.id,
              side: p.side,
              formation: p.formation,
              subcategory: p.subcategory,
              name: p.name,
              createdAt: typeof p.createdAt === 'string' ? new Date(p.createdAt) : p.createdAt as any,
            }))}
            selectedPlayId={selectedPlayId}
            onSelectPlay={handleSelectPlay}
            onNewPlay={handleNewPlay}
            onNewFormation={handleNewFormation}
            onNewSubFormation={handleNewSubFormation}
            onDeletePlay={handleDeletePlay}
            onRenamePlay={handleRenamePlay}
            onRenameFormation={handleRenameFormation}
            canEdit={canEditAll || canEditOffense || canEditDefense || canEditSpecialTeams}
            pendingFormations={pendingFormations}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {viewMode === "files" ? (
            <PlaybooksManager
              teamId={teamId}
              playbooks={fileBasedPlaybooks}
              canUpload={canUpload}
              userRole={userRole}
            />
          ) : (
            <PlaybookBuilder
              playId={selectedPlayId}
              playData={selectedPlay?.canvasData}
              playName={selectedPlay?.name || ""}
              side={selectedSide}
              formation={selectedFormation}
              onSave={handleSavePlay}
              onClose={() => setViewMode("files")}
              canEdit={canEditAll || canEditOffense || canEditDefense || canEditSpecialTeams}
            />
          )}
        </div>
      </div>
    </div>
  )
}
