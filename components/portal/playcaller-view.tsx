"use client"

import {
  type HTMLAttributes,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react"
import { X, ChevronLeft, ChevronRight, Pencil, Eraser, Play, Pause, RotateCcw, SkipBack, Repeat, ChevronsLeft, ChevronsRight, Route, Circle, Flag, Star, Hand, ArrowRight, Triangle, Music2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlaybookFieldSurface, FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { clientToViewBox } from "@/lib/utils/canvas-coords"
import { getPlayFormationDisplayName } from "@/lib/utils/playbook-formation"
import { markerMatchesDepthSlot, type DepthChartSlot } from "@/lib/constants/playbook-positions"
import { getAnimatedPlayerPosition } from "@/lib/utils/play-animation"
import { usePlayAnimation, SPEED_OPTIONS, type PlaybackSpeed } from "@/lib/hooks/use-play-animation"
import type { PlayRecord, PlayCanvasData, RoutePoint, BlockEndPoint, FormationRecord } from "@/types/playbook"

type PresenterTool = "none" | "marker" | "icon"

export const ANNOTATION_ICON_TYPES = [
  { id: "football", label: "Football", Icon: Circle },
  { id: "cone", label: "Cone", Icon: Triangle },
  { id: "hand", label: "Hand", Icon: Hand },
  { id: "arrow", label: "Arrow", Icon: ArrowRight },
  { id: "x", label: "X", Icon: X },
  { id: "circle", label: "Circle", Icon: Circle },
  { id: "flag", label: "Flag", Icon: Flag },
  { id: "star", label: "Star", Icon: Star },
  { id: "whistle", label: "Whistle", Icon: Music2 },
] as const

const MARKER_COLORS = [
  { name: "Red", value: "#dc2626" },
  { name: "Blue", value: "#2563eb" },
  { name: "Green", value: "#16a34a" },
  { name: "Orange", value: "#ea580c" },
  { name: "Purple", value: "#9333ea" },
  { name: "Teal", value: "#0d9488" },
  { name: "Black", value: "#171717" },
  { name: "White", value: "#fafafa" },
  { name: "Gray", value: "#6b7280" },
  { name: "Maroon", value: "#881337" },
  { name: "Navy", value: "#1e3a8a" },
  { name: "Gold", value: "#ca8a04" },
  { name: "Slate", value: "#94a3b8" },
] as const

const FIELD_WIDTH_YARDS = 53.33
const VISIBLE_YARDS = 35
const YARD_START = 15
const YARD_END = 50
const VIEWBOX_W = 800
const VIEWBOX_H = 600

/** Position groups for highlight-by-group. Label/code maps to one of these. */
const PLAYER_GROUP_OPTIONS = [
  { value: "", label: "None" },
  { value: "QB", label: "QB" },
  { value: "RB", label: "RB" },
  { value: "WR", label: "WR" },
  { value: "TE", label: "TE" },
  { value: "OL", label: "OL" },
  { value: "DL", label: "DL" },
  { value: "LB", label: "LB" },
  { value: "DB", label: "DB" },
] as const

const POSITION_CODE_TO_GROUP: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  LT: "OL",
  LG: "OL",
  C: "OL",
  RG: "OL",
  RT: "OL",
  DE: "DL",
  DT: "DL",
  NT: "DL",
  EDGE: "DL",
  MLB: "LB",
  OLB: "LB",
  ILB: "LB",
  LB: "LB",
  CB: "DB",
  SS: "DB",
  FS: "DB",
  S: "DB",
}

function getGroupForPlayer(player: { label?: string | null; positionCode?: string | null }): string | null {
  const code = (player.positionCode ?? "").toUpperCase().trim()
  if (code && POSITION_CODE_TO_GROUP[code]) return POSITION_CODE_TO_GROUP[code]
  const label = (player.label ?? "").trim()
  const base = label.replace(/\d+$/, "").toUpperCase()
  return POSITION_CODE_TO_GROUP[base] ?? null
}

interface PlaycallerViewProps {
  plays: PlayRecord[]
  currentIndex: number
  onClose: () => void
  onIndexChange: (index: number) => void
  formations?: FormationRecord[] | null
  /** Depth chart entries for "View as player" and role-to-player resolution. */
  depthChartEntries?: DepthChartSlot[] | null
  /** When true, fill container instead of full screen (for playbook presenter page). */
  embedded?: boolean
  /** When true (and embedded), use larger canvas for presentation mode. */
  fullscreen?: boolean
}

/** Same coordinate system as editor; routes/blocks use normalized yard coords converted to pixels for consistent rendering. */
function usePresenterCoord(): FieldCoordinateSystem {
  return useMemo(() => new FieldCoordinateSystem(VIEWBOX_W, VIEWBOX_H, YARD_START, YARD_END), [])
}

function routePointToPixel(
  pt: RoutePoint | { x?: number; y?: number; xYards?: number; yYards?: number; t?: number },
  coord: FieldCoordinateSystem
): { x: number; y: number } {
  if (typeof (pt as { xYards?: number }).xYards === "number" && typeof (pt as { yYards?: number }).yYards === "number") {
    return coord.yardToPixel((pt as { xYards: number }).xYards, (pt as { yYards: number }).yYards)
  }
  return { x: (pt as { x?: number }).x ?? 0, y: (pt as { y?: number }).y ?? 0 }
}

function blockEndToPixel(
  bl: BlockEndPoint | { x?: number; y?: number; xYards?: number; yYards?: number },
  coord: FieldCoordinateSystem
): { x: number; y: number } {
  if (typeof (bl as { xYards?: number }).xYards === "number" && typeof (bl as { yYards?: number }).yYards === "number") {
    return coord.yardToPixel((bl as { xYards: number }).xYards, (bl as { yYards: number }).yYards)
  }
  return { x: (bl as { x?: number }).x ?? 0, y: (bl as { y?: number }).y ?? 0 }
}

function getPlayersFromCanvas(
  canvasData: PlayCanvasData | null,
  coord: FieldCoordinateSystem
): Array<{
  id: string
  x: number
  y: number
  label: string
  shape: string
  positionCode?: string | null
  positionNumber?: number | null
  route?: RoutePoint[]
  blockingLine?: BlockEndPoint
}> {
  if (!canvasData?.players?.length) return []
  return canvasData.players.map((p) => {
    const raw = p as { xYards?: number; yYards?: number; x?: number; y?: number }
    const hasYards = typeof raw.xYards === "number" && typeof raw.yYards === "number"
    const xYards = hasYards ? raw.xYards! : (typeof raw.x === "number" && typeof raw.y === "number" ? coord.pixelToYard(raw.x, raw.y).xYards : 0)
    const yYards = hasYards ? raw.yYards! : (typeof raw.x === "number" && typeof raw.y === "number" ? coord.pixelToYard(raw.x, raw.y).yYards : 0)
    const pixel = coord.yardToPixel(xYards, yYards)
    return {
      id: p.id,
      x: pixel.x,
      y: pixel.y,
      label: p.label,
      shape: p.shape,
      positionCode: p.positionCode ?? undefined,
      positionNumber: p.positionNumber ?? undefined,
      route: p.route,
      blockingLine: p.blockingLine,
    }
  })
}

export function PlaycallerView({
  plays,
  currentIndex,
  onClose,
  onIndexChange,
  formations,
  depthChartEntries,
  embedded = false,
  fullscreen = false,
}: PlaycallerViewProps) {
  const coord = usePresenterCoord()
  const play = plays[currentIndex]
  const canvasData = play?.canvasData as PlayCanvasData | null
  const players = getPlayersFromCanvas(canvasData, coord)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<PresenterTool>("none")
  const [markerColor, setMarkerColor] = useState<string>(MARKER_COLORS[0].value)
  const [strokes, setStrokes] = useState<{ points: { x: number; y: number }[]; color: string }[]>([])
  const [activeStroke, setActiveStroke] = useState<{ x: number; y: number }[] | null>(null)
  const [annotations, setAnnotations] = useState<{ id: string; iconType: string; x: number; y: number }[]>([])
  const [selectedIconType, setSelectedIconType] = useState<string>(ANNOTATION_ICON_TYPES[0].id)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const markerStrokeColor = markerColor
  const annotationIdRef = useRef(0)
  const [viewAsRoleId, setViewAsRoleId] = useState<string | null>(null)
  const [viewAsRosterPlayerId, setViewAsRosterPlayerId] = useState<string | null>(null)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [laserPosition, setLaserPosition] = useState<{ x: number; y: number } | null>(null)
  const {
    progress: animationProgress,
    isPlaying: isAnimationPlaying,
    speed: animationSpeed,
    state: animationState,
    loop: animationLoop,
    setLoop: setAnimationLoop,
    setProgress: setAnimationProgress,
    play: animationPlay,
    pause: animationPause,
    restart: animationRestart,
    setSpeed: setAnimationSpeed,
    stepToStart: animationStepToStart,
    stepForward: animationStepForward,
    stepBackward: animationStepBackward,
  } = usePlayAnimation(3000)
  const [showRoutes, setShowRoutes] = useState(true)
  const [highlightedGroup, setHighlightedGroup] = useState<string>("")
  const isAnimating = isAnimationPlaying
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)

  const updateProgressFromClientX = useCallback(
    (clientX: number) => {
      const el = timelineRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = clientX - rect.left
      const p = Math.max(0, Math.min(1, x / rect.width))
      setAnimationProgress(p)
    },
    [setAnimationProgress]
  )

  const handleTimelinePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      animationPause()
      setIsScrubbing(true)
      updateProgressFromClientX(e.clientX)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [animationPause, updateProgressFromClientX]
  )

  const handleTimelinePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isScrubbing) return
      updateProgressFromClientX(e.clientX)
    },
    [isScrubbing, updateProgressFromClientX]
  )

  const handleTimelinePointerUp = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      setIsScrubbing(false)
    },
    []
  )

  useEffect(() => {
    setViewAsRoleId(null)
    setViewAsRosterPlayerId(null)
    setAnnotations([])
    setSelectedAnnotationId(null)
  }, [currentIndex])

  // Reset animation when switching to another play
  useEffect(() => {
    animationStepToStart()
  }, [currentIndex, animationStepToStart])
  const playSide = play?.side ?? "offense"
  const viewAsRoleOptions = useMemo(() => {
    return players.map((p) => {
      const sameLabel = players.filter((x) => x.label === p.label)
      const needDisambiguate = sameLabel.length > 1
      const idx = sameLabel.indexOf(p) + 1
      const displayLabel = needDisambiguate ? `${p.label} (${idx})` : p.label
      return { id: p.id, displayLabel }
    })
  }, [players])
  const viewAsPlayerOptions = useMemo(() => {
    if (!depthChartEntries?.length) return []
    const byId = new Map<string, { id: string; displayLabel: string }>()
    for (const e of depthChartEntries) {
      if (!e.playerId) continue
      const p = e.player
      if (!p || byId.has(e.playerId)) continue
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown"
      const jersey = p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ""
      byId.set(e.playerId, { id: e.playerId, displayLabel: `${jersey}${name}`.trim() })
    }
    return Array.from(byId.values()).sort((a, b) => a.displayLabel.localeCompare(b.displayLabel))
  }, [depthChartEntries])
  const highlightedMarkerIds = useMemo(() => {
    if (viewAsRosterPlayerId && depthChartEntries?.length && play) {
      const playerSlots = depthChartEntries.filter((e) => e.playerId === viewAsRosterPlayerId)
      if (!playerSlots.length) return new Set<string>()
      const ids = new Set<string>()
      for (const marker of players) {
        const matches = playerSlots.some((slot) =>
          markerMatchesDepthSlot(playSide, marker.positionCode, marker.positionNumber, slot)
        )
        if (matches) ids.add(marker.id)
      }
      return ids
    }
    if (viewAsRoleId) return new Set<string>([viewAsRoleId])
    return new Set<string>()
  }, [viewAsRosterPlayerId, viewAsRoleId, depthChartEntries, players, playSide, play])

  const viewAsRosterPlayerLabel = viewAsRosterPlayerId
    ? viewAsPlayerOptions.find((o) => o.id === viewAsRosterPlayerId)?.displayLabel ?? "Unknown"
    : null
  const highlightedRoleLabels = useMemo(() => {
    if (highlightedMarkerIds.size === 0) return []
    return [...new Set(players.filter((p) => highlightedMarkerIds.has(p.id)).map((p) => p.label))]
  }, [players, highlightedMarkerIds])

  const clientToViewBoxPoint = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()
    const pt = clientToViewBox(clientX, clientY, rect, VIEWBOX_W, VIEWBOX_H)
    return { x: Math.max(0, Math.min(VIEWBOX_W, pt.x)), y: Math.max(0, Math.min(VIEWBOX_H, pt.y)) }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pt = clientToViewBoxPoint(e.clientX, e.clientY)
      if (!pt) return
      if (tool === "marker") {
        e.preventDefault()
        setActiveStroke([pt])
        e.currentTarget.setPointerCapture(e.pointerId)
      } else if (tool === "icon") {
        e.preventDefault()
        const id = `icon-${++annotationIdRef.current}`
        setAnnotations((prev) => [...prev, { id, iconType: selectedIconType, x: pt.x, y: pt.y }])
        setSelectedAnnotationId(id)
      } else {
        setSelectedAnnotationId(null)
      }
    },
    [tool, clientToViewBoxPoint, selectedIconType]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (shiftHeld) {
        const pt = clientToViewBoxPoint(e.clientX, e.clientY)
        if (pt) setLaserPosition(pt)
        return
      }
      if (tool !== "marker" || !activeStroke) return
      e.preventDefault()
      const pt = clientToViewBoxPoint(e.clientX, e.clientY)
      if (pt) setActiveStroke((prev) => (prev ? [...prev, pt] : [pt]))
    },
    [shiftHeld, tool, activeStroke, clientToViewBoxPoint]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.releasePointerCapture(e.pointerId)
      if (tool === "marker" && activeStroke && activeStroke.length > 0) {
        setStrokes((prev) => [...prev, { points: activeStroke, color: markerColor }])
        setActiveStroke(null)
      }
    },
    [tool, activeStroke, markerColor]
  )

  const handlePointerLeave = useCallback(() => {
    if (tool === "marker" && activeStroke && activeStroke.length > 0) {
      setStrokes((prev) => [...prev, { points: activeStroke, color: markerColor }])
      setActiveStroke(null)
    }
  }, [tool, activeStroke, markerColor])

  const clearDrawings = useCallback(() => {
    setStrokes([])
    setActiveStroke(null)
    setAnnotations([])
    setSelectedAnnotationId(null)
    setTool("none")
  }, [])

  const removeSelectedAnnotation = useCallback(() => {
    if (selectedAnnotationId) {
      setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotationId))
      setSelectedAnnotationId(null)
    }
  }, [selectedAnnotationId])

  const goPrev = useCallback(() => {
    onIndexChange(Math.max(0, currentIndex - 1))
  }, [currentIndex, onIndexChange])

  const goNext = useCallback(() => {
    onIndexChange(Math.min(plays.length - 1, currentIndex + 1))
  }, [currentIndex, plays.length, onIndexChange])

  useEffect(() => {
    const isFormField = (el: EventTarget | null) => {
      if (!el || !(el instanceof HTMLElement)) return false
      const tag = el.tagName.toLowerCase()
      return tag === "input" || tag === "select" || tag === "textarea" || !!el.isContentEditable
    }
    const handleKey = (e: KeyboardEvent) => {
      if (isFormField(e.target)) return

      if (e.key === " ") {
        e.preventDefault()
        if (isAnimationPlaying) {
          animationPause()
        } else {
          animationPlay()
        }
        return
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault()
        animationRestart()
        return
      }
      if (e.key === "Escape") {
        setSelectedAnnotationId(null)
        if (embedded && fullscreen) {
          // Let parent page handle exit fullscreen; do not close view
        } else {
          onClose()
        }
        return
      }
      if (e.key === "ArrowLeft") {
        goPrev()
        return
      }
      if (e.key === "ArrowRight") {
        goNext()
        return
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnotationId) {
        e.preventDefault()
        removeSelectedAnnotation()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, goPrev, goNext, selectedAnnotationId, removeSelectedAnnotation, embedded, fullscreen, isAnimationPlaying, animationPlay, animationPause, animationRestart])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setShiftHeld(false)
        setLaserPosition(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  if (!play) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No play selected</p>
        <Button variant="outline" className="absolute top-4 right-4" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>
      </div>
    )
  }

  const markerSize = coord.getMarkerSize()
  const isOffense = play.side === "offense" || play.side === "special_teams"
  const playerColor = isOffense ? "#3B82F6" : "#DC2626"
  const viewAsValue =
    viewAsRoleId ? `role:${viewAsRoleId}` : viewAsRosterPlayerId ? `player:${viewAsRosterPlayerId}` : ""
  const setViewAsValue = (raw: string) => {
    if (!raw) {
      setViewAsRoleId(null)
      setViewAsRosterPlayerId(null)
      return
    }
    if (raw.startsWith("role:")) {
      setViewAsRoleId(raw.slice(5) || null)
      setViewAsRosterPlayerId(null)
    } else if (raw.startsWith("player:")) {
      setViewAsRosterPlayerId(raw.slice(7) || null)
      setViewAsRoleId(null)
    }
  }

  return (
    <div className={`flex flex-col bg-slate-900 ${embedded ? "absolute inset-0 z-0" : "fixed inset-0 z-50"}`}>
      {!embedded && (
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <Button variant="secondary" size="sm" onClick={onClose} className="shadow-lg">
          <X className="h-4 w-4 mr-2" />
          Exit
        </Button>
        <div className="flex items-center gap-2 bg-background/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg">
          <Button variant="outline" size="icon" onClick={goPrev} disabled={currentIndex <= 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {currentIndex + 1} / {plays.length}
          </span>
          <Button variant="outline" size="icon" onClick={goNext} disabled={currentIndex >= plays.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 bg-background/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            View as:
            <select
              value={viewAsValue}
              onChange={(e) => setViewAsValue(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-sm min-w-[140px]"
            >
              <option value="">All</option>
              {viewAsRoleOptions.length > 0 && (
                <optgroup label="By role">
                  {viewAsRoleOptions.map((opt) => (
                    <option key={opt.id} value={`role:${opt.id}`}>{opt.displayLabel}</option>
                  ))}
                </optgroup>
              )}
              {viewAsPlayerOptions.length > 0 && (
                <optgroup label="By player">
                  {viewAsPlayerOptions.map((opt) => (
                    <option key={opt.id} value={`player:${opt.id}`}>{opt.displayLabel}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            Highlight:
            <select
              value={highlightedGroup}
              onChange={(e) => setHighlightedGroup(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-sm min-w-[80px]"
              title="Highlight position group"
            >
              {PLAYER_GROUP_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            Color:
            <select
              value={markerColor}
              onChange={(e) => setMarkerColor(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-sm min-w-[90px]"
              title="Marker color"
            >
              {MARKER_COLORS.map((c) => (
                <option key={c.value} value={c.value}>{c.name}</option>
              ))}
            </select>
          </label>
          <Button
            variant={tool === "marker" ? "secondary" : "outline"}
            size="icon"
            onClick={() => setTool((t) => (t === "marker" ? "none" : "marker"))}
            title="Draw on play"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={clearDrawings} title="Clear all drawings and icons">
            <Eraser className="h-4 w-4" />
          </Button>
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            Icon:
            <select
              value={selectedIconType}
              onChange={(e) => setSelectedIconType(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-sm min-w-[90px]"
              title="Annotation icon"
            >
              {ANNOTATION_ICON_TYPES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
          <Button
            variant={tool === "icon" ? "secondary" : "outline"}
            size="icon"
            onClick={() => setTool((t) => (t === "icon" ? "none" : "icon"))}
            title="Add icon (click on field)"
          >
            <Flag className="h-4 w-4" />
          </Button>
          {selectedAnnotationId && (
            <Button variant="outline" size="sm" onClick={removeSelectedAnnotation} title="Remove selected icon (or press Delete)">
              Remove icon
            </Button>
          )}
        </div>
      </div>
      )}
      {embedded && (
        <div
          className={
            fullscreen
              ? "fixed top-0 left-0 right-0 z-20 flex items-center justify-end gap-2 px-3 py-2 bg-slate-800/95 backdrop-blur border-b border-slate-700"
              : "flex-shrink-0 flex items-center justify-end gap-2 px-3 py-2 bg-slate-800/90 border-b border-slate-700"
          }
        >
          <label className="text-xs text-slate-400 flex items-center gap-1.5">
            View as:
            <select
              value={viewAsValue}
              onChange={(e) => setViewAsValue(e.target.value)}
              className="h-7 rounded border border-slate-600 bg-slate-800 text-slate-200 px-2 text-xs min-w-[120px]"
            >
              <option value="">All</option>
              {viewAsRoleOptions.length > 0 && (
                <optgroup label="By role">
                  {viewAsRoleOptions.map((opt) => (
                    <option key={opt.id} value={`role:${opt.id}`}>{opt.displayLabel}</option>
                  ))}
                </optgroup>
              )}
              {viewAsPlayerOptions.length > 0 && (
                <optgroup label="By player">
                  {viewAsPlayerOptions.map((opt) => (
                    <option key={opt.id} value={`player:${opt.id}`}>{opt.displayLabel}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label className="text-xs text-slate-400 flex items-center gap-1">
            Highlight:
            <select
              value={highlightedGroup}
              onChange={(e) => setHighlightedGroup(e.target.value)}
              className="h-7 rounded border border-slate-600 bg-slate-800 text-slate-200 px-1.5 text-xs min-w-[72px]"
              title="Highlight position group"
            >
              {PLAYER_GROUP_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400 flex items-center gap-1">
            Color:
            <select
              value={markerColor}
              onChange={(e) => setMarkerColor(e.target.value)}
              className="h-7 rounded border border-slate-600 bg-slate-800 text-slate-200 px-1.5 text-xs min-w-[80px]"
              title="Marker color"
            >
              {MARKER_COLORS.map((c) => (
                <option key={c.value} value={c.value}>{c.name}</option>
              ))}
            </select>
          </label>
          <Button
            variant={tool === "marker" ? "secondary" : "outline"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setTool((t) => (t === "marker" ? "none" : "marker"))}
            title="Draw on play"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={clearDrawings} title="Clear all">
            <Eraser className="h-3.5 w-3.5" />
          </Button>
          <select
            value={selectedIconType}
            onChange={(e) => setSelectedIconType(e.target.value)}
            className="h-7 rounded border border-slate-600 bg-slate-800 text-slate-200 px-1.5 text-xs min-w-[72px]"
            title="Icon"
          >
            {ANNOTATION_ICON_TYPES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <Button
            variant={tool === "icon" ? "secondary" : "outline"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setTool((t) => (t === "icon" ? "none" : "icon"))}
            title="Add icon"
          >
            <Flag className="h-3.5 w-3.5" />
          </Button>
          {selectedAnnotationId && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={removeSelectedAnnotation} title="Remove selected icon (or press Delete)">
              Remove icon
            </Button>
          )}
        </div>
      )}

      {/* Resolved "Viewing as" label and no-roles message (hidden in fullscreen) */}
      {!fullscreen && viewAsRosterPlayerId && viewAsRosterPlayerLabel && (
        <div className="px-4 py-2 flex justify-center">
          {highlightedRoleLabels.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Viewing as: <span className="font-medium text-foreground">{viewAsRosterPlayerLabel}</span>
              <span className="text-foreground/80"> ({highlightedRoleLabels.join(", ")})</span>
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              No roles on this play for <span className="font-medium text-slate-300">{viewAsRosterPlayerLabel}</span>
            </p>
          )}
        </div>
      )}
      {!fullscreen && viewAsRoleId && highlightedRoleLabels.length > 0 && (
        <div className="px-4 py-1 flex justify-center">
          <p className="text-xs text-muted-foreground">
            Viewing as role: <span className="font-medium text-foreground">{highlightedRoleLabels[0]}</span>
          </p>
        </div>
      )}

      <div className={`flex-1 flex items-center justify-center min-h-0 min-w-0 overflow-hidden ${embedded ? "p-2 sm:p-4" : "p-4"}`}>
        <div
          className={`w-full max-w-full min-w-0 aspect-[53.33/35] overflow-hidden ${
            embedded && fullscreen
              ? "max-w-[90vw] max-h-[85vh] rounded-lg border border-slate-700/50 shadow-2xl"
              : embedded
                ? "max-w-full max-h-[min(72vh,520px)] sm:max-h-[85vh] sm:max-w-4xl rounded-xl shadow-2xl border border-slate-300"
                : "max-w-4xl max-h-[85vh] rounded-lg shadow-2xl border border-slate-300"
          }`}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
            className="w-full h-full touch-none"
            preserveAspectRatio="xMidYMid meet"
            style={{ background: "#2d5016" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              <filter id="laser-pointer-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <PlaybookFieldSurface width={VIEWBOX_W} height={VIEWBOX_H} yardStart={YARD_START} yardEnd={YARD_END} />
            {/* Routes and blocking lines (hidden when showRoutes is off); markers still animate along paths */}
            {showRoutes &&
              players.map((p) => {
                const groupMatch = highlightedGroup ? getGroupForPlayer(p) === highlightedGroup : null
                const isHighlighted =
                  groupMatch !== null ? groupMatch : highlightedMarkerIds.size === 0 || highlightedMarkerIds.has(p.id)
                const routeOpacity = isHighlighted ? 1 : 0.4
                const routeGlow = !!highlightedGroup && groupMatch === true
                return (
                <g key={`routes-${p.id}`} style={{ opacity: routeOpacity, pointerEvents: "none" }}>
                  {p.route && p.route.length > 1 && (
                    <g filter={routeGlow ? "url(#route-glow)" : undefined}>
                      <polyline
                        points={p.route.map((pt) => {
                          const px = routePointToPixel(pt, coord)
                          return `${px.x},${px.y}`
                        }).join(" ")}
                        fill="none"
                        stroke={playerColor}
                        strokeWidth={isHighlighted ? 2.5 : 2}
                      />
                      {p.route.length > 1 && (() => {
                        const last = routePointToPixel(p.route![p.route!.length - 1], coord)
                        return (
                          <polygon
                            points={`${last.x},${last.y} ${last.x - 5},${last.y - 8} ${last.x + 5},${last.y - 8}`}
                            fill={playerColor}
                          />
                        )
                      })()}
                    </g>
                  )}
                  {p.blockingLine && (
                    <>
                      <line
                        x1={p.x}
                        y1={p.y}
                        x2={blockEndToPixel(p.blockingLine, coord).x}
                        y2={blockEndToPixel(p.blockingLine, coord).y}
                        stroke={playerColor}
                        strokeWidth={3}
                      />
                      {(() => {
                        const end = blockEndToPixel(p.blockingLine!, coord)
                        return (
                          <line
                            x1={end.x - 5}
                            y1={end.y - 5}
                            x2={end.x + 5}
                            y2={end.y + 5}
                            stroke={playerColor}
                            strokeWidth={3}
                          />
                        )
                      })()}
                    </>
                  )}
                </g>
              )
              })}
            {/* Faint trail behind moving players during animation */}
            {showRoutes && animationProgress > 0 && animationProgress < 1 && canvasData?.players?.map((raw) => {
              const hasPath = (raw.route && raw.route.length > 1) || (raw.preSnapMotion?.points?.length)
              if (!hasPath) return null
              const steps = Math.max(2, Math.ceil((animationProgress * 20) + 1))
              const trailPoints: string[] = []
              for (let i = 0; i <= steps; i++) {
                const t = (i / steps) * animationProgress
                const pt = getAnimatedPlayerPosition(raw, t)
                const px = coord.yardToPixel(pt.xYards, pt.yYards)
                trailPoints.push(`${px.x},${px.y}`)
              }
              if (trailPoints.length < 2) return null
              return (
                <polyline
                  key={`trail-${raw.id}`}
                  points={trailPoints.join(" ")}
                  fill="none"
                  stroke={playerColor}
                  strokeWidth={2}
                  strokeOpacity={0.35}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none" }}
                />
              )
            })}
            {players.map((p) => {
              const groupMatch = highlightedGroup ? getGroupForPlayer(p) === highlightedGroup : null
              const isHighlighted =
                groupMatch !== null ? groupMatch : highlightedMarkerIds.size === 0 || highlightedMarkerIds.has(p.id)
              const markerOpacity = isHighlighted ? 1 : 0.4
              const rawPlayer = canvasData?.players?.find((c) => c.id === p.id)
              const yardPos =
                rawPlayer && animationProgress > 0
                  ? getAnimatedPlayerPosition(rawPlayer, animationProgress)
                  : null
              const animPos = yardPos
                ? coord.yardToPixel(yardPos.xYards, yardPos.yYards)
                : { x: p.x, y: p.y }
              const isMoving = animationProgress > 0 && animationProgress < 1
              const sizeScale = isMoving ? 1.15 : 1
              const r = (markerSize / 2) * sizeScale
              return (
              <g key={p.id} style={{ opacity: markerOpacity, pointerEvents: "none" }}>
                {p.shape === "circle" && (
                  <circle
                    cx={animPos.x}
                    cy={animPos.y}
                    r={r}
                    fill={playerColor}
                    stroke="white"
                    strokeWidth={2}
                  />
                )}
                {p.shape === "square" && (
                  <rect
                    x={animPos.x - r}
                    y={animPos.y - r}
                    width={r * 2}
                    height={r * 2}
                    fill={playerColor}
                    stroke="white"
                    strokeWidth={2}
                  />
                )}
                {p.shape === "triangle" && (
                  <polygon
                    points={`${animPos.x},${animPos.y + r} ${animPos.x - r},${animPos.y - r} ${animPos.x + r},${animPos.y - r}`}
                    fill={playerColor}
                    stroke="white"
                    strokeWidth={2}
                  />
                )}
                <text
                  x={animPos.x}
                  y={animPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={Math.max(7, Math.min(11, Math.round(markerSize * 0.28)))}
                  fontWeight="bold"
                  style={{ pointerEvents: "none" }}
                >
                  {p.label}
                </text>
              </g>
            )
            })}
            {/* Marker strokes (presenter drawings); non-interactive so capture rect receives pointer */}
            {strokes.map((stroke, i) =>
              stroke.points.length > 1 ? (
                <polyline
                  key={i}
                  points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none" }}
                />
              ) : null
            )}
            {activeStroke && activeStroke.length > 1 && (
              <polyline
                points={activeStroke.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={markerStrokeColor}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: "none" }}
              />
            )}
            {/* Capture rect: receives pointer when marker or icon tool active; behind annotations so icon clicks work */}
            <rect
              width={VIEWBOX_W}
              height={VIEWBOX_H}
              fill="transparent"
              pointerEvents={tool === "marker" || tool === "icon" ? "all" : "none"}
            />
            {/* Annotation icons (on top so they receive clicks) */}
            {annotations.map((a) => {
              const def = ANNOTATION_ICON_TYPES.find((d) => d.id === a.iconType) ?? ANNOTATION_ICON_TYPES[0]
              const IconComp = def.Icon
              const isSelected = selectedAnnotationId === a.id
              return (
                <g
                  key={a.id}
                  transform={`translate(${a.x},${a.y})`}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); setSelectedAnnotationId(a.id); }}
                >
                  <circle
                    r={14}
                    fill={isSelected ? "rgba(59, 130, 246, 0.3)" : "transparent"}
                    stroke={isSelected ? "#2563eb" : "transparent"}
                    strokeWidth={2}
                  />
                  <foreignObject x={-12} y={-12} width={24} height={24}>
                    <div
                      {...({
                        xmlns: "http://www.w3.org/1999/xhtml",
                        style: {
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fafafa",
                        },
                      } as HTMLAttributes<HTMLDivElement> & { xmlns: string })}
                    >
                      <IconComp size={18} strokeWidth={2.5} />
                    </div>
                  </foreignObject>
                </g>
              )
            })}
            {/* Laser pointer (hold Shift); pointer-events: none so it doesn't block interaction */}
            {shiftHeld && laserPosition && (
              <g pointerEvents="none">
                <circle
                  cx={laserPosition.x}
                  cy={laserPosition.y}
                  r={10}
                  fill="#ef4444"
                  fillOpacity={0.95}
                  filter="url(#laser-pointer-glow)"
                />
                <circle
                  cx={laserPosition.x}
                  cy={laserPosition.y}
                  r={6}
                  fill="#dc2626"
                />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Animation controls (always visible; compact in fullscreen) */}
      <div
        className={
          fullscreen
            ? "fixed bottom-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 w-full max-w-lg px-3"
            : "absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-full max-w-xl px-4"
        }
      >
        {/* Timeline scrubber */}
        <div className="w-full flex flex-col gap-1">
          <div
            ref={timelineRef}
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={animationProgress}
            tabIndex={0}
            className={
              fullscreen
                ? "relative h-5 w-full rounded bg-slate-700/90 cursor-pointer touch-none flex items-center overflow-visible"
                : "relative h-6 w-full rounded bg-muted/80 cursor-pointer touch-none flex items-center overflow-visible"
            }
            onPointerDown={handleTimelinePointerDown}
            onPointerMove={handleTimelinePointerMove}
            onPointerUp={handleTimelinePointerUp}
            onPointerLeave={handleTimelinePointerUp}
            onPointerCancel={handleTimelinePointerUp}
          >
            <div
              className={
                fullscreen
                  ? "h-full rounded-l bg-slate-500/80 transition-none pointer-events-none"
                  : "h-full rounded-l bg-primary/70 transition-none pointer-events-none"
              }
              style={{ width: `${animationProgress * 100}%` }}
            />
            <div
              className={
                fullscreen
                  ? "absolute top-1/2 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-slate-800 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
                  : "absolute top-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background shadow -translate-y-1/2 -translate-x-1/2 pointer-events-none"
              }
              style={{ left: `${animationProgress * 100}%` }}
            />
          </div>
        </div>
        <div
          className={
            fullscreen
              ? "flex items-center gap-1.5 bg-slate-800/95 backdrop-blur px-2.5 py-1.5 rounded-md border border-slate-700/50"
              : "flex items-center gap-2 bg-background/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg"
          }
        >
          <Button
            variant="outline"
            size="icon"
            className={fullscreen ? "h-7 w-7 border-slate-600 text-slate-200 hover:bg-slate-700" : ""}
            onClick={animationStepToStart}
            title="Step back to start"
          >
            <SkipBack className={fullscreen ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={fullscreen ? "h-7 w-7 border-slate-600 text-slate-200 hover:bg-slate-700" : ""}
            onClick={animationStepBackward}
            title="Step backward (one frame)"
          >
            <ChevronsLeft className={fullscreen ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </Button>
          {isAnimationPlaying ? (
            <Button
              variant="secondary"
              size="icon"
              className={fullscreen ? "h-7 w-7 bg-slate-600 text-white hover:bg-slate-500" : ""}
              onClick={animationPause}
              title="Pause (Space)"
            >
              <Pause className={fullscreen ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="icon"
              className={fullscreen ? "h-7 w-7 bg-slate-600 text-white hover:bg-slate-500" : ""}
              onClick={animationPlay}
              title="Play (Space)"
            >
              <Play className={fullscreen ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className={fullscreen ? "h-7 w-7 border-slate-600 text-slate-200 hover:bg-slate-700" : ""}
            onClick={animationStepForward}
            title="Step forward (one frame)"
          >
            <ChevronsRight className={fullscreen ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={fullscreen ? "h-7 w-7 border-slate-600 text-slate-200 hover:bg-slate-700" : ""}
            onClick={animationRestart}
            title="Restart (R)"
          >
            <RotateCcw className={fullscreen ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </Button>
          <Button
            variant={animationLoop ? "secondary" : "outline"}
            size="icon"
            className={fullscreen ? `h-7 w-7 ${animationLoop ? "bg-slate-600 text-white" : "border-slate-600 text-slate-200 hover:bg-slate-700"}` : ""}
            onClick={() => setAnimationLoop(!animationLoop)}
            title={animationLoop ? "Loop on" : "Loop off"}
          >
            <Repeat className={`${fullscreen ? "h-3.5 w-3.5" : "h-4 w-4"} ${animationLoop ? "text-primary" : ""}`} />
          </Button>
          <Button
            variant={showRoutes ? "secondary" : "outline"}
            size="icon"
            className={fullscreen ? `h-7 w-7 ${showRoutes ? "bg-slate-600 text-white" : "border-slate-600 text-slate-200 hover:bg-slate-700"}` : ""}
            onClick={() => setShowRoutes((v) => !v)}
            title={showRoutes ? "Hide routes" : "Show routes"}
          >
            <Route className={`${fullscreen ? "h-3.5 w-3.5" : "h-4 w-4"} ${showRoutes ? "text-primary" : ""}`} />
          </Button>
          <select
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(Number(e.target.value) as PlaybackSpeed)}
            className={
              fullscreen
                ? "h-7 rounded border border-slate-600 bg-slate-800 text-slate-200 px-1.5 text-xs min-w-[52px]"
                : "h-8 rounded border border-input bg-background px-2 text-sm min-w-[64px]"
            }
            title="Speed"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>
        </div>
        {!fullscreen && (
          <p className="text-xs text-muted-foreground">
            {animationState === "playing"
              ? "Playing"
              : animationState === "paused"
                ? "Paused"
                : animationState === "ended"
                  ? "Ended"
                  : "Ready"}
            {" · "}
            Speed: {animationSpeed}x
            {animationLoop ? " · Loop on" : ""}
            {" · "}
            Routes: {showRoutes ? "on" : "off"}
          </p>
        )}
      </div>

      <div
        className={`absolute left-1/2 -translate-x-1/2 px-4 py-2 ${
          fullscreen ? "bottom-6 bg-slate-900/80 backdrop-blur rounded-md border border-slate-700/50 pointer-events-none" : "bottom-4 bg-background/90 backdrop-blur rounded-lg shadow-lg"
        }`}
      >
        <p className={fullscreen ? "text-base font-semibold text-slate-100" : "text-sm font-semibold text-foreground"}>{play.name}</p>
        <p className={fullscreen ? "text-sm text-slate-400" : "text-xs text-muted-foreground"}>
          {getPlayFormationDisplayName(play, formations)} · {play.side.replace("_", " ")}
        </p>
      </div>
    </div>
  )
}
