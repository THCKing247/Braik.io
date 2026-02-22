"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Upload, BookOpen, Edit3, Trash2 } from "lucide-react"
import { PlaybookBuilder } from "@/components/playbook-builder"
import { PlaybookViewer } from "@/components/playbook-viewer"
import { PlaybookUploadForm } from "@/components/playbook-upload-form"
import { PlaybookFileTree } from "@/components/playbook-file-tree"

interface Playbook {
  id: string
  name: string
  type: "file" | "builder"
  createdAt: Date
  updatedAt: Date
  side?: "offense" | "defense" | "special_teams"
  fileUrl?: string
  canvasData?: any
}

interface PlaybooksLandingProps {
  teamId: string
  fileBasedPlaybooks: any[]
  builderPlays: any[]
  canUpload: boolean
  canEditAll: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
  userRole: string
}

export function PlaybooksLanding({
  teamId,
  fileBasedPlaybooks,
  builderPlays,
  canUpload,
  canEditAll,
  canEditOffense,
  canEditDefense,
  canEditSpecialTeams,
  userRole,
}: PlaybooksLandingProps) {
  const [viewMode, setViewMode] = useState<"list" | "builder" | "viewer">("list")
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)

  // Combine file-based and builder-created playbooks
  // For builder playbooks, we'll create one playbook per unique formation+side combination
  const builderPlaybooksMap = builderPlays.reduce((acc, play) => {
    const key = `${play.side}-${play.formation}`
    if (!acc[key]) {
      acc[key] = {
        id: `builder-${key}`,
        name: `${play.formation} (${play.side.charAt(0).toUpperCase() + play.side.slice(1)})`,
        type: "builder" as const,
        createdAt: play.createdAt,
        updatedAt: play.updatedAt,
        side: play.side,
        formation: play.formation,
        plays: [],
      }
    }
    acc[key].plays.push(play)
    // Use the most recent play's canvasData as the default
    if (new Date(play.updatedAt) > new Date(acc[key].updatedAt)) {
      acc[key].updatedAt = play.updatedAt
    }
    return acc
  }, {} as Record<string, any>)

  const allPlaybooks: Playbook[] = [
    ...fileBasedPlaybooks.map((pb) => ({
      id: pb.id,
      name: pb.title || pb.fileName,
      type: "file" as const,
      createdAt: pb.createdAt,
      updatedAt: pb.updatedAt,
      fileUrl: pb.fileUrl,
    })),
    ...Object.values(builderPlaybooksMap).map((data: any) => ({
      id: data.id,
      name: data.name,
      type: "builder" as const,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      side: data.side,
      formation: data.formation,
      plays: data.plays,
      // Use first play's canvasData as default view
      canvasData: data.plays[0]?.canvasData,
    })),
  ]

  const handleCreateNewPlaybook = () => {
    setIsCreatingNew(true)
    setSelectedPlaybook({
      id: "new",
      name: "",
      type: "builder",
      createdAt: new Date(),
      updatedAt: new Date(),
      side: "offense",
    })
    setViewMode("builder")
  }

  const handleOpenPlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook)
    if (playbook.type === "file") {
      setViewMode("viewer")
    } else {
      setViewMode("builder")
    }
  }

  const handleBackToList = () => {
    setViewMode("list")
    setSelectedPlaybook(null)
    setIsCreatingNew(false)
  }

  const handleSavePlaybook = async (canvasData: any, playName: string) => {
    if (!selectedPlaybook) return

    try {
      if (isCreatingNew) {
        // Creating a new playbook - save as a new play
        const response = await fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            side: selectedPlaybook.side || "offense",
            formation: playName,
            name: playName,
            canvasData,
          }),
        })
        if (response.ok) {
          window.location.reload()
        } else {
          alert("Failed to save playbook")
        }
      } else if (selectedPlaybook.type === "builder") {
        // Updating existing builder playbook - update the first play or create new
        const playbookPlays = (selectedPlaybook as any).plays || []
        if (playbookPlays.length > 0) {
          // Update the first play
          const response = await fetch(`/api/plays/${playbookPlays[0].id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: playName,
              canvasData,
            }),
          })
          if (response.ok) {
            window.location.reload()
          } else {
            alert("Failed to update playbook")
          }
        } else {
          // Create new play under this formation
          const response = await fetch("/api/plays", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId,
              side: selectedPlaybook.side || "offense",
              formation: selectedPlaybook.formation || playName,
              name: playName,
              canvasData,
            }),
          })
          if (response.ok) {
            window.location.reload()
          } else {
            alert("Failed to save playbook")
          }
        }
      }
    } catch (error) {
      alert("Error saving playbook")
    }
  }

  if (viewMode === "builder") {
    const playbookPlays = selectedPlaybook && (selectedPlaybook as any).plays
    const firstPlay = playbookPlays && playbookPlays.length > 0 ? playbookPlays[0] : null
    
    return (
      <PlaybookBuilder
        playId={isCreatingNew ? null : (firstPlay?.id || null)}
        playData={isCreatingNew ? null : (selectedPlaybook?.canvasData || firstPlay?.canvasData || null)}
        playName={isCreatingNew ? "" : (selectedPlaybook?.name || firstPlay?.name || "")}
        side={selectedPlaybook?.side || "offense"}
        formation={isCreatingNew ? "" : (selectedPlaybook?.formation || selectedPlaybook?.name || "")}
        onSave={handleSavePlaybook}
        onClose={handleBackToList}
        canEdit={canEditAll || canEditOffense || canEditDefense || canEditSpecialTeams}
        teamId={teamId}
        builderPlays={builderPlays}
        onSelectPlay={(playId) => {
          const play = builderPlays.find((p) => p.id === playId)
          if (play) {
            setSelectedPlaybook({
              ...selectedPlaybook!,
              canvasData: play.canvasData,
            })
            // Reload to show the selected play
            window.location.reload()
          }
        }}
        onNewPlay={(side, formation, subcategory) => {
          // Handle new play creation
        }}
        onNewFormation={(side, formationName) => {
          // Handle new formation creation
        }}
        onNewSubFormation={(side, formation, subFormationName) => {
          // Handle new sub-formation creation
        }}
        onDeletePlay={(playId) => {
          // Handle play deletion
        }}
        onRenamePlay={(playId, newName) => {
          // Handle play rename
        }}
        onRenameFormation={(side, oldFormation, newFormation) => {
          // Handle formation rename
        }}
        pendingFormations={[]}
        isTemplateMode={false}
      />
    )
  }

  if (viewMode === "viewer" && selectedPlaybook) {
    return (
      <PlaybookViewer
        teamId={teamId}
        playbookId={selectedPlaybook.id}
        onEdit={() => {
          setViewMode("builder")
        }}
        onBack={handleBackToList}
        canEdit={canEditAll || canEditOffense || canEditDefense || canEditSpecialTeams}
        canEditAll={canEditAll}
        canEditOffense={canEditOffense}
        canEditDefense={canEditDefense}
        canEditSpecialTeams={canEditSpecialTeams}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#0B2A5B" }}>
          Playbooks
        </h1>
        <div className="flex items-center gap-2">
          {canUpload && (
            <Button
              variant="outline"
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload File
            </Button>
          )}
          <Button
            onClick={handleCreateNewPlaybook}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Playbook
          </Button>
        </div>
      </div>

      {/* Upload Form */}
      {showUploadForm && canUpload && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload Playbook File</CardTitle>
          </CardHeader>
          <CardContent>
            <PlaybookUploadForm
              teamId={teamId}
              onUploadComplete={() => {
                setShowUploadForm(false)
                window.location.reload()
              }}
              onCancel={() => setShowUploadForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Playbooks Grid */}
      {allPlaybooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <BookOpen className="h-16 w-16 mb-4" style={{ color: "#9CA3AF" }} />
          <p className="text-gray-500 mb-4">No playbooks yet</p>
          <div className="flex gap-2">
            {canUpload && (
              <Button
                variant="outline"
                onClick={() => setShowUploadForm(true)}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Your First Playbook
              </Button>
            )}
            <Button
              onClick={handleCreateNewPlaybook}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Your First Playbook
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allPlaybooks.map((playbook) => (
            <Card
              key={playbook.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleOpenPlaybook(playbook)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" style={{ color: "#3B82F6" }} />
                    {playbook.name}
                  </CardTitle>
                  {playbook.type === "builder" && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      Builder
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Type: {playbook.type === "file" ? "File Upload" : "Custom Builder"}</p>
                  {playbook.side && (
                    <p>Side: {playbook.side.charAt(0).toUpperCase() + playbook.side.slice(1)}</p>
                  )}
                  <p>Updated: {new Date(playbook.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenPlaybook(playbook)
                    }}
                    className="flex items-center gap-1"
                  >
                    <Edit3 className="h-3 w-3" />
                    {playbook.type === "file" ? "View" : "Edit"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
