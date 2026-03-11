"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Square, Move, Pencil, RotateCcw, RotateCw, Save, X, Circle, Maximize2, Minimize2, Users, Check, Ban } from "lucide-react"
import { PlaybookFieldSurface, FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { PlaybookFileTree } from "@/components/portal/playbook-file-tree"
import { PlaybookShapePalette } from "@/components/portal/playbook-shape-palette"
import { validateTemplateSave } from "@/lib/utils/playbook-validation"

type CanvasMode =
  | "idle"
  | "selecting"
  | "placing_player"
  | "drawing_route"
  | "drawing_block"
  | "drawing_zone"
  | "editing_text"
  | "erasing"
  | "man_coverage"

interface PointPX {
  x: number
  y: number
  xYards: number
  yYards: number
}

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

export interface CanvasData {
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
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [manCoverageStart, setManCoverageStart] = useState<string | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState("")

  // Draft state: in-progress route/block (never saved until Finish)
  const [routeDraft, setRouteDraft] = useState<{ playerId: string; points: PointPX[] } | null>(null)
  const [blockDraft, setBlockDraft] = useState<{ playerId: string; endPoint: PointPX } | null>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)

  // Undo/redo: undo stack holds past states; redo stack holds states we undid from
  const [undoStack, setUndoStack] = useState<{ players: Player[]; zones: Zone[]; manCoverages: ManCoverage[] }[]>([])
  const [redoStack, setRedoStack] = useState<{ players: Player[]; zones: Zone[]; manCoverages: ManCoverage[] }[]>([])
  const pushHistory = useCallback(() => {
    const snapshot = { players: JSON.parse(JSON.stringify(players)), zones: JSON.parse(JSON.stringify(zones)), manCoverages: JSON.parse(JSON.stringify(manCoverages)) }
    setUndoStack((prev) => [...prev, snapshot].slice(-30))
    setRedoStack([])
  }, [players, zones, manCoverages])
  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const current = { players: JSON.parse(JSON.stringify(players)), zones: JSON.parse(JSON.stringify(zones)), manCoverages: JSON.parse(JSON.stringify(manCoverages)) }
    const restored = undoStack[undoStack.length - 1]
    setRedoStack((prev) => [...prev, current])
    setUndoStack((prev) => prev.slice(0, -1))
    setPlayers(restored.players)
    setZones(restored.zones)
    setManCoverages(restored.manCoverages)
  }, [undoStack, players, zones, manCoverages])
  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const current = { players: JSON.parse(JSON.stringify(players)), zones: JSON.parse(JSON.stringify(zones)), manCoverages: JSON.parse(JSON.stringify(manCoverages)) }
    const restored = redoStack[redoStack.length - 1]
    setUndoStack((prev) => [...prev, current])
    setRedoStack((prev) => prev.slice(0, -1))
    setPlayers(restored.players)
    setZones(restored.zones)
    setManCoverages(restored.manCoverages)
  }, [redoStack, players, zones, manCoverages])

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
      if (e.key === "Alt") setSnapEnabled(false)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") setSnapEnabled(true)
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // Finish/Cancel drawing and tool shortcuts
  const finishRouteDraft = useCallback(() => {
    if (!routeDraft || routeDraft.points.length < 2) return
    const pts = routeDraft.points
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === routeDraft.playerId
          ? {
              ...p,
              route: pts.map((pt, i) => ({
                x: pt.x,
                y: pt.y,
                xYards: pt.xYards,
                yYards: pt.yYards,
                t: pts.length === 1 ? 1 : i / (pts.length - 1),
              })),
            }
          : p
      )
    )
    pushHistory()
    setRouteDraft(null)
    setCursorPosition(null)
    setSelectedPlayerId(null)
  }, [routeDraft, pushHistory])

  const cancelRouteDraft = useCallback(() => {
    setRouteDraft(null)
    setCursorPosition(null)
    setSelectedPlayerId(null)
  }, [])

  const finishBlockDraft = useCallback(() => {
    if (!blockDraft) return
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === blockDraft.playerId
          ? { ...p, blockingLine: { x: blockDraft.endPoint.x, y: blockDraft.endPoint.y, xYards: blockDraft.endPoint.xYards, yYards: blockDraft.endPoint.yYards } }
          : p
      )
    )
    pushHistory()
    setBlockDraft(null)
    setCursorPosition(null)
    setSelectedPlayerId(null)
  }, [blockDraft, pushHistory])

  const cancelBlockDraft = useCallback(() => {
    setBlockDraft(null)
    setCursorPosition(null)
    setSelectedPlayerId(null)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (routeDraft || blockDraft) {
          e.preventDefault()
          cancelRouteDraft()
          cancelBlockDraft()
        }
        return
      }
      if (e.key === "Enter") {
        if (routeDraft && routeDraft.points.length >= 2) {
          e.preventDefault()
          finishRouteDraft()
        } else if (blockDraft) {
          e.preventDefault()
          finishBlockDraft()
        }
        return
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (e.key === "y") {
          e.preventDefault()
          redo()
        }
        return
      }
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return
      const key = e.key.toLowerCase()
      if (key === "v") { e.preventDefault(); setTool("select"); cancelRouteDraft(); cancelBlockDraft() }
      else if (key === "r") { e.preventDefault(); setTool("route"); cancelRouteDraft(); cancelBlockDraft() }
      else if (key === "b") { e.preventDefault(); setTool("block"); cancelRouteDraft(); cancelBlockDraft() }
      else if (key === "z" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setTool("zone"); cancelRouteDraft(); cancelBlockDraft() }
      else if (key === "t") { e.preventDefault(); setTool("select"); cancelRouteDraft(); cancelBlockDraft() }
      else if (key === "e") { e.preventDefault(); setTool("erase"); cancelRouteDraft(); cancelBlockDraft() }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [routeDraft, blockDraft, finishRouteDraft, finishBlockDraft, cancelRouteDraft, cancelBlockDraft, undo, redo])

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

  const getCanvasPoint = (e: React.MouseEvent<SVGSVGElement | Element>) => {
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
      pushHistory()
      setPlayers([...players, newPlayer])
    } else if (tool === "erase") {
      const clickedPlayer = players.find(
        (p) => Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < coordSystem.getMarkerSize()
      )
      if (clickedPlayer) {
        setPlayers(players.filter((p) => p.id !== clickedPlayer.id))
        pushHistory()
      }
    } else if (tool === "route") {
      const clickedPlayer = players.find(
        (p) => Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < coordSystem.getMarkerSize()
      )
      if (routeDraft) {
        if (clickedPlayer && clickedPlayer.id === routeDraft.playerId) return
        setRouteDraft((prev) =>
          prev ? { ...prev, points: [...prev.points, { x: point.x, y: point.y, xYards: point.xYards, yYards: point.yYards }] } : null
        )
      } else if (clickedPlayer) {
        const origin: PointPX = {
          x: clickedPlayer.x,
          y: clickedPlayer.y,
          xYards: clickedPlayer.xYards ?? coordSystem.pixelToYard(clickedPlayer.x, clickedPlayer.y).xYards,
          yYards: clickedPlayer.yYards ?? coordSystem.pixelToYard(clickedPlayer.x, clickedPlayer.y).yYards,
        }
        setRouteDraft({ playerId: clickedPlayer.id, points: [origin] })
        setSelectedPlayerId(clickedPlayer.id)
      }
    } else if (tool === "block") {
      const clickedPlayer = players.find(
        (p) => Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < coordSystem.getMarkerSize()
      )
      if (blockDraft) {
        setBlockDraft((prev) => (prev ? { ...prev, endPoint: { x: point.x, y: point.y, xYards: point.xYards, yYards: point.yYards } } : null))
      } else if (clickedPlayer) {
        const origin: PointPX = {
          x: clickedPlayer.x,
          y: clickedPlayer.y,
          xYards: clickedPlayer.xYards ?? coordSystem.pixelToYard(clickedPlayer.x, clickedPlayer.y).xYards,
          yYards: clickedPlayer.yYards ?? coordSystem.pixelToYard(clickedPlayer.x, clickedPlayer.y).yYards,
        }
        setBlockDraft({ playerId: clickedPlayer.id, endPoint: origin })
        setSelectedPlayerId(clickedPlayer.id)
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
      pushHistory()
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
          pushHistory()
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
    if (!canEdit) return
    const point = getCanvasPoint(e)
    if ((tool === "route" && routeDraft) || (tool === "block" && blockDraft)) {
      setCursorPosition({ x: point.x, y: point.y })
    } else {
      setCursorPosition(null)
    }
  }

  const handleCanvasMouseLeave = () => {
    setCursorPosition(null)
  }

  const handleCanvasDoubleClick = () => {
    if (tool === "route" && routeDraft && routeDraft.points.length >= 2) {
      finishRouteDraft()
    } else if (tool === "block" && blockDraft) {
      finishBlockDraft()
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
    setRouteDraft(null)
    setBlockDraft(null)
    setCursorPosition(null)
    setSelectedPlayerId(null)
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

    // Convert players to yard coordinates for saving; normalize route/blockingLine to include xYards/yYards
    const playersWithYards = players.map((p) => {
      let out: Player = p.xYards !== undefined && p.yYards !== undefined
        ? { ...p }
        : { ...p, xYards: coordSystem.pixelToYard(p.x, p.y).xYards, yYards: coordSystem.pixelToYard(p.x, p.y).yYards }
      if (out.route?.length) {
        const routeArr = out.route
        out = {
          ...out,
          route: routeArr.map((pt, i) => {
            const x = "x" in pt ? pt.x! : coordSystem.yardToPixel((pt as { xYards: number }).xYards, (pt as { yYards: number }).yYards).x
            const y = "y" in pt ? pt.y! : coordSystem.yardToPixel((pt as { xYards: number }).xYards, (pt as { yYards: number }).yYards).y
            const xYards = "xYards" in pt ? (pt as { xYards: number }).xYards : coordSystem.pixelToYard(x, y).xYards
            const yYards = "yYards" in pt ? (pt as { yYards: number }).yYards : coordSystem.pixelToYard(x, y).yYards
            return { x, y, xYards, yYards, t: "t" in pt ? pt.t : i / (routeArr.length - 1 || 1) }
          }),
        }
      }
      if (out.blockingLine) {
        const bl = out.blockingLine as { x?: number; y?: number; xYards?: number; yYards?: number }
        const xYards = bl.xYards ?? coordSystem.pixelToYard(bl.x ?? 0, bl.y ?? 0).xYards
        const yYards = bl.yYards ?? coordSystem.pixelToYard(bl.x ?? 0, bl.y ?? 0).yYards
        out = { ...out, blockingLine: { ...bl, x: bl.x, y: bl.y, xYards, yYards } }
      }
      return out
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
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && !isTemplateMode && (
            <>
              <Button variant="outline" size="sm" onClick={undo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)">
                <RotateCcw className="h-4 w-4 mr-1" />
                Undo
              </Button>
              <Button variant="outline" size="sm" onClick={redo} disabled={redoStack.length === 0} title="Redo (Ctrl+Shift+Z)">
                <RotateCw className="h-4 w-4 mr-1" />
                Redo
              </Button>
              {(routeDraft || blockDraft) && (
                <>
                  <Button
                    size="sm"
                    onClick={routeDraft && routeDraft.points.length >= 2 ? finishRouteDraft : blockDraft ? finishBlockDraft : undefined}
                    disabled={routeDraft ? routeDraft.points.length < 2 : !blockDraft}
                    title="Finish (Enter)"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Finish
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { cancelRouteDraft(); cancelBlockDraft() }} title="Cancel (Esc)">
                    <Ban className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </>
              )}
            </>
          )}
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

      {/* Drawing helper text */}
      {canEdit && !isTemplateMode && (
        <div className="flex-shrink-0 px-2 py-1 border-b text-xs text-slate-600 bg-slate-50" style={{ borderColor: "#E5E7EB" }}>
          {tool === "route" && !routeDraft && "Click a player to start a route."}
          {tool === "route" && routeDraft && "Click to add points, double-click or Enter to finish, Esc to cancel."}
          {tool === "block" && !blockDraft && "Click a player to start a block."}
          {tool === "block" && blockDraft && "Click to set block target, or Enter to finish, Esc to cancel."}
          {tool === "select" && !routeDraft && !blockDraft && "Select and drag players. V = Select, R = Route, B = Block, Z = Zone, E = Erase."}
        </div>
      )}

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
              cancelRouteDraft()
              cancelBlockDraft()
              setTool(newTool as typeof tool)
              if (newTool === "select") setSelectedPlayerId(null)
              else if (newTool === "man") setManCoverageStart(null)
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
            onMouseLeave={handleCanvasMouseLeave}
          >
            {/* Field surface */}
            <PlaybookFieldSurface
              width={fieldDimensions.width}
              height={fieldDimensions.height}
              yardStart={yardLineStart}
              yardEnd={yardLineEnd}
            />

            {/* Route draft: committed points + live cursor preview */}
            {routeDraft && routeDraft.points.length > 0 && (
              <g>
                <polyline
                  points={
                    cursorPosition
                      ? [...routeDraft.points, cursorPosition].map((p) => `${p.x},${p.y}`).join(" ")
                      : routeDraft.points.map((p) => `${p.x},${p.y}`).join(" ")
                  }
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="3"
                  strokeDasharray="6,4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {routeDraft.points.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="#3B82F6" stroke="white" strokeWidth="1.5" />
                ))}
              </g>
            )}

            {/* Block draft: line from player to endPoint or cursor */}
            {blockDraft && (() => {
              const blocker = players.find((p) => p.id === blockDraft.playerId)
              if (!blocker) return null
              const end = cursorPosition ?? { x: blockDraft.endPoint.x, y: blockDraft.endPoint.y }
              return (
                <g>
                  <line
                    x1={blocker.x}
                    y1={blocker.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#F59E0B"
                    strokeWidth="3"
                    strokeDasharray="6,4"
                    strokeLinecap="round"
                  />
                  <circle cx={end.x} cy={end.y} r="5" fill="#F59E0B" stroke="white" strokeWidth="1.5" />
                </g>
              )
            })()}

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
