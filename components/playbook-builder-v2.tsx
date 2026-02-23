"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Square, Move, Pencil, RotateCcw, Save, X, Circle, Users, Trash2, Undo2, Redo2 } from "lucide-react"
import { PlaybookFieldSurface, FieldCoordinateSystem } from "@/components/playbook-field-surface"
import { PlaybookFileTree } from "@/components/playbook-file-tree"
import { validateTemplateSave, isValidTemplateShape } from "@/lib/playbook-validation"
import type { BuilderMode, DraftTemplateSession, SideOfBall, Shape, ShapeKind } from "@/types/playbook"

interface PlaybookBuilderV2Props {
  teamId: string
  playbookId: string | null
  selectedNodeId: string | null
  builderMode: BuilderMode
  draftTemplate: DraftTemplateSession
  onStartDraftFormation: (side: SideOfBall) => void
  onStartDraftSubFormation: (parentFormationId: string, side: SideOfBall) => void
  onUpdateDraftName: (name: string) => void
  onClearDraft: () => void
  canEdit: boolean
  canEditAll: boolean
  canEditOffense: boolean
  canEditDefense: boolean
  canEditSpecialTeams: boolean
}

export function PlaybookBuilderV2({
  teamId,
  playbookId,
  selectedNodeId,
  builderMode,
  draftTemplate,
  onStartDraftFormation,
  onStartDraftSubFormation,
  onUpdateDraftName,
  onClearDraft,
  canEdit,
  canEditAll,
  canEditOffense,
  canEditDefense,
  canEditSpecialTeams,
}: PlaybookBuilderV2Props) {
  const [tool, setTool] = useState<"select" | "add" | "route" | "block" | "zone" | "man" | "erase">("select")
  const [shapes, setShapes] = useState<Shape[]>(draftTemplate.shapes || [])
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [history, setHistory] = useState<Shape[][]>([draftTemplate.shapes || []])
  const [historyIndex, setHistoryIndex] = useState(0)

  const canvasRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [coordSystem, setCoordSystem] = useState<FieldCoordinateSystem>(
    new FieldCoordinateSystem(800, 600, 15, 50)
  )
  const [fieldDimensions, setFieldDimensions] = useState({ width: 800, height: 600 })

  const isTemplateMode = builderMode === "TEMPLATE_EDIT"
  const currentSide = draftTemplate.side

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const container = containerRef.current
        const availableWidth = container.clientWidth
        const availableHeight = container.clientHeight
        const fieldAspectRatio = 53.33 / 35
        let width = availableWidth
        let height = availableHeight
        if (width / height > fieldAspectRatio) {
          width = height * fieldAspectRatio
        } else {
          height = width / fieldAspectRatio
        }
        setFieldDimensions({ width, height })
        setCoordSystem(new FieldCoordinateSystem(width, height, 15, 50))
      }
    }
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  useEffect(() => {
    setShapes(draftTemplate.shapes || [])
  }, [draftTemplate.shapes])

  const getCanvasPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0, xYards: 0, yYards: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const { xYards, yYards } = coordSystem.pixelToYard(x, y)
    const snappedY = snapEnabled ? coordSystem.snapY(yYards) : yYards
    const snappedX = snapEnabled ? coordSystem.snapX(xYards) : xYards
    const pixel = coordSystem.yardToPixel(snappedX, snappedY)
    return { x: pixel.x, y: pixel.y, xYards: snappedX, yYards: snappedY }
  }

  const getShapeKindForSide = (side: SideOfBall, isCenter: boolean = false): ShapeKind => {
    if (side === "offense") {
      return isCenter ? "CENTER_SQUARE" : "OFFENSE_CIRCLE"
    }
    if (side === "defense") {
      return "DEFENSE_TRIANGLE"
    }
    return "OFFENSE_CIRCLE" // Default for special teams
  }

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canEdit || builderMode === "VIEW_ONLY") return

    const point = getCanvasPoint(e)

    if (tool === "add" && isTemplateMode) {
      // Template mode: only allow side-specific shapes
      const isCenter = shapes.length === 0 // First shape is center for offense
      const shapeKind = getShapeKindForSide(currentSide, isCenter)
      
      if (!isValidTemplateShape(currentSide, shapeKind)) {
        alert(`Invalid shape for ${currentSide} template`)
        return
      }

      const newShape: Shape = {
        id: Date.now().toString(),
        kind: shapeKind,
        xYards: point.xYards,
        yYards: point.yYards,
        label: isCenter && currentSide === "offense" ? "C" : "X",
      }

      const newShapes = [...shapes, newShape]
      setShapes(newShapes)
      addToHistory(newShapes)
      onUpdateDraftName(draftTemplate.name) // Update draft with new shapes
    } else if (tool === "erase" && selectedShapeId) {
      const newShapes = shapes.filter((s) => s.id !== selectedShapeId)
      setShapes(newShapes)
      addToHistory(newShapes)
      setSelectedShapeId(null)
    }
  }

  const addToHistory = (newShapes: Shape[]) {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newShapes)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setShapes(history[newIndex])
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setShapes(history[newIndex])
    }
  }

  const handleClearCanvas = () => {
    if (confirm("Clear all shapes?")) {
      setShapes([])
      addToHistory([])
    }
  }

  const handleSaveTemplate = async () => {
    const validation = validateTemplateSave(currentSide, shapes)
    if (!validation.ok) {
      alert(validation.reason)
      return
    }

    if (!draftTemplate.name.trim()) {
      alert("Please enter a formation name")
      return
    }

    try {
      // TODO: Save template via API
      // For now, we'll save it as a play with a special marker
      const response = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          side: currentSide,
          formation: draftTemplate.name.trim(),
          subcategory: draftTemplate.kind === "SUBFORMATION" ? draftTemplate.parentFormationId : null,
          name: draftTemplate.name.trim() + " Template",
          canvasData: {
            players: shapes.map((s) => ({
              id: s.id,
              xYards: s.xYards,
              yYards: s.yYards,
              label: s.label,
              shape: s.kind === "CENTER_SQUARE" ? "square" : s.kind === "DEFENSE_TRIANGLE" ? "triangle" : "circle",
            })),
            zones: [],
            manCoverages: [],
            fieldType: "half",
            side: currentSide,
            isTemplate: true,
          },
        }),
      })

      if (response.ok) {
        onClearDraft()
        window.location.reload()
      } else {
        alert("Failed to save template")
      }
    } catch (error) {
      alert("Error saving template")
    }
  }

  const validation = isTemplateMode ? validateTemplateSave(currentSide, shapes) : { ok: true }
  const canSave = isTemplateMode ? validation.ok && draftTemplate.name.trim() : true
  const playerCount = shapes.length
  const expectedCount = 11
  const showWarning = isTemplateMode && playerCount !== expectedCount

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b-2 flex-shrink-0" style={{ borderBottomColor: "#0B2A5B" }}>
        <div className="flex items-center gap-4">
          {isTemplateMode && (
            <div className="flex items-center gap-2">
              <Input
                value={draftTemplate.name}
                onChange={(e) => onUpdateDraftName(e.target.value)}
                placeholder="Formation name..."
                className="w-48"
              />
              {showWarning && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "#DC2626" }}>
                  <Users className="h-4 w-4" />
                  <span>{playerCount} players (required: {expectedCount})</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              {isTemplateMode ? (
                <Button onClick={handleSaveTemplate} disabled={!canSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Formation
                </Button>
              ) : (
                <Button onClick={() => {}} disabled={!canSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              )}
              <Button variant="ghost" onClick={onClearDraft}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Tree */}
        <div className="w-64 border-r flex-shrink-0 overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
          <PlaybookFileTree
            plays={[]} // TODO: Load plays for this playbook
            selectedPlayId={selectedNodeId}
            onSelectPlay={() => {}}
            onNewPlay={() => {}}
            onNewFormation={(side) => onStartDraftFormation(side as SideOfBall)}
            onNewSubFormation={(side, formation) => onStartDraftSubFormation("", side as SideOfBall)}
            onDeletePlay={() => {}}
            onRenamePlay={() => {}}
            onRenameFormation={() => {}}
            canEdit={canEdit}
            pendingFormations={[]}
          />
        </div>

        {/* Center: Tool Palette (only in template/play edit modes) */}
        {canEdit && builderMode !== "VIEW_ONLY" && (
          <div className="w-16 border-r-2 p-2 flex flex-col gap-2 flex-shrink-0" style={{ borderRightColor: "#0B2A5B", backgroundColor: "#FFFFFF" }}>
            <Button
              variant={tool === "select" ? "default" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setTool("select")}
              title="Select/Move"
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              variant={tool === "add" ? "default" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setTool("add")}
              title="Add Player"
            >
              {currentSide === "defense" ? (
                <Square className="h-4 w-4 rotate-180" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </Button>
            
            {/* Drawing tools - only in PLAY_EDIT mode */}
            {!isTemplateMode && (
              <>
                {currentSide === "offense" && (
                  <>
                    <Button
                      variant={tool === "route" ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                      onClick={() => setTool("route")}
                      title="Draw Route"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={tool === "block" ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                      onClick={() => setTool("block")}
                      title="Blocking Line"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {currentSide === "defense" && (
                  <>
                    <Button
                      variant={tool === "zone" ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                      onClick={() => setTool("zone")}
                      title="Zone Coverage"
                    >
                      <Circle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={tool === "man" ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                      onClick={() => setTool("man")}
                      title="Man Coverage"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </>
            )}

            <div className="border-t my-2" style={{ borderTopColor: "#0B2A5B" }} />
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleUndo}
              disabled={historyIndex === 0}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleClearCanvas}
              title="Clear Canvas"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden"
          style={{ backgroundColor: "#2d5016" }}
        >
          <svg
            ref={canvasRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${fieldDimensions.width} ${fieldDimensions.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              cursor: tool === "add" || tool === "erase" ? "crosshair" : tool === "select" ? "move" : "default",
            }}
            onClick={handleCanvasClick}
          >
            <PlaybookFieldSurface
              width={fieldDimensions.width}
              height={fieldDimensions.height}
              yardStart={15}
              yardEnd={50}
            />

            {/* Render shapes */}
            {shapes.map((shape) => {
              const pixel = coordSystem.yardToPixel(shape.xYards, shape.yYards)
              const markerSize = coordSystem.getMarkerSize()
              const isSelected = selectedShapeId === shape.id
              const shapeColor = currentSide === "defense" ? "#DC2626" : "#3B82F6"

              return (
                <g key={shape.id}>
                  {shape.kind === "OFFENSE_CIRCLE" || shape.kind === "SPECIAL_TEAMS_CIRCLE" ? (
                    <circle
                      cx={pixel.x}
                      cy={pixel.y}
                      r={markerSize / 2}
                      fill={shapeColor}
                      stroke={isSelected ? "#0B2A5B" : "white"}
                      strokeWidth={isSelected ? 3 : 2}
                      style={{ cursor: canEdit ? "pointer" : "default" }}
                      onClick={() => {
                        if (tool === "select" || tool === "erase") {
                          setSelectedShapeId(shape.id)
                        }
                      }}
                    />
                  ) : shape.kind === "CENTER_SQUARE" || shape.kind === "SPECIAL_TEAMS_SQUARE" ? (
                    <rect
                      x={pixel.x - markerSize / 2}
                      y={pixel.y - markerSize / 2}
                      width={markerSize}
                      height={markerSize}
                      fill={shapeColor}
                      stroke={isSelected ? "#0B2A5B" : "white"}
                      strokeWidth={isSelected ? 3 : 2}
                      style={{ cursor: canEdit ? "pointer" : "default" }}
                      onClick={() => {
                        if (tool === "select" || tool === "erase") {
                          setSelectedShapeId(shape.id)
                        }
                      }}
                    />
                  ) : shape.kind === "DEFENSE_TRIANGLE" ? (
                    <polygon
                      points={`${pixel.x},${pixel.y - markerSize / 2} ${pixel.x - markerSize / 2},${pixel.y + markerSize / 2} ${pixel.x + markerSize / 2},${pixel.y + markerSize / 2}`}
                      fill={shapeColor}
                      stroke={isSelected ? "#0B2A5B" : "white"}
                      strokeWidth={isSelected ? 3 : 2}
                      style={{ cursor: canEdit ? "pointer" : "default" }}
                      onClick={() => {
                        if (tool === "select" || tool === "erase") {
                          setSelectedShapeId(shape.id)
                        }
                      }}
                    />
                  ) : null}
                  <text
                    x={pixel.x}
                    y={pixel.y + markerSize / 2 + 12}
                    textAnchor="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                    style={{ pointerEvents: "none" }}
                  >
                    {shape.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
