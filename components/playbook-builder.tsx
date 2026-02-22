"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Square, Move, Pencil, RotateCcw, Save, X, Circle, Maximize2, Minimize2, Users } from "lucide-react"
import { PlaybookFieldSurface, FieldCoordinateSystem } from "@/components/playbook-field-surface"
import { PlaybookFileTree } from "@/components/playbook-file-tree"
import { PlaybookShapePalette } from "@/components/playbook-shape-palette"
import { validateTemplateSave } from "@/lib/playbook-validation"

interface Player {
  id: string
  x: number // pixel X (for rendering)
  y: number // pixel Y (for rendering)
  xYards?: number // yard X coordinate (0 to 53.33) - preferred
  yYards?: number // yard Y coordinate (0 to 35) - preferred
  label: string
  shape: "circle" | "square" | "triangle"
  playerType?: "skill" | "lineman"
  route?: Array<{ x: number; y: number; t: number } | { xYards: number; yYards: number; t: number }>
  blockingLine?: { x: number; y: number } | { xYards: number; yYards: number }
  technique?: string
  gap?: string
}

interface Zone {
  id: string
  x: number
  y: number
  xYards?: number
  yYards?: number
  size: "small" | "large"
  type: "hook" | "spot" | "deep"
}

interface ManCoverage {
  id: string
  defenderId: string
  receiverId: string
}

interface CanvasData {
  players: Player[]
  zones: Zone[]
  manCoverages: ManCoverage[]
  fieldType: "half" | "full"
  side: "offense" | "defense" | "special_teams"
}

interface PlaybookBuilderProps {
  playId: string | null
  playData: CanvasData | null
  playName?: string
  side: "offense" | "defense" | "special_teams"
  formation: string
  onSave: (data: CanvasData, playName: string) => void
  onClose: () => void
  canEdit: boolean
  teamId?: string
  builderPlays?: any[]
  onSelectPlay?: (playId: string) => void
  onNewPlay?: (side: string, formation: string, subcategory?: string | null) => void
  onNewFormation?: (side: string, formationName: string) => void
  onNewSubFormation?: (side: string, formation: string, subFormationName: string) => void
  onDeletePlay?: (playId: string) => void
  onRenamePlay?: (playId: string, newName: string) => void
  onRenameFormation?: (side: string, oldFormation: string, newFormation: string) => void
  pendingFormations?: Array<{ side: string; formation: string }>
  isTemplateMode?: boolean
  templateName?: string
}

