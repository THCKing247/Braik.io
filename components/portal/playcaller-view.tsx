"use client"

import {
  type HTMLAttributes,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Eraser,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  Repeat,
  ChevronsLeft,
  ChevronsRight,
  Route,
  Circle,
  Flag,
  Star,
  Hand,
  ArrowRight,
  Triangle,
  Music2,
  MoreHorizontal,
  Undo2,
  ZoomIn,
  ZoomOut,
  Highlighter,
  Minus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlaybookBottomSheet } from "@/components/portal/playbook-bottom-sheet"
import { useIsLgUp } from "@/lib/hooks/use-media-query"
import { PlaybookFieldSurface, FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { clientToViewBox } from "@/lib/utils/canvas-coords"
import { getPlayFormationDisplayName } from "@/lib/utils/playbook-formation"
import { markerMatchesDepthSlot, type DepthChartSlot } from "@/lib/constants/playbook-positions"
import { getAnimatedPlayerPosition } from "@/lib/utils/play-animation"
import { usePlayAnimation, SPEED_OPTIONS, type PlaybackSpeed } from "@/lib/hooks/use-play-animation"
import type { PlayRecord, PlayCanvasData, RoutePoint, BlockEndPoint, FormationRecord } from "@/types/playbook"

type PresenterTool = "none" | "marker" | "icon"
type InkTool = "pen" | "highlighter" | "line" | "arrow" | "icon"
export type PresenterInkStroke = {
  kind: "freehand" | "line" | "arrow"
  points: { x: number; y: number }[]
  color: string
  width: number
  opacity: number
}

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
  const isLg = useIsLgUp()
  const compactUi = !isLg
  const coord = usePresenterCoord()
  const play = plays[currentIndex]
  const canvasData = play?.canvasData as PlayCanvasData | null
  const players = getPlayersFromCanvas(canvasData, coord)
  const svgRef = useRef<SVGSVGElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef({ x: 0, y: 0 })
  const [annotateOn, setAnnotateOn] = useState(false)
  const [inkTool, setInkTool] = useState<InkTool>("pen")
  const [fingerDraw, setFingerDraw] = useState(false)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [lineDraft, setLineDraft] = useState<{ x: number; y: number } | null>(null)
  const [linePreview, setLinePreview] = useState<{ x: number; y: number } | null>(null)
  const pinchRef = useRef<{ dist: number; zoom: number; panX: number; panY: number; cx: number; cy: number } | null>(null)
  const panDragRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | null>(null)

  const tool: PresenterTool =
    !annotateOn ? "none" : inkTool === "icon" ? "icon" : "marker"
  const [markerColor, setMarkerColor] = useState<string>(MARKER_COLORS[0].value)
  const [inkStrokes, setInkStrokes] = useState<PresenterInkStroke[]>([])
  const [inkUndoStack, setInkUndoStack] = useState<PresenterInkStroke[][]>([])
  const [activeStroke, setActiveStroke] = useState<{ x: number; y: number }[] | null>(null)
  const [strokeWidthIdx, setStrokeWidthIdx] = useState(1)
  const strokeWidths = [2, 4, 7] as const
  const [annotations, setAnnotations] = useState<{ id: string; iconType: string; x: number; y: number }[]>([])
  const [selectedIconType, setSelectedIconType] = useState<string>(ANNOTATION_ICON_TYPES[0].id)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const markerStrokeColor = markerColor
  const inkWidth =
    inkTool === "highlighter" ? Math.max(12, strokeWidths[strokeWidthIdx] * 2.5) : strokeWidths[strokeWidthIdx]
  const inkOpacity = inkTool === "highlighter" ? 0.38 : 1
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
    setInkStrokes([])
    setInkUndoStack([])
    setActiveStroke(null)
    setLineDraft(null)
    setLinePreview(null)
    setPan({ x: 0, y: 0 })
    setZoom(1)
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

  const canDrawWithPointer = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "pen") return true
      if (e.pointerType === "mouse") return true
      if (e.pointerType === "touch" && fingerDraw) return true
      return false
    },
    [fingerDraw]
  )

  const pushInkStroke = useCallback((s: PresenterInkStroke) => {
    setInkStrokes((prev) => {
      setInkUndoStack((u) => [...u, prev])
      return [...prev, s]
    })
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pt = clientToViewBoxPoint(e.clientX, e.clientY)
      if (!pt) return
      if (shiftHeld) return
      if (tool === "marker" && (inkTool === "line" || inkTool === "arrow")) {
        if (!canDrawWithPointer(e)) return
        e.preventDefault()
        setLineDraft(pt)
        setLinePreview(pt)
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      if (tool === "marker" && (inkTool === "pen" || inkTool === "highlighter")) {
        if (!canDrawWithPointer(e)) return
        e.preventDefault()
        setActiveStroke([pt])
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      if (tool === "icon") {
        e.preventDefault()
        const id = `icon-${++annotationIdRef.current}`
        setAnnotations((prev) => [...prev, { id, iconType: selectedIconType, x: pt.x, y: pt.y }])
        setSelectedAnnotationId(id)
      } else {
        setSelectedAnnotationId(null)
      }
    },
    [tool, inkTool, clientToViewBoxPoint, selectedIconType, shiftHeld, canDrawWithPointer]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (shiftHeld) {
        const pt = clientToViewBoxPoint(e.clientX, e.clientY)
        if (pt) setLaserPosition(pt)
        return
      }
      if (tool === "marker" && (inkTool === "line" || inkTool === "arrow") && lineDraft) {
        e.preventDefault()
        const pt = clientToViewBoxPoint(e.clientX, e.clientY)
        if (pt) setLinePreview(pt)
        return
      }
      if (tool !== "marker" || (inkTool !== "pen" && inkTool !== "highlighter") || !activeStroke) return
      e.preventDefault()
      const pt = clientToViewBoxPoint(e.clientX, e.clientY)
      if (pt) setActiveStroke((prev) => (prev ? [...prev, pt] : [pt]))
    },
    [shiftHeld, tool, inkTool, activeStroke, lineDraft, clientToViewBoxPoint]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      if (tool === "marker" && (inkTool === "line" || inkTool === "arrow") && lineDraft && linePreview) {
        const dx = linePreview.x - lineDraft.x
        const dy = linePreview.y - lineDraft.y
        if (Math.hypot(dx, dy) > 4) {
          pushInkStroke({
            kind: inkTool === "arrow" ? "arrow" : "line",
            points: [lineDraft, linePreview],
            color: markerColor,
            width: strokeWidths[strokeWidthIdx],
            opacity: 1,
          })
        }
        setLineDraft(null)
        setLinePreview(null)
        return
      }
      if (
        tool === "marker" &&
        (inkTool === "pen" || inkTool === "highlighter") &&
        activeStroke &&
        activeStroke.length > 0
      ) {
        if (activeStroke.length > 1) {
          pushInkStroke({
            kind: "freehand",
            points: activeStroke,
            color: markerColor,
            width: inkWidth,
            opacity: inkOpacity,
          })
        }
        setActiveStroke(null)
      }
    },
    [
      tool,
      inkTool,
      lineDraft,
      linePreview,
      activeStroke,
      markerColor,
      inkWidth,
      inkOpacity,
      strokeWidthIdx,
      pushInkStroke,
    ]
  )

  const handlePointerLeave = useCallback(() => {
    if (tool === "marker" && (inkTool === "pen" || inkTool === "highlighter") && activeStroke && activeStroke.length > 1) {
      pushInkStroke({
        kind: "freehand",
        points: activeStroke,
        color: markerColor,
        width: inkWidth,
        opacity: inkOpacity,
      })
    }
    setActiveStroke(null)
    setLineDraft(null)
    setLinePreview(null)
  }, [tool, inkTool, activeStroke, markerColor, inkWidth, inkOpacity, pushInkStroke])

  const clearDrawings = useCallback(() => {
    setInkStrokes([])
    setInkUndoStack([])
    setActiveStroke(null)
    setLineDraft(null)
    setLinePreview(null)
    setAnnotations([])
    setSelectedAnnotationId(null)
    setAnnotateOn(false)
    setInkTool("pen")
  }, [])

  const undoLastInk = useCallback(() => {
    setInkUndoStack((stack) => {
      if (stack.length === 0) return stack
      const prev = stack[stack.length - 1]
      setInkStrokes(prev)
      return stack.slice(0, -1)
    })
  }, [])

  const zoomRef = useRef(zoom)
  const panRefState = useRef(pan)
  zoomRef.current = zoom
  panRefState.current = pan

  useEffect(() => {
    if (isLg) {
      setPan({ x: 0, y: 0 })
      setZoom(1)
    }
  }, [isLg])

  const shouldPanFieldPointer = useCallback(
    (e: React.PointerEvent) => {
      if (!compactUi) return false
      if (e.pointerType === "pen") return false
      if (!annotateOn) return true
      if (inkTool === "icon") return false
      if (e.pointerType === "touch" && !fingerDraw) return true
      return false
    },
    [compactUi, annotateOn, inkTool, fingerDraw]
  )

  const onViewportPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (!shouldPanFieldPointer(e)) return
      if ((e.target as HTMLElement).closest("[data-timeline]")) return
      panDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX: panRefState.current.x,
        panY: panRefState.current.y,
      }
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      e.preventDefault()
      e.stopPropagation()
    },
    [shouldPanFieldPointer]
  )

  const onViewportPointerMove = useCallback((e: React.PointerEvent) => {
    const d = panDragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    setPan({
      x: d.panX + (e.clientX - d.startX),
      y: d.panY + (e.clientY - d.startY),
    })
  }, [])

  const onViewportPointerUp = useCallback((e: React.PointerEvent) => {
    const d = panDragRef.current
    if (d?.pointerId === e.pointerId) panDragRef.current = null
    try {
      ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onViewportWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!compactUi) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.08 : 0.08
      setZoom((z) => Math.min(2.5, Math.max(0.65, z + delta)))
    },
    [compactUi]
  )

  const onTouchPinch = useCallback((e: React.TouchEvent) => {
    if (!compactUi || e.touches.length !== 2) return
    const a = e.touches[0]
    const b = e.touches[1]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    if (e.type === "touchstart") {
      pinchRef.current = { dist, zoom: zoomRef.current, panX: panRefState.current.x, panY: panRefState.current.y, cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2 }
    } else if (pinchRef.current && e.type === "touchmove") {
      const p = pinchRef.current
      const scale = dist / p.dist
      const nz = Math.min(2.5, Math.max(0.65, p.zoom * scale))
      setZoom(nz)
    }
    if (e.type === "touchend" || e.type === "touchcancel") pinchRef.current = null
  }, [compactUi])

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
        if (moreSheetOpen) {
          setMoreSheetOpen(false)
          return
        }
        if (annotateOn) {
          setAnnotateOn(false)
          return
        }
        setSelectedAnnotationId(null)
        if (embedded && fullscreen) {
          /* parent may handle fullscreen exit */
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
  }, [onClose, goPrev, goNext, selectedAnnotationId, removeSelectedAnnotation, embedded, fullscreen, isAnimationPlaying, animationPlay, animationPause, animationRestart, moreSheetOpen, annotateOn])

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
      {!embedded && isLg && (
        <div className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(5.5rem,env(safe-area-inset-right))] bg-slate-950/92 backdrop-blur-xl border-b border-slate-800/80">
          <Button variant="secondary" size="sm" onClick={onClose} className="shadow-lg border-slate-700 bg-slate-800 text-slate-100">
            <X className="h-4 w-4 mr-1" />
            Exit
          </Button>
          <div className="flex items-center gap-1 rounded-xl bg-slate-800/90 px-2 py-1 border border-slate-700">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-200" onClick={goPrev} disabled={currentIndex <= 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium min-w-[72px] text-center text-slate-300">
              {currentIndex + 1} / {plays.length}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-200" onClick={goNext} disabled={currentIndex >= plays.length - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <label className="text-xs text-slate-400 flex items-center gap-1">
            View as
            <select
              value={viewAsValue}
              onChange={(e) => setViewAsValue(e.target.value)}
              className="h-8 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-2 text-xs min-w-[120px]"
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
            Highlight
            <select
              value={highlightedGroup}
              onChange={(e) => setHighlightedGroup(e.target.value)}
              className="h-8 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-2 text-xs min-w-[64px]"
            >
              {PLAYER_GROUP_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <Button
            variant={annotateOn ? "default" : "outline"}
            size="sm"
            className={annotateOn ? "bg-amber-600 hover:bg-amber-500" : "border-slate-600 text-slate-200"}
            onClick={() => setAnnotateOn((a) => !a)}
          >
            Annotate
          </Button>
          {annotateOn && (
            <>
              <div className="flex rounded-lg border border-slate-600 overflow-hidden">
                {(
                  [
                    { id: "pen" as const, Icon: Pencil },
                    { id: "highlighter" as const, Icon: Highlighter },
                    { id: "line" as const, Icon: Minus },
                    { id: "arrow" as const, Icon: ArrowRight },
                    { id: "icon" as const, Icon: Flag },
                  ] as const
                ).map(({ id, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInkTool(id)}
                    className={`p-2 ${inkTool === id ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}
                    title={id}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <label className="text-xs text-slate-400 flex items-center gap-1">
                Color
                <select
                  value={markerColor}
                  onChange={(e) => setMarkerColor(e.target.value)}
                  className="h-8 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-1 text-xs min-w-[72px]"
                >
                  {MARKER_COLORS.map((c) => (
                    <option key={c.value} value={c.value}>{c.name}</option>
                  ))}
                </select>
              </label>
              <select
                value={selectedIconType}
                onChange={(e) => setSelectedIconType(e.target.value)}
                className="h-8 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-1 text-xs min-w-[80px]"
              >
                {ANNOTATION_ICON_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-200 h-8" onClick={undoLastInk} disabled={inkUndoStack.length === 0}>
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Undo
              </Button>
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-200 h-8" onClick={clearDrawings}>
                Clear
              </Button>
              {selectedAnnotationId && (
                <Button variant="outline" size="sm" className="border-slate-600 h-8" onClick={removeSelectedAnnotation}>
                  Remove icon
                </Button>
              )}
              <label className="flex items-center gap-1 text-xs text-slate-400">
                <input type="checkbox" checked={fingerDraw} onChange={(e) => setFingerDraw(e.target.checked)} className="rounded" />
                Finger draw
              </label>
            </>
          )}
        </div>
      )}
      {!embedded && !isLg && (
        <header className="flex-shrink-0 z-30 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-xl px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="h-10 rounded-2xl shadow-lg border-slate-700 bg-slate-800 text-slate-100 px-3"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl border-slate-600 bg-slate-800/90 text-slate-200 shadow-md"
                onClick={() => setMoreSheetOpen(true)}
                title="Presentation options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 min-w-0 text-center px-1">
              <p className="text-sm font-semibold text-slate-100 truncate">{play.name}</p>
              <p className="text-[11px] text-slate-500 truncate tabular-nums">
                {getPlayFormationDisplayName(play, formations)}
                {plays.length > 1 ? ` · ${currentIndex + 1}/${plays.length}` : ""}
              </p>
            </div>
            <div className="w-12 sm:w-16 shrink-0" aria-hidden />
          </div>
        </header>
      )}
      {embedded && isLg && (
        <div
          className={
            fullscreen
              ? "fixed top-0 left-0 right-0 z-20 flex flex-wrap items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(5.5rem,env(safe-area-inset-right))] bg-slate-950/95 backdrop-blur-xl border-b border-slate-800"
              : "flex-shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-950/95 border-b border-slate-800"
          }
        >
          <label className="text-xs text-slate-400 flex items-center gap-1">
            View as
            <select
              value={viewAsValue}
              onChange={(e) => setViewAsValue(e.target.value)}
              className="h-8 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-2 text-xs min-w-[120px]"
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
            Highlight
            <select
              value={highlightedGroup}
              onChange={(e) => setHighlightedGroup(e.target.value)}
              className="h-8 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-1.5 text-xs min-w-[68px]"
            >
              {PLAYER_GROUP_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <Button
            variant={annotateOn ? "default" : "outline"}
            size="sm"
            className={annotateOn ? "bg-amber-600" : "border-slate-600 text-slate-200 h-8"}
            onClick={() => setAnnotateOn((a) => !a)}
          >
            Annotate
          </Button>
          {annotateOn && (
            <>
              <div className="flex rounded-lg border border-slate-600 overflow-hidden">
                {(
                  [
                    { id: "pen" as const, Icon: Pencil },
                    { id: "highlighter" as const, Icon: Highlighter },
                    { id: "line" as const, Icon: Minus },
                    { id: "arrow" as const, Icon: ArrowRight },
                    { id: "icon" as const, Icon: Flag },
                  ] as const
                ).map(({ id, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInkTool(id)}
                    className={`p-2 ${inkTool === id ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-400"}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <select
                value={markerColor}
                onChange={(e) => setMarkerColor(e.target.value)}
                className="h-8 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-1 text-xs min-w-[72px]"
              >
                {MARKER_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>{c.name}</option>
                ))}
              </select>
              <Button variant="outline" size="icon" className="h-8 w-8 border-slate-600" onClick={undoLastInk} disabled={inkUndoStack.length === 0}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 border-slate-600" onClick={clearDrawings}>
                <Eraser className="h-4 w-4" />
              </Button>
              <select
                value={selectedIconType}
                onChange={(e) => setSelectedIconType(e.target.value)}
                className="h-8 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 px-1 text-xs min-w-[72px]"
              >
                {ANNOTATION_ICON_TYPES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-[10px] text-slate-500">
                <input type="checkbox" checked={fingerDraw} onChange={(e) => setFingerDraw(e.target.checked)} />
                Finger
              </label>
            </>
          )}
          {selectedAnnotationId && annotateOn && (
            <Button variant="outline" size="sm" className="h-8 border-slate-600 text-xs" onClick={removeSelectedAnnotation}>
              Remove icon
            </Button>
          )}
        </div>
      )}
      {embedded && !isLg && (
        <header className="flex-shrink-0 z-30 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-xl px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="h-10 rounded-2xl border-slate-700 bg-slate-800 text-slate-100 px-3" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl border-slate-600 bg-slate-800/90 text-slate-200"
              onClick={() => setMoreSheetOpen(true)}
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0 text-center">
              <p className="text-sm font-semibold text-slate-100 truncate">{play.name}</p>
            </div>
            <div className="w-10 shrink-0" aria-hidden />
          </div>
        </header>
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

      <div
        ref={viewportRef}
        className={`flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden touch-none ${compactUi ? "" : ""} ${embedded ? "p-1 md:p-2" : isLg ? "p-2 pt-14" : "p-1"}`}
        onPointerDownCapture={onViewportPointerDownCapture}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerCancel={onViewportPointerUp}
        onWheel={onViewportWheel}
        onTouchStart={onTouchPinch}
        onTouchMove={onTouchPinch}
        onTouchEnd={onTouchPinch}
      >
        <div className="flex-1 flex items-center justify-center min-h-0 min-w-0 w-full">
          <div
            className="w-full max-w-full min-w-0 max-h-full flex items-center justify-center"
            style={{
              transform: compactUi ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : undefined,
              transformOrigin: "center center",
            }}
          >
            <div
              className={`w-full min-w-0 aspect-[53.33/35] max-h-full overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.45)] ring-1 ${
                embedded && fullscreen
                  ? "max-w-[min(96vw,1200px)] max-h-[min(78vh,900px)] ring-slate-700/60"
                  : embedded
                    ? "max-w-full max-h-[min(70vh,560px)] lg:max-h-[min(82vh,720px)] lg:max-w-5xl ring-slate-700/40"
                    : isLg
                      ? "max-w-5xl max-h-[min(82vh,720px)] ring-slate-600/30"
                      : "max-w-full max-h-[calc(100dvh-200px)] ring-slate-700/50"
              }`}
            >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
            className="w-full h-full touch-manipulation"
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
            {inkStrokes.map((stroke, i) => {
              if (stroke.kind === "freehand" && stroke.points.length > 1) {
                return (
                  <polyline
                    key={i}
                    points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                    strokeOpacity={stroke.opacity}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: "none" }}
                  />
                )
              }
              if ((stroke.kind === "line" || stroke.kind === "arrow") && stroke.points.length >= 2) {
                const [a, b] = stroke.points
                const ang = Math.atan2(b.y - a.y, b.x - a.x)
                const ah = 14
                const aw = 8
                const x1 = b.x - ah * Math.cos(ang)
                const y1 = b.y - ah * Math.sin(ang)
                return (
                  <g key={i} style={{ pointerEvents: "none" }}>
                    <line x1={a.x} y1={a.y} x2={stroke.kind === "arrow" ? x1 : b.x} y2={stroke.kind === "arrow" ? y1 : b.y} stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" />
                    {stroke.kind === "arrow" && (
                      <polygon
                        points={`${b.x},${b.y} ${x1 + aw * Math.sin(ang)},${y1 - aw * Math.cos(ang)} ${x1 - aw * Math.sin(ang)},${y1 + aw * Math.cos(ang)}`}
                        fill={stroke.color}
                      />
                    )}
                  </g>
                )
              }
              return null
            })}
            {lineDraft && linePreview && (
              <g pointerEvents="none">
                <line
                  x1={lineDraft.x}
                  y1={lineDraft.y}
                  x2={inkTool === "arrow" ? linePreview.x - 12 * Math.cos(Math.atan2(linePreview.y - lineDraft.y, linePreview.x - lineDraft.x)) : linePreview.x}
                  y2={inkTool === "arrow" ? linePreview.y - 12 * Math.sin(Math.atan2(linePreview.y - lineDraft.y, linePreview.x - lineDraft.x)) : linePreview.y}
                  stroke={markerStrokeColor}
                  strokeWidth={strokeWidths[strokeWidthIdx]}
                  strokeDasharray="6 4"
                  opacity={0.85}
                />
              </g>
            )}
            {activeStroke && activeStroke.length > 1 && (
              <polyline
                points={activeStroke.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={markerStrokeColor}
                strokeWidth={inkWidth}
                strokeOpacity={inkOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: "none" }}
              />
            )}
            <rect
              width={VIEWBOX_W}
              height={VIEWBOX_H}
              fill="transparent"
              pointerEvents={
                annotateOn && (inkTool === "pen" || inkTool === "highlighter" || inkTool === "line" || inkTool === "arrow" || inkTool === "icon")
                  ? "all"
                  : "none"
              }
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
        </div>
      </div>

      <div
        data-presenter-dock
        className={
          compactUi
            ? "fixed left-0 right-0 bottom-0 z-40 flex flex-col gap-2 px-2 sm:px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-950 via-slate-950/98 to-slate-950/85 backdrop-blur-xl border-t border-slate-800/90 max-w-[100vw] overflow-x-auto"
            : fullscreen
              ? "fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 w-full max-w-3xl px-4 pr-[max(3rem,env(safe-area-inset-right))]"
              : "absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 w-full max-w-3xl px-4"
        }
      >
        <div className="w-full max-w-lg mx-auto flex flex-col gap-1.5" data-timeline>
          <div
            ref={timelineRef}
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={animationProgress}
            tabIndex={0}
            className="relative h-4 sm:h-5 w-full rounded-full bg-slate-800/95 cursor-pointer touch-none flex items-center overflow-visible ring-1 ring-slate-700/80"
            onPointerDown={handleTimelinePointerDown}
            onPointerMove={handleTimelinePointerMove}
            onPointerUp={handleTimelinePointerUp}
            onPointerLeave={handleTimelinePointerUp}
            onPointerCancel={handleTimelinePointerUp}
          >
            <div
              className="h-full rounded-full bg-emerald-600/90 transition-none pointer-events-none"
              style={{ width: `${animationProgress * 100}%` }}
            />
            <div
              className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-700 shadow-md -translate-y-1/2 -translate-x-1/2 pointer-events-none"
              style={{ left: `${animationProgress * 100}%` }}
            />
          </div>
        </div>
        <div
          className={`flex flex-nowrap items-center justify-center gap-1 sm:gap-1.5 mx-auto rounded-2xl px-2 py-1.5 shadow-lg border border-slate-700/60 bg-slate-900/95 backdrop-blur-md ${
            compactUi ? "min-w-0 max-w-full overflow-x-auto" : ""
          }`}
        >
          {plays.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-xl text-slate-200 hover:bg-slate-800"
                onClick={goPrev}
                disabled={currentIndex <= 0}
                title="Previous play"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-xl text-slate-200 hover:bg-slate-800" onClick={animationStepToStart} title="Start">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-xl text-slate-200 hover:bg-slate-800" onClick={animationStepBackward} title="Step back">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          {isAnimationPlaying ? (
            <Button size="icon" className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg" onClick={animationPause} title="Pause">
              <Pause className="h-5 w-5" />
            </Button>
          ) : (
            <Button size="icon" className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg" onClick={animationPlay} title="Play">
              <Play className="h-5 w-5 ml-0.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-xl text-slate-200 hover:bg-slate-800" onClick={animationStepForward} title="Step forward">
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-xl text-slate-200 hover:bg-slate-800" onClick={animationRestart} title="Replay">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <select
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(Number(e.target.value) as PlaybackSpeed)}
            className="h-9 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 px-2 text-xs font-semibold min-w-[52px] shrink-0"
            title="Speed"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
          <Button
            variant={annotateOn ? "default" : "ghost"}
            size="icon"
            className={`h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-xl ${annotateOn ? "bg-amber-500 hover:bg-amber-400 text-slate-900" : "text-slate-200 hover:bg-slate-800"}`}
            onClick={() => setAnnotateOn((a) => !a)}
            title="Annotate (stylus / pen)"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {compactUi && (
            <>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl text-slate-200 hover:bg-slate-800" onClick={() => setZoom((z) => Math.min(2.5, z + 0.12))} title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl text-slate-200 hover:bg-slate-800" onClick={() => setZoom((z) => Math.max(0.65, z - 0.12))} title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl text-slate-200 hover:bg-slate-800" onClick={() => setMoreSheetOpen(true)} title="More">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </>
          )}
          {!compactUi && (
            <>
              <Button variant={animationLoop ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-xl text-slate-200" onClick={() => setAnimationLoop(!animationLoop)} title="Loop">
                <Repeat className="h-4 w-4" />
              </Button>
              <Button variant={showRoutes ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-xl text-slate-200" onClick={() => setShowRoutes((v) => !v)} title="Routes">
                <Route className="h-4 w-4" />
              </Button>
            </>
          )}
          {plays.length > 1 && (
            <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-xl text-slate-200 hover:bg-slate-800" onClick={goNext} disabled={currentIndex >= plays.length - 1} title="Next play">
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>
        {annotateOn && compactUi && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 px-1 pb-1">
            <div className="flex rounded-xl border border-slate-600 overflow-hidden bg-slate-800/80">
              {(
                [
                  { id: "pen" as const, Icon: Pencil, label: "Pen" },
                  { id: "highlighter" as const, Icon: Highlighter, label: "Hi" },
                  { id: "line" as const, Icon: Minus, label: "Line" },
                  { id: "arrow" as const, Icon: ArrowRight, label: "Arrow" },
                  { id: "icon" as const, Icon: Flag, label: "Icon" },
                ] as const
              ).map(({ id, Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInkTool(id)}
                  className={`px-3 py-2 text-[10px] font-bold uppercase flex flex-col items-center gap-0.5 min-w-[3rem] ${
                    inkTool === id ? "bg-amber-500/25 text-amber-300" : "text-slate-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="h-9 rounded-xl border-slate-600 text-slate-200" onClick={undoLastInk} disabled={inkUndoStack.length === 0}>
              <Undo2 className="h-4 w-4 mr-1" />
              Undo
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl border-slate-600 text-slate-200" onClick={clearDrawings}>
              Clear
            </Button>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 px-2">
              <input type="checkbox" checked={fingerDraw} onChange={(e) => setFingerDraw(e.target.checked)} className="rounded border-slate-500" />
              Draw w/ finger
            </label>
          </div>
        )}
        {isLg && !compactUi && (
          <p className="text-[11px] text-slate-500 text-center">
            {animationState} · {animationSpeed}x{animationLoop ? " · loop" : ""} · routes {showRoutes ? "on" : "off"}
          </p>
        )}
      </div>

      {isLg && (
        <div
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border border-slate-800/80 bg-slate-950/75 backdrop-blur-sm ${
            embedded && fullscreen ? "bottom-28" : "bottom-24"
          } max-w-[90vw]`}
        >
          <p className="text-center text-sm font-semibold text-slate-100 truncate">{play.name}</p>
          <p className="text-center text-xs text-slate-500 truncate">{getPlayFormationDisplayName(play, formations)} · {play.side.replace("_", " ")}</p>
        </div>
      )}

      <PlaybookBottomSheet variant="dark" open={moreSheetOpen} onOpenChange={setMoreSheetOpen} title="Presentation & annotate">
        <div className="flex flex-col gap-4 text-slate-200">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">View as</span>
            <select
              value={viewAsValue}
              onChange={(e) => setViewAsValue(e.target.value)}
              className="h-11 rounded-xl border border-slate-600 bg-slate-800 px-3 text-base"
            >
              <option value="">All players</option>
              {viewAsRoleOptions.map((opt) => (
                <option key={opt.id} value={`role:${opt.id}`}>{opt.displayLabel}</option>
              ))}
              {viewAsPlayerOptions.map((opt) => (
                <option key={opt.id} value={`player:${opt.id}`}>{opt.displayLabel}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Highlight group</span>
            <select
              value={highlightedGroup}
              onChange={(e) => setHighlightedGroup(e.target.value)}
              className="h-11 rounded-xl border border-slate-600 bg-slate-800 px-3"
            >
              {PLAYER_GROUP_OPTIONS.map((opt) => (
                <option key={opt.value || "n"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Ink color</span>
            <select value={markerColor} onChange={(e) => setMarkerColor(e.target.value)} className="h-11 rounded-xl border border-slate-600 bg-slate-800 px-3">
              {MARKER_COLORS.map((c) => (
                <option key={c.value} value={c.value}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Line weight</span>
            <div className="flex gap-2">
              {strokeWidths.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setStrokeWidthIdx(i)}
                  className={`flex-1 h-11 rounded-xl border font-medium ${strokeWidthIdx === i ? "border-amber-500 bg-amber-500/15" : "border-slate-600 bg-slate-800"}`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Field icon</span>
            <select value={selectedIconType} onChange={(e) => setSelectedIconType(e.target.value)} className="h-11 rounded-xl border border-slate-600 bg-slate-800 px-3">
              {ANNOTATION_ICON_TYPES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fingerDraw} onChange={(e) => setFingerDraw(e.target.checked)} className="rounded border-slate-500 h-4 w-4" />
            Allow finger drawing (stylus still preferred)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-slate-600 text-slate-200 rounded-xl" onClick={() => setAnimationLoop((l) => !l)}>
              <Repeat className="h-4 w-4 mr-2" />
              {animationLoop ? "Loop on" : "Loop off"}
            </Button>
            <Button variant="outline" className="border-slate-600 text-slate-200 rounded-xl" onClick={() => setShowRoutes((v) => !v)}>
              <Route className="h-4 w-4 mr-2" />
              Routes {showRoutes ? "on" : "off"}
            </Button>
          </div>
          {plays.length > 1 && (
            <div className="flex items-center justify-center gap-3 py-2">
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-slate-600" onClick={goPrev} disabled={currentIndex <= 0}>
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <span className="text-slate-300 font-semibold tabular-nums">
                {currentIndex + 1} / {plays.length}
              </span>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-slate-600" onClick={goNext} disabled={currentIndex >= plays.length - 1}>
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 rounded-xl bg-slate-700" onClick={undoLastInk} disabled={inkUndoStack.length === 0}>
              <Undo2 className="h-4 w-4 mr-2" />
              Undo stroke
            </Button>
            <Button variant="destructive" className="flex-1 rounded-xl" onClick={clearDrawings}>
              Clear annotations
            </Button>
          </div>
          {selectedAnnotationId && (
            <Button variant="outline" className="w-full border-slate-600 rounded-xl" onClick={removeSelectedAnnotation}>
              Remove selected icon
            </Button>
          )}
        </div>
      </PlaybookBottomSheet>
    </div>
  )
}
