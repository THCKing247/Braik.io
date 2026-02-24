"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Edit3 } from "lucide-react"
import { PlaybookFileTree } from "@/components/playbook-file-tree"
import { PlaybookFieldSurface, FieldCoordinateSystem } from "@/components/playbook-field-surface"
import type { SideOfBall } from "@/types/playbook"

interface PlaybookViewerProps {
  teamId: string
  playbookId: string
  onEdit: () => void
  onBack: () => void
  canEdit: boolean
  canEditAll: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
}

interface Play {
  id: string
  side: string
  formation: string
  subcategory: string | null
  name: string
  canvasData: any
  createdAt: Date
  updatedAt: Date
}

export function PlaybookViewer({
  teamId,
  playbookId,
  onEdit,
  onBack,
  canEdit,
  canEditAll,
  canEditOffense,
  canEditDefense,
  canEditSpecialTeams,
}: PlaybookViewerProps) {
  const [plays, setPlays] = useState<Play[]>([])
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null)
  const [fieldDimensions, setFieldDimensions] = useState({ width: 800, height: 600 })
  const [coordSystem, setCoordSystem] = useState<FieldCoordinateSystem>(
    new FieldCoordinateSystem(800, 600, 15, 50)
  )

  useEffect(() => {
    fetchPlays()
  }, [teamId, playbookId])

  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById("viewer-canvas-container")
      if (container) {
        const width = container.clientWidth
        const height = container.clientHeight
        setFieldDimensions({ width, height })
        setCoordSystem(new FieldCoordinateSystem(width, height, 15, 50))
      }
    }
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  const fetchPlays = async () => {
    try {
      const response = await fetch(`/api/plays?teamId=${teamId}`)
      if (response.ok) {
        const data = await response.json()
        setPlays(data)
      }
    } catch (error) {
      console.error("Error fetching plays:", error)
    }
  }

  const selectedPlay = plays.find((p) => p.id === selectedPlayId)
  const playData = selectedPlay?.canvasData

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 flex-shrink-0" style={{ borderBottomColor: "#0B2A5B" }}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h2 className="text-xl font-semibold" style={{ color: "#0B2A5B" }}>
            {selectedPlay ? selectedPlay.name : "Select a play to view"}
          </h2>
        </div>
        {canEdit && (
          <Button onClick={onEdit} className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tree (view-only) */}
        <div className="w-64 border-r flex-shrink-0 overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
          <PlaybookFileTree
            plays={plays}
            selectedPlayId={selectedPlayId}
            onSelectPlay={setSelectedPlayId}
            onNewPlay={() => {}}
            onNewFormation={() => {}}
            onNewSubFormation={() => {}}
            onDeletePlay={() => {}}
            onRenamePlay={() => {}}
            onRenameFormation={() => {}}
            canEdit={false}
            pendingFormations={[]}
          />
        </div>

        {/* Center: Preview Canvas (view-only) */}
        <div
          id="viewer-canvas-container"
          className="flex-1 overflow-hidden"
          style={{ backgroundColor: "#2d5016" }}
        >
          {playData ? (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${fieldDimensions.width} ${fieldDimensions.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <PlaybookFieldSurface
                width={fieldDimensions.width}
                height={fieldDimensions.height}
                yardStart={15}
                yardEnd={50}
              />
              {/* Render play data (shapes, paths, zones) */}
              {/* TODO: Render players, routes, zones from playData */}
            </svg>
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              <p>Select a play from the tree to view</p>
            </div>
          )}
        </div>

        {/* Right: Metadata Panel */}
        <div className="w-64 border-l p-4 flex-shrink-0 overflow-y-auto" style={{ borderColor: "#E5E7EB" }}>
          {selectedPlay ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: "#0B2A5B" }}>
                  Play Information
                </h3>
                <div className="text-sm space-y-2">
                  <p>
                    <span className="font-medium">Name:</span> {selectedPlay.name}
                  </p>
                  <p>
                    <span className="font-medium">Formation:</span> {selectedPlay.formation}
                  </p>
                  {selectedPlay.subcategory && (
                    <p>
                      <span className="font-medium">Sub-Formation:</span> {selectedPlay.subcategory}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Side:</span> {selectedPlay.side}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <p>No play selected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