export function PlaybookBuilder({
  playId,
  playData,
  playName: initialPlayName,
  side,
  formation,
  onSave,
  onClose,
  canEdit,
  teamId,
  builderPlays = [],
  onSelectPlay,
  onNewPlay,
  onNewFormation,
  onNewSubFormation,
  onDeletePlay,
  onRenamePlay,
  onRenameFormation,
  pendingFormations = [],
  isTemplateMode = false,
  templateName = "",
}: PlaybookBuilderProps) {
  const [tool, setTool] = useState<"select" | "circle" | "square" | "triangle" | "route" | "block" | "zone" | "man" | "erase">("select")
  const [currentSide, setCurrentSide] = useState(side)
  const [playName, setPlayName] = useState(initialPlayName || "")
  const [templateNameState, setTemplateNameState] = useState(templateName || formation || "")
  const [players, setPlayers] = useState<Player[]>(playData?.players || [])
  const [zones, setZones] = useState<Zone[]>(playData?.zones || [])
  const [manCoverages, setManCoverages] = useState<ManCoverage[]>(playData?.manCoverages || [])
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationMode, setAnimationMode] = useState<"all" | "skill" | "linemen">("all")
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [drawingRoute, setDrawingRoute] = useState<Array<{ x: number; y: number }>>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [manCoverageStart, setManCoverageStart] = useState<string | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState("")

  const canvasRef = useRef<SVGSVGElement>(null)
  const animationRef = useRef<number>()
  const containerRef = useRef<HTMLDivElement>(null)

  // Field dimensions
  const FIELD_WIDTH_YARDS = 53.33
  const VISIBLE_YARDS = 35 // 15-yard line to 50-yard line
  const yardLineStart = 15
  const yardLineEnd = 50

  // Coordinate system instance (will be updated when SVG size changes)
  const [coordSystem, setCoordSystem] = useState<FieldCoordinateSystem>(
    new FieldCoordinateSystem(800, 600, yardLineStart, yardLineEnd)
  )
  const [fieldDimensions, setFieldDimensions] = useState({ width: 800, height: 600 })

  // Update coordinate system and field dimensions when container size changes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const container = containerRef.current
        // Use 100% of container - field fills entire area, no padding
        const availableWidth = container.clientWidth
        const availableHeight = container.clientHeight

        // Calculate aspect ratio (53.33 yards wide : 35 yards tall)
        const fieldAspectRatio = FIELD_WIDTH_YARDS / VISIBLE_YARDS

        let width = availableWidth
        let height = availableHeight

        // Fill container while maintaining aspect ratio
        if (width / height > fieldAspectRatio) {
          width = height * fieldAspectRatio
        } else {
          height = width / fieldAspectRatio
        }

        setFieldDimensions({ width, height })
        setCoordSystem(new FieldCoordinateSystem(width, height, yardLineStart, yardLineEnd))
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // Handle ALT key for snapping toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setSnapEnabled(false)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setSnapEnabled(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  useEffect(() => {
    if (playData) {
      // Convert legacy pixel coordinates to yard coordinates if needed
      const convertedPlayers = playData.players.map((p) => {
        if (p.xYards !== undefined && p.yYards !== undefined) {
          // Already has yard coordinates, convert to pixels for rendering
          const pixel = coordSystem.yardToPixel(p.xYards, p.yYards)
          return { ...p, x: pixel.x, y: pixel.y }
        } else {
          // Legacy pixel coordinates, convert to yards
          const yards = coordSystem.pixelToYard(p.x, p.y)
          const pixel = coordSystem.yardToPixel(yards.xYards, yards.yYards)
          return { ...p, x: pixel.x, y: pixel.y, xYards: yards.xYards, yYards: yards.yYards }
        }
      })
      setPlayers(convertedPlayers)
      setZones(playData.zones || [])
      setManCoverages(playData.manCoverages || [])
      setCurrentSide(playData.side || side)
    }
    if (initialPlayName) {
      setPlayName(initialPlayName)
    }
  }, [playData, side, initialPlayName, coordSystem])

  const getCanvasPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0, xYards: 0, yYards: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    const svg = canvasRef.current
    
    // Get the SVG viewBox dimensions
    const viewBox = svg.viewBox.baseVal
    const viewBoxWidth = viewBox.width || fieldDimensions.width
    const viewBoxHeight = viewBox.height || fieldDimensions.height
    
    // Calculate the scale factor (actual rendered size vs viewBox)
    const scaleX = rect.width / viewBoxWidth
    const scaleY = rect.height / viewBoxHeight
    
    // Get mouse position relative to SVG element
    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top
    
    // Convert to viewBox coordinates (accounting for preserveAspectRatio)
    // If preserveAspectRatio is "xMidYMid meet", the SVG is centered
    const actualWidth = rect.width
    const actualHeight = rect.height
    const aspectRatio = viewBoxWidth / viewBoxHeight
    const containerAspectRatio = actualWidth / actualHeight
    
    let x, y
    if (containerAspectRatio > aspectRatio) {
      // Container is wider - letterboxing on sides
      const scaledHeight = actualHeight
      const scaledWidth = scaledHeight * aspectRatio
      const offsetX = (actualWidth - scaledWidth) / 2
      x = (clientX - offsetX) / scaleX
      y = clientY / scaleY
    } else {
      // Container is taller - letterboxing on top/bottom
      const scaledWidth = actualWidth
      const scaledHeight = scaledWidth / aspectRatio
      const offsetY = (actualHeight - scaledHeight) / 2
      x = clientX / scaleX
      y = (clientY - offsetY) / scaleY
    }
    
    // Clamp to viewBox bounds
    x = Math.max(0, Math.min(viewBoxWidth, x))
    y = Math.max(0, Math.min(viewBoxHeight, y))

    // Convert to yard coordinates
    const { xYards, yYards } = coordSystem.pixelToYard(x, y)

    // Apply snapping if enabled
    const snappedY = snapEnabled ? coordSystem.snapY(yYards) : yYards
    const snappedX = snapEnabled ? coordSystem.snapX(xYards) : xYards

    // Convert back to pixels for rendering
    const pixel = coordSystem.yardToPixel(snappedX, snappedY)

    return {
      x: pixel.x,
      y: pixel.y,
      xYards: snappedX,
      yYards: snappedY,
    }
  }

  const getPlayerShape = (side: string, label: string): "circle" | "square" | "triangle" => {
    if (side === "defense") return "triangle"
    if (label.toUpperCase() === "C" || label.toUpperCase().includes("CENTER")) return "square"
    return "circle"
  }

  const getPlayerType = (label: string, side: string): "skill" | "lineman" => {
    if (side === "defense") {
      if (label.toUpperCase().match(/DE|DT|NT|3T|5T|9T|1T/)) return "lineman"
      return "skill"
    }
    if (label.toUpperCase().match(/C|G|T|LT|RT|LG|RG/)) return "lineman"
    return "skill"
  }

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canEdit) return

    const point = getCanvasPoint(e)

    if (tool === "circle" || tool === "square" || tool === "triangle") {
      // In template mode, only allow shapes for current side
      if (isTemplateMode) {
        if (currentSide === "offense" && tool !== "circle" && tool !== "square") return
        if (currentSide === "defense" && tool !== "triangle") return
      }
      
      const shape = tool === "circle" ? "circle" : tool === "square" ? "square" : "triangle"
      const playerType = getPlayerType("X", currentSide)
      const label = tool === "square" && currentSide === "offense" ? "C" : "X"
      
      const newPlayer: Player = {
        id: Date.now().toString(),
        x: point.x,
        y: point.y,
        xYards: point.xYards,
        yYards: point.yYards,
        label,
        shape,
        playerType,
      }
      setPlayers([...players, newPlayer])
    } else if (tool === "erase") {
      // Find player at click point
      const clickedPlayer = players.find(
        (p) => Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < coordSystem.getMarkerSize()
      )
      if (clickedPlayer) {
        setPlayers(players.filter((p) => p.id !== clickedPlayer.id))
      }
    } else if (tool === "route" && selectedPlayerId) {
      const player = players.find((p) => p.id === selectedPlayerId)
      if (player) {
        if (!isDrawing) {
          setIsDrawing(true)
          setDrawingRoute([{ x: player.x, y: player.y }, point])
        } else {
          setDrawingRoute([...drawingRoute, point])
        }
      }
    } else if (tool === "block" && selectedPlayerId) {
      const player = players.find((p) => p.id === selectedPlayerId)
      if (player) {
        setPlayers(
          players.map((p) =>
            p.id === selectedPlayerId
              ? {
                  ...p,
                  blockingLine: { x: point.x, y: point.y, xYards: point.xYards, yYards: point.yYards },
                }
              : p
          )
        )
      }
    } else if (tool === "zone") {
      const newZone: Zone = {
        id: Date.now().toString(),
        x: point.x,
        y: point.y,
        xYards: point.xYards,
        yYards: point.yYards,
        size: "small",
        type: "hook",
      }
      setZones([...zones, newZone])
    } else if (tool === "man" && currentSide === "defense") {
      if (!manCoverageStart) {
        const clickedPlayer = players.find(
          (p) => Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < coordSystem.getMarkerSize()
        )
        if (clickedPlayer) {
          setManCoverageStart(clickedPlayer.id)
        }
      } else {
        const clickedPlayer = players.find(
          (p) => Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < coordSystem.getMarkerSize()
        )
        if (clickedPlayer && clickedPlayer.id !== manCoverageStart) {
          setManCoverages([
            ...manCoverages,
            {
              id: Date.now().toString(),
              defenderId: manCoverageStart,
              receiverId: clickedPlayer.id,
            },
          ])
          setManCoverageStart(null)
        }
      }
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canEdit || !isDrawing || !selectedPlayerId || tool !== "route") return
    const point = getCanvasPoint(e)
    setDrawingRoute([...drawingRoute, point])
  }

  const finishDrawing = (finalize: boolean = false) => {
    if (selectedPlayerId && drawingRoute.length > 0 && tool === "route") {
      if (finalize || drawingRoute.length > 1) {
        setPlayers(
          players.map((p) =>
            p.id === selectedPlayerId
              ? {
                  ...p,
                  route: drawingRoute.map((pt, i) => ({
                    ...pt,
                    t: i / (drawingRoute.length - 1 || 1),
                  })),
                }
              : p
          )
        )
        setDrawingRoute([])
        setIsDrawing(false)
        setSelectedPlayerId(null)
      }
    }
  }

  const handleCanvasDoubleClick = () => {
    if (tool === "route" && isDrawing) {
      finishDrawing(true)
    }
  }

  const handlePlayerDrag = (playerId: string, e: React.MouseEvent) => {
    if (!canEdit || tool !== "select") return
    e.preventDefault()
    const startPoint = getCanvasPoint(e)
    const player = players.find((p) => p.id === playerId)
    if (!player) return

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const x = moveEvent.clientX - rect.left
      const y = moveEvent.clientY - rect.top

      const { xYards, yYards } = coordSystem.pixelToYard(x, y)
      const snappedY = snapEnabled ? coordSystem.snapY(yYards) : yYards
      const snappedX = snapEnabled ? coordSystem.snapX(xYards) : xYards
      const pixel = coordSystem.yardToPixel(snappedX, snappedY)

      setPlayers(
        players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                x: Math.max(0, Math.min(fieldDimensions.width, pixel.x)),
                y: Math.max(0, Math.min(fieldDimensions.height, pixel.y)),
                xYards: snappedX,
                yYards: snappedY,
              }
            : p
        )
      )
    }

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  const animatePlay = () => {
    if (isAnimating) {
      setIsAnimating(false)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (playData) {
        setPlayers(playData.players || players)
      }
      return
    }

    setIsAnimating(true)
    const startTime = Date.now()
    const duration = 3000
    const originalPositions = players.map((p) => ({ id: p.id, x: p.x, y: p.y }))

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      setPlayers(
        players.map((player) => {
          if (animationMode === "skill" && player.playerType !== "skill") {
            return player
          }
          if (animationMode === "linemen" && player.playerType !== "lineman") {
            return player
          }

          if (!player.route || player.route.length === 0) {
            return player
          }

          const pathTime = progress
          let segmentIndex = 0
          for (let i = 0; i < player.route.length - 1; i++) {
            const routePoint = player.route[i] as { x: number; y: number; t: number }
            const nextRoutePoint = player.route[i + 1] as { x: number; y: number; t: number }
            if (pathTime >= routePoint.t && pathTime <= nextRoutePoint.t) {
              segmentIndex = i
              break
            }
          }

          const segment = player.route[segmentIndex] as { x: number; y: number; t: number }
          const nextSegment = (player.route[segmentIndex + 1] || segment) as { x: number; y: number; t: number }
          const segmentProgress =
            segment.t === nextSegment.t
              ? 0
              : (pathTime - segment.t) / (nextSegment.t - segment.t)

          return {
            ...player,
            x: segment.x + (nextSegment.x - segment.x) * segmentProgress,
            y: segment.y + (nextSegment.y - segment.y) * segmentProgress,
          }
        })
      )

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
        setPlayers(
          players.map((p) => {
            const original = originalPositions.find((op) => op.id === p.id)
            return original ? { ...p, x: original.x, y: original.y } : p
          })
        )
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  const resetPlay = () => {
    if (playData) {
      setPlayers(playData.players || [])
      setZones(playData.zones || [])
      setManCoverages(playData.manCoverages || [])
    } else {
      setPlayers([])
      setZones([])
      setManCoverages([])
    }
    setDrawingRoute([])
    setIsAnimating(false)
  }

  const handleSave = () => {
    // Template mode: validate 11 players required
    if (isTemplateMode) {
      if (players.length !== 11) {
        alert(`Template requires exactly 11 players. Currently have ${players.length}.`)
        return
      }
      if (!templateNameState.trim()) {
        alert("Please enter a formation name")
        return
      }
    } else {
      if (!playName.trim()) {
        alert("Please enter a play name")
        return
      }
    }

    // Convert players to yard coordinates for saving
    const playersWithYards = players.map((p) => {
      if (p.xYards !== undefined && p.yYards !== undefined) {
        return p
      } else {
        const yards = coordSystem.pixelToYard(p.x, p.y)
        return { ...p, xYards: yards.xYards, yYards: yards.yYards }
      }
    })

    const canvasData: CanvasData = {
      players: playersWithYards,
      zones: isTemplateMode ? [] : zones, // Templates cannot have zones
      manCoverages: isTemplateMode ? [] : manCoverages, // Templates cannot have man coverage
      fieldType: "half",
      side: currentSide,
    }
    
    if (isTemplateMode) {
      onSave(canvasData, templateNameState.trim())
    } else {
      onSave(canvasData, playName.trim())
    }
  }

  const playerCount = players.length
  const expectedCount = 11
  const showPlayerCountWarning = playerCount !== expectedCount
  const markerSize = coordSystem.getMarkerSize()

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b-2 flex-shrink-0" style={{ borderBottomColor: "#0B2A5B" }}>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant={currentSide === "offense" ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentSide("offense")}
              disabled={!canEdit}
            >
              Offense
            </Button>
            <Button
              variant={currentSide === "defense" ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentSide("defense")}
              disabled={!canEdit}
            >
              Defense
            </Button>
            <Button
              variant={currentSide === "special_teams" ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentSide("special_teams")}
              disabled={!canEdit}
            >
              Special Teams
            </Button>
          </div>
          {(showPlayerCountWarning || (isTemplateMode && playerCount !== 11)) && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "#DC2626" }}>
              <Users className="h-4 w-4" />
              <span>
                {isTemplateMode 
                  ? `${playerCount} players (required: 11)` 
                  : `${playerCount} players on field (expected ${expectedCount})`}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isTemplateMode ? (
            <Input
              value={templateNameState}
              onChange={(e) => setTemplateNameState(e.target.value)}
              placeholder="Formation name..."
              className="w-48"
              disabled={!canEdit}
            />
          ) : (
            <Input
              value={playName}
              onChange={(e) => setPlayName(e.target.value)}
              placeholder="Play name..."
              className="w-48"
              disabled={!canEdit}
            />
          )}
          {canEdit && (
            <Button 
              onClick={handleSave} 
              disabled={isTemplateMode ? (!templateNameState.trim() || players.length !== 11) : !playName.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              {isTemplateMode ? "Save Formation" : "Save"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Tree */}
        {teamId && (
          <div className="w-64 border-r flex-shrink-0 overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
            <PlaybookFileTree
              plays={builderPlays || []}
              selectedPlayId={playId}
              onSelectPlay={onSelectPlay || (() => {})}
              onNewPlay={onNewPlay || (() => {})}
              onNewFormation={onNewFormation || (() => {})}
              onNewSubFormation={onNewSubFormation || (() => {})}
              onDeletePlay={onDeletePlay || (() => {})}
              onRenamePlay={onRenamePlay || (() => {})}
              onRenameFormation={onRenameFormation || (() => {})}
              canEdit={canEdit}
              pendingFormations={pendingFormations || []}
            />
          </div>
        )}

        {/* Shape Palette */}
        {canEdit && (
          <PlaybookShapePalette
            currentSide={currentSide}
            selectedTool={tool}
            onSelectTool={(newTool) => {
              setTool(newTool as any)
              if (newTool === "select") {
                setSelectedPlayerId(null)
              } else if (newTool === "route") {
                setDrawingRoute([])
              } else if (newTool === "man") {
                setManCoverageStart(null)
              }
            }}
            isTemplateMode={isTemplateMode}
            canEdit={canEdit}
          />
        )}

        {/* Canvas - fills entire area, no padding */}
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
              cursor: tool === "circle" || tool === "square" || tool === "triangle" || tool === "route" || tool === "block" || tool === "zone" || tool === "erase" ? "crosshair" : tool === "select" ? "move" : "default",
            }}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onDoubleClick={handleCanvasDoubleClick}
            onMouseLeave={() => {
              if (drawingRoute.length > 2) {
                finishDrawing(true)
              }
            }}
          >
            {/* Field surface */}
            <PlaybookFieldSurface
              width={fieldDimensions.width}
              height={fieldDimensions.height}
              yardStart={yardLineStart}
              yardEnd={yardLineEnd}
            />

            {/* Drawing route (preview) */}
            {drawingRoute.length > 1 && (
              <polyline
                points={drawingRoute.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                strokeDasharray="5,5"
              />
            )}

            {/* Zones (defense) */}
            {zones.map((zone) => {
              const radius = zone.size === "large" ? markerSize * 1.5 : markerSize * 0.75
              return (
                <g key={zone.id}>
                  <circle
                    cx={zone.x}
                    cy={zone.y}
                    r={radius}
                    fill="rgba(59,130,246,0.2)"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    style={{ cursor: canEdit ? "pointer" : "default" }}
                    onClick={() => {
                      if (canEdit && tool === "select") {
                        setSelectedZoneId(zone.id)
                      }
                    }}
                  />
                  <text
                    x={zone.x}
                    y={zone.y + 5}
                    textAnchor="middle"
                    fill="#3B82F6"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {zone.type}
                  </text>
                </g>
              )
            })}

            {/* Man coverage lines */}
            {manCoverages.map((coverage) => {
              const defender = players.find((p) => p.id === coverage.defenderId)
              const receiver = players.find((p) => p.id === coverage.receiverId)
              if (!defender || !receiver) return null

              return (
                <line
                  key={coverage.id}
                  x1={defender.x}
                  y1={defender.y}
                  x2={receiver.x}
                  y2={receiver.y}
                  stroke="#DC2626"
                  strokeWidth="2"
                  strokeDasharray="3,3"
                />
              )
            })}

            {/* Players */}
            {players.map((player) => {
              const isSelected = selectedPlayerId === player.id
              const isOffense = currentSide === "offense" || currentSide === "special_teams"
              const playerColor = isOffense ? "#3B82F6" : "#DC2626"

              return (
                <g key={player.id}>
                  {/* Player route */}
                  {player.route && player.route.length > 1 && (
                    <g>
                      <polyline
                        points={player.route.map((p) => {
                          const routePoint = p as { x: number; y: number; t: number }
                          return `${routePoint.x},${routePoint.y}`
                        }).join(" ")}
                        fill="none"
                        stroke={playerColor}
                        strokeWidth="2"
                      />
                      {/* Arrow at end */}
                      {player.route.length > 1 && (
                        <polygon
                          points={`${(player.route[player.route.length - 1] as { x: number; y: number }).x},${(player.route[player.route.length - 1] as { x: number; y: number }).y} ${(player.route[player.route.length - 1] as { x: number; y: number }).x - 5},${(player.route[player.route.length - 1] as { x: number; y: number }).y - 8} ${(player.route[player.route.length - 1] as { x: number; y: number }).x + 5},${(player.route[player.route.length - 1] as { x: number; y: number }).y - 8}`}
                          fill={playerColor}
                        />
                      )}
                    </g>
                  )}

                  {/* Blocking line */}
                  {player.blockingLine && (
                    <g>
                      <line
                        x1={player.x}
                        y1={player.y}
                        x2={(player.blockingLine as { x: number; y: number }).x}
                        y2={(player.blockingLine as { x: number; y: number }).y}
                        stroke={playerColor}
                        strokeWidth="3"
                      />
                      {/* Perpendicular cap */}
                      <line
                        x1={(player.blockingLine as { x: number; y: number }).x - 5}
                        y1={(player.blockingLine as { x: number; y: number }).y - 5}
                        x2={(player.blockingLine as { x: number; y: number }).x + 5}
                        y2={(player.blockingLine as { x: number; y: number }).y + 5}
                        stroke={playerColor}
                        strokeWidth="3"
                      />
                    </g>
                  )}

                  {/* Player shape */}
                  {player.shape === "circle" && (
                    <circle
                      cx={player.x}
                      cy={player.y}
                      r={markerSize / 2}
                      fill={playerColor}
                      stroke={isSelected ? "#0B2A5B" : "white"}
                      strokeWidth={isSelected ? "3" : "2"}
                      style={{ cursor: canEdit && tool === "select" ? "move" : "pointer" }}
                      onClick={() => {
                        if (tool === "select" || tool === "route" || tool === "block") {
                          setSelectedPlayerId(player.id)
                        }
                      }}
                      onMouseDown={(e) => {
                        if (canEdit && tool === "select") {
                          handlePlayerDrag(player.id, e)
                        }
                      }}
                    />
                  )}
                  {player.shape === "square" && (
                    <rect
                      x={player.x - markerSize / 2}
                      y={player.y - markerSize / 2}
                      width={markerSize}
                      height={markerSize}
                      fill={playerColor}
                      stroke={isSelected ? "#0B2A5B" : "white"}
                      strokeWidth={isSelected ? "3" : "2"}
                      style={{ cursor: canEdit && tool === "select" ? "move" : "pointer" }}
                      onClick={() => {
                        if (tool === "select" || tool === "route" || tool === "block") {
                          setSelectedPlayerId(player.id)
                        }
                      }}
                      onMouseDown={(e) => {
                        if (canEdit && tool === "select") {
                          handlePlayerDrag(player.id, e)
                        }
                      }}
                    />
                  )}
                  {player.shape === "triangle" && (
                    <polygon
                      points={`${player.x},${player.y + markerSize / 2} ${player.x - markerSize / 2},${player.y - markerSize / 2} ${player.x + markerSize / 2},${player.y - markerSize / 2}`}
                      fill={playerColor}
                      stroke={isSelected ? "#0B2A5B" : "white"}
                      strokeWidth={isSelected ? "3" : "2"}
                      style={{ cursor: canEdit && tool === "select" ? "move" : "pointer" }}
                      onClick={() => {
                        if (tool === "select" || tool === "route" || tool === "block") {
                          setSelectedPlayerId(player.id)
                        }
                      }}
                      onMouseDown={(e) => {
                        if (canEdit && tool === "select") {
                          handlePlayerDrag(player.id, e)
                        }
                      }}
                    />
                  )}

                  {/* Player label - editable */}
                  {editingLabelId === player.id ? (
                    <foreignObject
                      x={player.x - 20}
                      y={player.y + markerSize / 2 + 5}
                      width="40"
                      height="20"
                    >
                      <input
                        type="text"
                        value={editingLabelValue}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().slice(0, 2) // Max 2 characters
                          setEditingLabelValue(val)
                        }}
                        onBlur={() => {
                          if (editingLabelValue.trim()) {
                            setPlayers(
                              players.map((p) =>
                                p.id === player.id ? { ...p, label: editingLabelValue.trim().slice(0, 2) } : p
                              )
                            )
                          }
                          setEditingLabelId(null)
                          setEditingLabelValue("")
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur()
                          } else if (e.key === "Escape") {
                            setEditingLabelId(null)
                            setEditingLabelValue("")
                          }
                        }}
                        style={{
                          width: "100%",
                          height: "100%",
                          textAlign: "center",
                          fontSize: "12px",
                          fontWeight: "bold",
                          border: "2px solid #0B2A5B",
                          borderRadius: "4px",
                          backgroundColor: "white",
                          color: "#0B2A5B",
                        }}
                        autoFocus
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={player.x}
                      y={player.y + markerSize / 2 + 12}
                      textAnchor="middle"
                      fill="white"
                      fontSize="12"
                      fontWeight="bold"
                      style={{ cursor: canEdit && tool === "select" ? "pointer" : "default" }}
                      onClick={() => {
                        if (canEdit && tool === "select") {
                          setEditingLabelId(player.id)
                          setEditingLabelValue(player.label)
                        }
                      }}
                    >
                      {player.label}
                    </text>
                  )}

                  {/* Technique/Gap (defense) */}
                  {player.shape === "triangle" && (player.technique || player.gap) && (
                    <text
                      x={player.x}
                      y={player.y + markerSize / 2 + 15}
                      textAnchor="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="bold"
                      style={{ pointerEvents: "none" }}
                    >
                      {player.technique && player.gap ? `${player.technique}/${player.gap}` : player.technique || player.gap}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
