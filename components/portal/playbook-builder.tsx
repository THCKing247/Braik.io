"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Square, Move, Pencil, RotateCcw, RotateCw, Save, X, Circle, Maximize2, Minimize2, Users, Check, Ban, Clock, MoreHorizontal, Pen, ArrowRight, Undo2, Eraser } from "lucide-react"
import { PlaybookFieldSurface, FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { clientToViewBox as clientToViewBoxLib } from "@/lib/utils/canvas-coords"
import {
  type InkSample,
  smoothFreehandPath,
  convertPathToRoute,
  findNearestPlayerOrigin,
  type XY,
} from "@/lib/utils/freehand-route"
import {
  getAnimatedPlayerPosition,
  hasCustomAnimationTiming,
  formatAnimationTimingSummary,
  type PlayerPathSource,
} from "@/lib/utils/play-animation"
import { PlaybookFileTree } from "@/components/portal/playbook-file-tree"
import { PlaybookShapePalette } from "@/components/portal/playbook-shape-palette"
import { PlaybookBottomSheet } from "@/components/portal/playbook-bottom-sheet"
import { validateTemplateSave } from "@/lib/utils/playbook-validation"
import {
  getPositionByCode,
  getDisplayLabel,
  getNextPositionNumber,
  getPositionsForUnit,
  hasDuplicateRoleLabel,
  getPlayerForSlot,
  type DepthChartSlot,
} from "@/lib/constants/playbook-positions"
import { getPresetPointsTranslated } from "@/lib/utils/route-presets"

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
  x: number
  y: number
  xYards?: number
  yYards?: number
  label: string
  shape: "circle" | "square" | "triangle"
  playerType?: "skill" | "lineman"
  route?: Array<{ x: number; y: number; t: number } | { xYards: number; yYards: number; t: number }>
  blockingLine?: { x: number; y: number } | { xYards: number; yYards: number }
  technique?: string
  gap?: string
  positionCode?: string | null
  positionNumber?: number | null
  animationTiming?: { startDelay?: number; durationScale?: number }
  preSnapMotion?: { points: Array<{ x?: number; y?: number; xYards: number; yYards: number; t: number }>; duration?: number }
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
  onSave: (data: CanvasData, playName: string) => void | Promise<void>
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
  /** When selection changes, report selected marker for inspector (role, positionCode, positionNumber, hasDuplicateRole, animationTiming). */
  onSelectPlayer?: (player: {
    id: string
    label: string
    shape: string
    positionCode?: string | null
    positionNumber?: number | null
    hasDuplicateRole?: boolean
    animationTiming?: { startDelay?: number; durationScale?: number }
  } | null) => void
  /** Depth chart for assignment status indicators on markers (assigned / unassigned). */
  depthChartEntries?: DepthChartSlot[] | null
  /** When true, select the first unassigned position-based marker once (e.g. from "Review assignments"). */
  focusUnassignedOnce?: boolean
  /** Call after focusing first unassigned so the flag is cleared. */
  onClearFocusUnassigned?: () => void
  /** Stable key for the play/formation being edited. When this changes we sync from playData; when it doesn't we keep local state (e.g. just-finished route/block). */
  editorSourceKey?: string | null
  /** When true, show animation preview: markers at derived positions, optional route visibility, editing disabled. */
  previewMode?: boolean
  /** Animation progress in [0, 1]. Used only when previewMode is true. */
  animationProgress?: number
  /** When false and previewMode, hide route and blocking lines. Used only when previewMode is true. */
  showRoutesInPreview?: boolean
  /** Called when the user edits content (players, name, zones, etc.). Not called when syncing from props or resize. */
  onDirty?: () => void
  /** When set, apply this route preset to the given player (e.g. from route library). Cleared after applying. */
  appliedRoutePreset?: { playerId: string; presetId: string } | null
  /** Call after applying appliedRoutePreset so parent can clear it. */
  onClearAppliedRoutePreset?: () => void
  /** Optional ref the builder will set to its save function so the parent can trigger save (e.g. auto-save). */
  triggerSaveRef?: React.MutableRefObject<(() => void | Promise<void>) | null>
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
  onSelectPlayer,
  depthChartEntries,
  focusUnassignedOnce = false,
  onClearFocusUnassigned,
  editorSourceKey,
  previewMode = false,
  animationProgress: previewProgress = 0,
  showRoutesInPreview = true,
  onDirty,
  appliedRoutePreset,
  onClearAppliedRoutePreset,
  triggerSaveRef,
}: PlaybookBuilderProps) {
  const [tool, setTool] = useState<string>("select")
  const [currentSide, setCurrentSide] = useState(side)
  const [playName, setPlayName] = useState(initialPlayName || "")
  const [templateNameState, setTemplateNameState] = useState(templateName || formation || "")
  const [players, setPlayers] = useState<Player[]>(playData?.players || [])
  const [zones, setZones] = useState<Zone[]>(playData?.zones || [])
  const [manCoverages, setManCoverages] = useState<ManCoverage[]>(playData?.manCoverages || [])
  const isSyncingFromPropsRef = useRef(false)
  const initialSyncDoneRef = useRef(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationMode, setAnimationMode] = useState<"all" | "skill" | "linemen">("all")
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [manCoverageStart, setManCoverageStart] = useState<string | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false)
  const [mobileEditorMenuOpen, setMobileEditorMenuOpen] = useState(false)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState("")
  const playersRef = useRef<Player[]>(players)
  playersRef.current = players

  // Draft state: freehand route (pointer-up commits); block/motion still click-based
  const [blockDraft, setBlockDraft] = useState<{ playerId: string; endPoint: PointPX } | null>(null)
  const [motionDraft, setMotionDraft] = useState<{ playerId: string; points: PointPX[] } | null>(null)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null)
  /** Live polyline while drawing route / draw / arrow (60fps throttled). */
  const [liveStrokePreview, setLiveStrokePreview] = useState<XY[] | null>(null)
  const [liveStrokeKind, setLiveStrokeKind] = useState<"route" | "draw" | "arrow" | null>(null)
  const [liveStrokePlayerId, setLiveStrokePlayerId] = useState<string | null>(null)
  const [allowFingerDrawing, setAllowFingerDrawing] = useState(false)
  const [fieldPan, setFieldPan] = useState({ x: 0, y: 0 })
  const [tabletRailRight, setTabletRailRight] = useState(true)
  type EditorInkStroke = {
    kind: "freehand" | "arrow"
    points: XY[]
    pressures?: number[]
    color: string
    width: number
    opacity: number
  }
  const [editorInkStrokes, setEditorInkStrokes] = useState<EditorInkStroke[]>([])
  const [editorInkUndoStack, setEditorInkUndoStack] = useState<EditorInkStroke[][]>([])
  const DRAW_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#fafafa", "#171717"] as const
  const [drawColorIdx, setDrawColorIdx] = useState(0)
  const drawColor = DRAW_COLORS[drawColorIdx % DRAW_COLORS.length]
  const strokeWidthChoices = [2, 4, 7] as const
  const [drawWidthIdx, setDrawWidthIdx] = useState(1)
  const drawStrokeWidth = strokeWidthChoices[drawWidthIdx % strokeWidthChoices.length]

  const activePenIdsRef = useRef<Set<number>>(new Set())
  const freehandSamplesRef = useRef<InkSample[]>([])
  const freehandMetaRef = useRef<{ kind: "route" | "draw"; playerId?: string; pointerId: number } | null>(null)
  const arrowDragRef = useRef<{ start: XY; pointerId: number } | null>(null)
  const previewRafRef = useRef<number | null>(null)
  const panDragRef = useRef<{ pointerId: number; sx: number; sy: number; px: number; py: number } | null>(null)

  useEffect(() => {
    try {
      const v = localStorage.getItem("playbook-allow-finger-draw")
      setAllowFingerDrawing(v === "1")
    } catch {
      /* ignore */
    }
  }, [])
  const setFingerDrawPref = useCallback((on: boolean) => {
    setAllowFingerDrawing(on)
    try {
      localStorage.setItem("playbook-allow-finger-draw", on ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [])

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

  // Update coordinate system and field dimensions from the actual canvas (SVG) size so pointer math
  // and viewBox stay in sync. Use the SVG's getBoundingClientRect() when available so we use the
  // same element for both dimension updates and clientToViewBox (avoids offset/stretch after stacked layout).
  useEffect(() => {
    const updateDimensions = () => {
      requestAnimationFrame(() => {
        const canvasEl = canvasRef.current
        const containerEl = containerRef.current
        if (!canvasEl && !containerEl) return
        const rect = canvasEl ? canvasEl.getBoundingClientRect() : { width: containerEl!.clientWidth, height: containerEl!.clientHeight }
        const availableWidth = rect.width
        const availableHeight = rect.height
        const fieldAspectRatio = FIELD_WIDTH_YARDS / VISIBLE_YARDS
        let width = availableWidth
        let height = availableHeight
        if (width / height > fieldAspectRatio) {
          width = height * fieldAspectRatio
        } else {
          height = width / fieldAspectRatio
        }
        setFieldDimensions({ width, height })
        setCoordSystem(new FieldCoordinateSystem(width, height, yardLineStart, yardLineEnd))
      })
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    const el = containerRef.current
    const ro = el ? new ResizeObserver(updateDimensions) : null
    if (el && ro) ro.observe(el)
    return () => {
      window.removeEventListener("resize", updateDimensions)
      ro?.disconnect()
    }
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

  const schedulePreviewFlush = useCallback(() => {
    if (previewRafRef.current != null) return
    previewRafRef.current = requestAnimationFrame(() => {
      previewRafRef.current = null
      const samples = freehandSamplesRef.current
      if (samples.length === 0) return
      setLiveStrokePreview(samples.map((s) => ({ x: s.x, y: s.y })))
    })
  }, [])

  const cancelRouteDraft = useCallback(() => {
    freehandSamplesRef.current = []
    freehandMetaRef.current = null
    arrowDragRef.current = null
    setLiveStrokePreview(null)
    setLiveStrokeKind(null)
    setLiveStrokePlayerId(null)
    setCursorPosition(null)
  }, [])

  const pushEditorInk = useCallback((s: EditorInkStroke) => {
    setEditorInkStrokes((prev) => {
      setEditorInkUndoStack((u) => [...u, prev])
      return [...prev, s]
    })
  }, [])

  const undoEditorInk = useCallback(() => {
    setEditorInkUndoStack((stack) => {
      if (stack.length === 0) return stack
      const prev = stack[stack.length - 1]
      setEditorInkStrokes(prev)
      return stack.slice(0, -1)
    })
  }, [])

  const clearEditorInk = useCallback(() => {
    setEditorInkStrokes((prev) => {
      if (prev.length) setEditorInkUndoStack((u) => [...u, prev])
      return []
    })
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

  const cancelMotionDraft = useCallback(() => {
    setMotionDraft(null)
    setCursorPosition(null)
    setSelectedPlayerId(null)
  }, [])

  const canFinishMotionDraft = motionDraft && motionDraft.points.length >= 2
  const finishMotionDraft = useCallback(() => {
    if (!motionDraft || motionDraft.points.length < 2) return
    const pts = motionDraft.points
    pushHistory()
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === motionDraft.playerId
          ? {
              ...p,
              preSnapMotion: {
                points: pts.map((pt, i) => ({
                  x: pt.x,
                  y: pt.y,
                  xYards: pt.xYards,
                  yYards: pt.yYards,
                  t: pts.length === 1 ? 1 : i / (pts.length - 1),
                })),
              },
            }
          : p
      )
    )
    setMotionDraft(null)
  }, [motionDraft, pushHistory])

  const saveHandlerRef = useRef<() => void | Promise<void>>(() => {})

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const inInput = document.activeElement && (
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement).getAttribute?.("contenteditable") === "true"
      )
      if (inInput) {
        if (e.key === "Escape") (document.activeElement as HTMLElement)?.blur?.()
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        if (liveStrokeKind || blockDraft || motionDraft) {
          cancelRouteDraft()
          cancelBlockDraft()
          cancelMotionDraft()
        } else {
          setSelectedPlayerId(null)
          setSelectedZoneId(null)
          setTool("select")
        }
        return
      }
      if (e.key === "Enter") {
        if (blockDraft) {
          e.preventDefault()
          finishBlockDraft()
        } else if (canFinishMotionDraft) {
          e.preventDefault()
          finishMotionDraft()
        }
        return
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s") {
          e.preventDefault()
          saveHandlerRef.current?.()
          return
        }
        if (e.key === "z") {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
          return
        }
        if (e.key === "y") {
          e.preventDefault()
          redo()
          return
        }
        return
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        if (liveStrokeKind || blockDraft) {
          cancelRouteDraft()
          cancelBlockDraft()
          return
        }
        if (selectedPlayerId && !isTemplateMode) {
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === selectedPlayerId ? { ...p, route: undefined, blockingLine: undefined } : p
            )
          )
          pushHistory()
          setSelectedPlayerId(null)
          return
        }
        if (selectedZoneId && !isTemplateMode) {
          setZones((prev) => prev.filter((z) => z.id !== selectedZoneId))
          setSelectedZoneId(null)
          pushHistory()
          return
        }
        return
      }

      const key = e.key.toLowerCase()
      if (key === "v") { e.preventDefault(); setTool("select"); cancelRouteDraft(); cancelBlockDraft(); cancelMotionDraft() }
      else if (key === "r") { e.preventDefault(); setTool("route"); cancelRouteDraft(); cancelBlockDraft(); cancelMotionDraft() }
      else if (key === "b") { e.preventDefault(); setTool("block"); cancelRouteDraft(); cancelBlockDraft(); cancelMotionDraft() }
      else if (key === "m") { e.preventDefault(); setTool("motion"); cancelRouteDraft(); cancelBlockDraft(); cancelMotionDraft() }
      else if (key === "z" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setTool("zone"); cancelRouteDraft(); cancelBlockDraft(); cancelMotionDraft() }
      else if (key === "t") { e.preventDefault(); setTool("select"); cancelRouteDraft(); cancelBlockDraft(); cancelMotionDraft() }
      else if (key === "e") { e.preventDefault(); setTool("erase"); cancelRouteDraft(); cancelBlockDraft(); cancelMotionDraft() }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [liveStrokeKind, blockDraft, motionDraft, canFinishMotionDraft, finishBlockDraft, finishMotionDraft, cancelRouteDraft, cancelBlockDraft, cancelMotionDraft, undo, redo, pushHistory, isTemplateMode, selectedPlayerId, selectedZoneId])

  // Sync from prop only when we switch to a different play/formation (editorSourceKey change). Otherwise we'd overwrite local edits (e.g. just-finished route/block) whenever the parent re-renders with a new playData reference (e.g. new play or formation mode).
  const lastSyncedSourceKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const sourceKey = editorSourceKey ?? playId ?? (isTemplateMode ? `formation-${templateName}` : "new-play")
    if (!playData) {
      lastSyncedSourceKeyRef.current = null
      return
    }
    if (lastSyncedSourceKeyRef.current === sourceKey) return
    lastSyncedSourceKeyRef.current = sourceKey
    isSyncingFromPropsRef.current = true
    // Source of truth: yard coordinates. For position-based markers, label is derived from positionCode/positionNumber to prevent drift.
    const convertedPlayers = playData.players.map((p) => {
        if (p.xYards !== undefined && p.yYards !== undefined) {
          const pixel = coordSystem.yardToPixel(p.xYards, p.yYards)
          const posCode = (p as Player).positionCode
          const posNum = (p as Player).positionNumber
          const derivedLabel = posCode ? getDisplayLabel(posCode, posNum) : p.label
          let out: Player = { ...p, x: pixel.x, y: pixel.y, label: derivedLabel }
          // Route: derive pixel from yards so resize doesn't detach the path (source of truth: xYards/yYards)
          if (p.route?.length) {
            out = {
              ...out,
              route: p.route.map((pt) => {
                const hasYards = "xYards" in pt && typeof (pt as { xYards: number }).xYards === "number"
                const px = hasYards
                  ? coordSystem.yardToPixel((pt as { xYards: number }).xYards, (pt as { yYards: number }).yYards)
                  : {
                      x: ((pt as { x?: number }).x ?? 0) * (fieldDimensions.width / 800),
                      y: ((pt as { y?: number }).y ?? 0) * (fieldDimensions.height / 600),
                    }
                return {
                  ...pt,
                  x: px.x,
                  y: px.y,
                  xYards: hasYards ? (pt as { xYards: number }).xYards : 0,
                  yYards: hasYards ? (pt as { yYards: number }).yYards : 0,
                  t: "t" in pt ? (pt as { t: number }).t : 0,
                }
              }),
            }
          }
          // BlockingLine: derive pixel from yards for resize alignment
          if (p.blockingLine) {
            const bl = p.blockingLine as { x?: number; y?: number; xYards?: number; yYards?: number }
            const hasYards = typeof bl.xYards === "number" && typeof bl.yYards === "number"
            const bp = hasYards
              ? coordSystem.yardToPixel(bl.xYards!, bl.yYards!)
              : { x: (bl.x ?? 0) * (fieldDimensions.width / 800), y: (bl.y ?? 0) * (fieldDimensions.height / 600) }
            out = { ...out, blockingLine: { ...bl, x: bp.x, y: bp.y, xYards: bl.xYards ?? 0, yYards: bl.yYards ?? 0 } }
          }
          return out
        } else {
          const yards = coordSystem.pixelToYard(p.x, p.y)
          const pixel = coordSystem.yardToPixel(yards.xYards, yards.yYards)
          return { ...p, x: pixel.x, y: pixel.y, xYards: yards.xYards, yYards: yards.yYards }
        }
      })
      setPlayers(convertedPlayers)
      setZones(playData.zones || [])
      setManCoverages(playData.manCoverages || [])
    setCurrentSide(playData.side || side)
    if (initialPlayName) setPlayName(initialPlayName)
    initialSyncDoneRef.current = true
    setTimeout(() => {
      isSyncingFromPropsRef.current = false
    }, 0)
  }, [playData, side, initialPlayName, coordSystem, fieldDimensions.width, fieldDimensions.height, editorSourceKey, playId, isTemplateMode, templateName])

  useEffect(() => {
    setFieldPan({ x: 0, y: 0 })
    setEditorInkStrokes([])
    setEditorInkUndoStack([])
  }, [editorSourceKey])

  // Notify parent when user edits content (not when syncing from props or resize).
  useEffect(() => {
    if (!initialSyncDoneRef.current || isSyncingFromPropsRef.current || !onDirty) return
    onDirty()
  }, [players, zones, manCoverages, playName, templateNameState, onDirty])

  // Apply route preset from route library (play editor only). Use playersRef to avoid re-running when players change after apply.
  useEffect(() => {
    if (!appliedRoutePreset || isTemplateMode) return
    const { playerId, presetId } = appliedRoutePreset
    const currentPlayers = playersRef.current
    const player = currentPlayers.find((p) => p.id === playerId)
    if (!player) {
      onClearAppliedRoutePreset?.()
      return
    }
    const xYards = player.xYards ?? coordSystem.pixelToYard(player.x, player.y).xYards
    const yYards = player.yYards ?? coordSystem.pixelToYard(player.x, player.y).yYards
    const points = getPresetPointsTranslated(presetId, xYards, yYards)
    if (points.length < 2) {
      onClearAppliedRoutePreset?.()
      return
    }
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== playerId) return p
        const routeWithPixels = points.map((pt) => {
          const pixel = coordSystem.yardToPixel(pt.xYards, pt.yYards)
          return { x: pixel.x, y: pixel.y, xYards: pt.xYards, yYards: pt.yYards, t: pt.t }
        })
        return { ...p, route: routeWithPixels }
      })
    )
    onClearAppliedRoutePreset?.()
  }, [appliedRoutePreset, isTemplateMode, coordSystem, onClearAppliedRoutePreset])

  // When canvas is resized, recompute all display pixels from stable yard coords so routes/blocks stay anchored.
  // Do NOT mutate stored yard values; only update x,y for player, route points, and blockingLine.
  useEffect(() => {
    isSyncingFromPropsRef.current = true
    setPlayers((prev) =>
      prev.map((p) => {
        let out = p
        if (p.xYards != null && p.yYards != null) {
          const pixel = coordSystem.yardToPixel(p.xYards, p.yYards)
          out = { ...out, x: pixel.x, y: pixel.y }
        }
        if (out.route?.length) {
          out = {
            ...out,
            route: out.route.map((pt) => {
              const hasYards = "xYards" in pt && typeof (pt as { xYards: number }).xYards === "number" && "yYards" in pt && typeof (pt as { yYards: number }).yYards === "number"
              if (!hasYards) return pt
              const px = coordSystem.yardToPixel((pt as { xYards: number }).xYards, (pt as { yYards: number }).yYards)
              return { ...pt, x: px.x, y: px.y }
            }),
          }
        }
        if (out.blockingLine) {
          const bl = out.blockingLine as { x?: number; y?: number; xYards?: number; yYards?: number }
          if (typeof bl.xYards === "number" && typeof bl.yYards === "number") {
            const bp = coordSystem.yardToPixel(bl.xYards, bl.yYards)
            out = { ...out, blockingLine: { ...bl, x: bp.x, y: bp.y } }
          }
        }
        return out
      })
    )
    setTimeout(() => {
      isSyncingFromPropsRef.current = false
    }, 0)
  }, [coordSystem, fieldDimensions.width, fieldDimensions.height])

  useEffect(() => {
    if (!onSelectPlayer) return
    if (!selectedPlayerId) {
      onSelectPlayer(null)
      return
    }
    const p = players.find((x) => x.id === selectedPlayerId)
    if (!p) {
      onSelectPlayer(null)
      return
    }
    onSelectPlayer({
      id: p.id,
      label: p.label,
      shape: p.shape,
      positionCode: p.positionCode ?? undefined,
      positionNumber: p.positionNumber ?? undefined,
      hasDuplicateRole: hasDuplicateRoleLabel(players, p.id),
      animationTiming: p.animationTiming ?? undefined,
    })
  }, [selectedPlayerId, players, onSelectPlayer])

  useEffect(() => {
    if (!focusUnassignedOnce || !depthChartEntries?.length) return
    const entries = depthChartEntries
    const side = currentSide
    const clear = onClearFocusUnassigned
    const id = setTimeout(() => {
      const list = playersRef.current
      const firstUnassigned = list.find(
        (p) =>
          p.positionCode &&
          !getPlayerForSlot(entries, side, p.positionCode!, p.positionNumber ?? 1)
      )
      if (firstUnassigned) setSelectedPlayerId(firstUnassigned.id)
      clear?.()
    }, 50)
    return () => clearTimeout(id)
  }, [focusUnassignedOnce, depthChartEntries, currentSide, onClearFocusUnassigned])

  /** Uses lib/utils/canvas-coords (xMidYMid meet). All pointer tools depend on this. See tests/playbook-canvas-coords.test.ts. */
  const clientToViewBox = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!canvasRef.current) return null
    const rect = canvasRef.current.getBoundingClientRect()
    return clientToViewBoxLib(clientX, clientY, rect, fieldDimensions.width, fieldDimensions.height)
  }

  /** Screen → viewBox → snapped yard → pixel. Used by: route, block, zone, erase, man, place shapes. Drag uses clientToViewBox in move handler. */
  const getCanvasPoint = (e: React.MouseEvent<SVGSVGElement | Element>) => {
    const vb = clientToViewBox(e.clientX, e.clientY)
    if (!vb) return { x: 0, y: 0, xYards: 0, yYards: 0 }
    const { xYards, yYards } = coordSystem.pixelToYard(vb.x, vb.y)
    const snappedY = snapEnabled ? coordSystem.snapY(yYards) : yYards
    const snappedX = snapEnabled ? coordSystem.snapX(xYards) : xYards
    const pixel = coordSystem.yardToPixel(snappedX, snappedY)
    return { x: pixel.x, y: pixel.y, xYards: snappedX, yYards: snappedY }
  }

  const getRawViewPoint = (clientX: number, clientY: number): XY | null => {
    const vb = clientToViewBox(clientX, clientY)
    if (!vb) return null
    return {
      x: Math.max(0, Math.min(fieldDimensions.width, vb.x)),
      y: Math.max(0, Math.min(fieldDimensions.height, vb.y)),
    }
  }

  const pressureFromEvent = (e: React.PointerEvent) => {
    const p = typeof e.pressure === "number" && e.pressure > 0 ? e.pressure : 0.5
    return Math.max(0.12, Math.min(1, p))
  }

  const pointerMayDraw = (e: React.PointerEvent) => {
    if (e.pointerType === "pen") return true
    if (e.pointerType === "mouse") return true
    if (e.pointerType === "touch") return allowFingerDrawing && activePenIdsRef.current.size === 0
    return false
  }

  const pointerShouldPanField = (e: React.PointerEvent) =>
    e.pointerType === "touch" && !allowFingerDrawing && (tool === "route" || tool === "draw" || tool === "ink_arrow")

  const getPlayerShape = (player: Player): "circle" | "square" | "triangle" => {
    if (player.positionCode) {
      const def = getPositionByCode(player.positionCode)
      if (def) return def.shape
    }
    const side = currentSide
    const label = player.label
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

  /** Display position: always derive from yards when available so resize/reload don't shift markers. */
  const getPlayerDisplayPos = (p: Player): { x: number; y: number } => {
    if (p.xYards != null && p.yYards != null) return coordSystem.yardToPixel(p.xYards, p.yYards)
    return { x: p.x, y: p.y }
  }

  const commitFreehandRoute = useCallback(
    (samples: InkSample[], playerId: string) => {
      if (samples.length < 2) return
      const player = playersRef.current.find((p) => p.id === playerId)
      if (!player) return
      const originPos = getPlayerDisplayPos(player)
      const ox = player.xYards ?? coordSystem.pixelToYard(originPos.x, originPos.y).xYards
      const oy = player.yYards ?? coordSystem.pixelToYard(originPos.x, originPos.y).yYards
      const origin = { x: originPos.x, y: originPos.y, xYards: ox, yYards: oy }
      const smoothed = smoothFreehandPath(samples)
      if (smoothed.length < 2) return
      const waypoints = convertPathToRoute(
        smoothed,
        origin,
        (px, py) => coordSystem.pixelToYard(px, py),
        (xY, yY) => coordSystem.yardToPixel(xY, yY),
        (x) => (snapEnabled ? coordSystem.snapX(x) : x),
        (y) => (snapEnabled ? coordSystem.snapY(y) : y),
        {}
      )
      if (waypoints.length < 2) return
      pushHistory()
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? {
                ...p,
                route: waypoints.map((w, i) => ({
                  x: w.x,
                  y: w.y,
                  xYards: w.xYards,
                  yYards: w.yYards,
                  t: i / (waypoints.length - 1),
                })),
              }
            : p
        )
      )
      onDirty?.()
    },
    [coordSystem, snapEnabled, pushHistory, onDirty]
  )

  /** Convert builder Player to PlayerPathSource for play-animation (yards-based). */
  const playerToPathSource = (p: Player): PlayerPathSource => {
    const xYards = p.xYards ?? coordSystem.pixelToYard(p.x, p.y).xYards
    const yYards = p.yYards ?? coordSystem.pixelToYard(p.x, p.y).yYards
    const route = p.route?.map((pt) => {
      const hasYards = "xYards" in pt && typeof (pt as { xYards: number }).xYards === "number"
      const xY = hasYards ? (pt as { xYards: number }).xYards : coordSystem.pixelToYard((pt as { x: number }).x, (pt as { y: number }).y).xYards
      const yY = hasYards ? (pt as { yYards: number }).yYards : coordSystem.pixelToYard((pt as { x: number }).x, (pt as { y: number }).y).yYards
      return { xYards: xY, yYards: yY, t: "t" in pt ? (pt as { t: number }).t : 0 }
    })
    const blockingLine = p.blockingLine
      ? (() => {
          const bl = p.blockingLine as { x?: number; y?: number; xYards?: number; yYards?: number }
          const hasYards = typeof bl.xYards === "number" && typeof bl.yYards === "number"
          return {
            xYards: hasYards ? bl.xYards! : coordSystem.pixelToYard(bl.x ?? 0, bl.y ?? 0).xYards,
            yYards: hasYards ? bl.yYards! : coordSystem.pixelToYard(bl.x ?? 0, bl.y ?? 0).yYards,
          }
        })()
      : undefined
    return {
      xYards,
      yYards,
      route: route ?? undefined,
      blockingLine,
      animationTiming: p.animationTiming ?? undefined,
      preSnapMotion: p.preSnapMotion ?? undefined,
    }
  }

  /** Resolved position for a player: animated when in preview, else display position. */
  const getPlayerPos = (p: Player): { x: number; y: number } => {
    if (previewMode) {
      const yard = getAnimatedPlayerPosition(playerToPathSource(p), previewProgress)
      return coordSystem.yardToPixel(yard.xYards, yard.yYards)
    }
    return getPlayerDisplayPos(p)
  }

  /** Hit-test: find player whose center is within radius of point. Use 1.5x for route/block start for easier targeting. */
  const HIT_RADIUS_MULTIPLIER_ROUTE_BLOCK = 1.5
  const getPlayerAtPoint = (point: { x: number; y: number }, hitRadiusMultiplier = 1) => {
    const radius = coordSystem.getMarkerSize() * hitRadiusMultiplier
    return players.find((p) => {
      const pos = getPlayerDisplayPos(p)
      return Math.sqrt(Math.pow(pos.x - point.x, 2) + Math.pow(pos.y - point.y, 2)) < radius
    })
  }

  const fieldPanRef = useRef(fieldPan)
  fieldPanRef.current = fieldPan

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canEdit || previewMode) return
    if (e.pointerType === "pen") activePenIdsRef.current.add(e.pointerId)
    if (!pointerMayDraw(e)) return
    if (tool === "route" && currentSide === "offense") {
      const pt = getRawViewPoint(e.clientX, e.clientY)
      if (!pt) return
      const origins = players.map((p) => ({ id: p.id, ...getPlayerDisplayPos(p) }))
      const hit = findNearestPlayerOrigin(pt, origins, coordSystem.getMarkerSize() * 3.2)
      if (!hit) return
      e.preventDefault()
      e.stopPropagation()
      freehandMetaRef.current = { kind: "route", playerId: hit.id, pointerId: e.pointerId }
      freehandSamplesRef.current = [{ x: hit.x, y: hit.y, pressure: pressureFromEvent(e), t: performance.now() }]
      setLiveStrokePlayerId(hit.id)
      setLiveStrokeKind("route")
      setSelectedPlayerId(hit.id)
      setLiveStrokePreview([{ x: hit.x, y: hit.y }])
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      return
    }
    if (tool === "draw") {
      const pt = getRawViewPoint(e.clientX, e.clientY)
      if (!pt) return
      e.preventDefault()
      freehandMetaRef.current = { kind: "draw", pointerId: e.pointerId }
      freehandSamplesRef.current = [{ x: pt.x, y: pt.y, pressure: pressureFromEvent(e), t: performance.now() }]
      setLiveStrokeKind("draw")
      setLiveStrokePlayerId(null)
      setLiveStrokePreview([pt])
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      return
    }
    if (tool === "ink_arrow") {
      const pt = getRawViewPoint(e.clientX, e.clientY)
      if (!pt) return
      e.preventDefault()
      arrowDragRef.current = { start: pt, pointerId: e.pointerId }
      setLiveStrokeKind("arrow")
      setLiveStrokePreview([pt, pt])
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
  }

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const meta = freehandMetaRef.current
    if (meta && e.pointerId === meta.pointerId && (tool === "route" || tool === "draw")) {
      const pt = getRawViewPoint(e.clientX, e.clientY)
      if (!pt) return
      e.preventDefault()
      const last = freehandSamplesRef.current[freehandSamplesRef.current.length - 1]
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 1.2) {
        freehandSamplesRef.current.push({ x: pt.x, y: pt.y, pressure: pressureFromEvent(e), t: performance.now() })
        schedulePreviewFlush()
      }
      return
    }
    const ad = arrowDragRef.current
    if (ad && e.pointerId === ad.pointerId && tool === "ink_arrow") {
      const pt = getRawViewPoint(e.clientX, e.clientY)
      if (!pt) return
      e.preventDefault()
      setLiveStrokePreview([ad.start, pt])
    }
  }

  const endSvgStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "pen") activePenIdsRef.current.delete(e.pointerId)
    const meta = freehandMetaRef.current
    if (meta && e.pointerId === meta.pointerId && meta.kind === "route" && meta.playerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const samples = [...freehandSamplesRef.current]
      freehandMetaRef.current = null
      freehandSamplesRef.current = []
      setLiveStrokePreview(null)
      setLiveStrokeKind(null)
      setLiveStrokePlayerId(null)
      commitFreehandRoute(samples, meta.playerId)
      return
    }
    if (meta && e.pointerId === meta.pointerId && meta.kind === "draw") {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const samples = [...freehandSamplesRef.current]
      freehandMetaRef.current = null
      freehandSamplesRef.current = []
      setLiveStrokePreview(null)
      setLiveStrokeKind(null)
      const smoothed = smoothFreehandPath(samples)
      if (smoothed.length > 1) {
        const pressures = samples.map((s) => s.pressure)
        const avgP = pressures.reduce((a, b) => a + b, 0) / Math.max(1, pressures.length)
        const w = drawStrokeWidth * (0.65 + 0.55 * avgP)
        pushEditorInk({
          kind: "freehand",
          points: smoothed,
          color: drawColor,
          width: w,
          opacity: 1,
        })
      }
      return
    }
    const ad = arrowDragRef.current
    if (ad && e.pointerId === ad.pointerId && tool === "ink_arrow") {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      arrowDragRef.current = null
      const pt = getRawViewPoint(e.clientX, e.clientY)
      const end = pt ?? ad.start
      setLiveStrokePreview(null)
      setLiveStrokeKind(null)
      if (Math.hypot(end.x - ad.start.x, end.y - ad.start.y) > 8) {
        pushEditorInk({
          kind: "arrow",
          points: [ad.start, end],
          color: drawColor,
          width: drawStrokeWidth,
          opacity: 1,
        })
      }
    }
  }

  const onFieldPanPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canEdit || previewMode) return
    if (!pointerShouldPanField(e)) return
    const fp = fieldPanRef.current
    panDragRef.current = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, px: fp.x, py: fp.y }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const onFieldPanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = panDragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    setFieldPan({
      x: d.px + (e.clientX - d.sx),
      y: d.py + (e.clientY - d.sy),
    })
  }

  const onFieldPanPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = panDragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    panDragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canEdit || previewMode) return

    const point = getCanvasPoint(e)

    const positionDef = getPositionByCode(tool)
    if (positionDef && positionDef.unit === currentSide) {
      const nextNum = getNextPositionNumber(players, positionDef.code)
      const label = getDisplayLabel(positionDef.code, nextNum)
      const newPlayer: Player = {
        id: Date.now().toString(),
        x: point.x,
        y: point.y,
        xYards: point.xYards,
        yYards: point.yYards,
        label,
        shape: positionDef.shape,
        playerType: positionDef.shape === "triangle" ? (["DE", "DT", "NT", "EDGE"].includes(positionDef.code) ? "lineman" : "skill") : (["C", "LG", "RG", "LT", "RT"].includes(positionDef.code) ? "lineman" : "skill"),
        positionCode: positionDef.code,
        positionNumber: nextNum ?? undefined,
      }
      pushHistory()
      setPlayers([...players, newPlayer])
    } else if (tool === "erase") {
      const clickedPlayer = getPlayerAtPoint(point)
      if (clickedPlayer) {
        setPlayers(players.filter((p) => p.id !== clickedPlayer.id))
        pushHistory()
      }
    } else if (tool === "motion") {
      const clickedPlayer = getPlayerAtPoint(point, HIT_RADIUS_MULTIPLIER_ROUTE_BLOCK)
      if (motionDraft) {
        if (clickedPlayer && clickedPlayer.id === motionDraft.playerId) return
        setMotionDraft((prev) =>
          prev ? { ...prev, points: [...prev.points, { x: point.x, y: point.y, xYards: point.xYards, yYards: point.yYards }] } : null
        )
      } else if (clickedPlayer) {
        const displayPos = getPlayerDisplayPos(clickedPlayer)
        const origin: PointPX = {
          x: displayPos.x,
          y: displayPos.y,
          xYards: clickedPlayer.xYards ?? coordSystem.pixelToYard(displayPos.x, displayPos.y).xYards,
          yYards: clickedPlayer.yYards ?? coordSystem.pixelToYard(displayPos.x, displayPos.y).yYards,
        }
        setMotionDraft({ playerId: clickedPlayer.id, points: [origin] })
        setSelectedPlayerId(clickedPlayer.id)
      }
    } else if (tool === "block") {
      const clickedPlayer = getPlayerAtPoint(point, HIT_RADIUS_MULTIPLIER_ROUTE_BLOCK)
      if (blockDraft) {
        setBlockDraft((prev) => (prev ? { ...prev, endPoint: { x: point.x, y: point.y, xYards: point.xYards, yYards: point.yYards } } : null))
      } else if (clickedPlayer) {
        const displayPos = getPlayerDisplayPos(clickedPlayer)
        const origin: PointPX = {
          x: displayPos.x,
          y: displayPos.y,
          xYards: clickedPlayer.xYards ?? coordSystem.pixelToYard(displayPos.x, displayPos.y).xYards,
          yYards: clickedPlayer.yYards ?? coordSystem.pixelToYard(displayPos.x, displayPos.y).yYards,
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
        const clickedPlayer = getPlayerAtPoint(point)
        if (clickedPlayer) {
          setManCoverageStart(clickedPlayer.id)
        }
      } else {
        const clickedPlayer = getPlayerAtPoint(point)
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
    if (!canEdit || previewMode) return
    const point = getCanvasPoint(e)
    if ((tool === "block" && blockDraft) || (tool === "motion" && motionDraft)) {
      setCursorPosition({ x: point.x, y: point.y })
      setHoveredPlayerId(null)
    } else {
      setCursorPosition(null)
      if ((tool === "route" || tool === "block" || tool === "motion") && !blockDraft && !motionDraft) {
        const player = getPlayerAtPoint(point, HIT_RADIUS_MULTIPLIER_ROUTE_BLOCK)
        setHoveredPlayerId(player?.id ?? null)
      } else {
        setHoveredPlayerId(null)
      }
    }
  }

  const handleCanvasMouseLeave = () => {
    setCursorPosition(null)
    setHoveredPlayerId(null)
  }

  const handleCanvasDoubleClick = () => {
    if (previewMode) return
    if (tool === "motion" && canFinishMotionDraft) {
      finishMotionDraft()
      return
    }
    if (tool === "block" && blockDraft) {
      finishBlockDraft()
    }
  }

  const handlePlayerDrag = (playerId: string, e: React.MouseEvent | React.PointerEvent) => {
    if (!canEdit || tool !== "select") return
    e.preventDefault()
    const player = players.find((p) => p.id === playerId)
    if (!player) return

    const applyMove = (clientX: number, clientY: number) => {
      const vb = clientToViewBox(clientX, clientY)
      if (!vb) return
      const { xYards, yYards } = coordSystem.pixelToYard(vb.x, vb.y)
      const snappedY = snapEnabled ? coordSystem.snapY(yYards) : yYards
      const snappedX = snapEnabled ? coordSystem.snapX(xYards) : xYards
      const pixel = coordSystem.yardToPixel(snappedX, snappedY)

      setPlayers((prev) =>
        prev.map((p) =>
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

    if ("pointerId" in e && (e.pointerType === "pen" || e.pointerType === "touch")) {
      const pid = e.pointerId
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(pid)
      } catch {
        /* ignore */
      }
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return
        applyMove(ev.clientX, ev.clientY)
      }
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== pid) return
        document.removeEventListener("pointermove", move)
        document.removeEventListener("pointerup", up)
        document.removeEventListener("pointercancel", up)
        try {
          ;(e.currentTarget as HTMLElement).releasePointerCapture(pid)
        } catch {
          /* ignore */
        }
      }
      document.addEventListener("pointermove", move)
      document.addEventListener("pointerup", up)
      document.addEventListener("pointercancel", up)
      return
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      applyMove(moveEvent.clientX, moveEvent.clientY)
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
    cancelRouteDraft()
    setBlockDraft(null)
    setMotionDraft(null)
    setCursorPosition(null)
    setSelectedPlayerId(null)
    setIsAnimating(false)
  }

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    // Use ref so we always serialize the latest state (avoids stale closure if save runs before re-render after finish route).
    const latestPlayers = playersRef.current
    // Template mode: validate 11 players required
    if (isTemplateMode) {
      if (latestPlayers.length !== 11) {
        alert(`Template requires exactly 11 players. Currently have ${latestPlayers.length}.`)
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

    // Persistence: route/blockingLine are included; for position-based markers, label is derived to avoid drift.
    const playersWithYards = latestPlayers.map((p) => {
      const derivedLabel = p.positionCode ? getDisplayLabel(p.positionCode, p.positionNumber) : p.label
      let out: Player = p.xYards !== undefined && p.yYards !== undefined
        ? { ...p, label: derivedLabel }
        : { ...p, xYards: coordSystem.pixelToYard(p.x, p.y).xYards, yYards: coordSystem.pixelToYard(p.x, p.y).yYards, label: derivedLabel }
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
    
    setIsSaving(true)
    try {
      if (isTemplateMode) {
        await Promise.resolve(onSave(canvasData, templateNameState.trim()))
      } else {
        await Promise.resolve(onSave(canvasData, playName.trim()))
      }
    } finally {
      setIsSaving(false)
    }
  }
  saveHandlerRef.current = handleSave
  if (triggerSaveRef) triggerSaveRef.current = handleSave

  const playerCount = players.length
  const expectedCount = 11
  const showPlayerCountWarning = playerCount !== expectedCount
  const markerSize = coordSystem.getMarkerSize()

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full lg:h-screen overflow-hidden" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="lg:hidden flex-shrink-0 flex items-center gap-1.5 px-2 py-2 border-b border-slate-800 bg-slate-950 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" className="text-slate-200 h-10 w-10 shrink-0 rounded-xl" onClick={onClose} aria-label="Close editor">
          <X className="h-5 w-5" />
        </Button>
        {canEdit && !isTemplateMode && (
          <>
            <Button variant="ghost" size="icon" className="text-slate-200 h-10 w-10 rounded-xl" onClick={undo} disabled={undoStack.length === 0} title="Undo">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-200 h-10 w-10 rounded-xl" onClick={redo} disabled={redoStack.length === 0} title="Redo">
              <RotateCw className="h-4 w-4" />
            </Button>
          </>
        )}
        <div className="flex-1 min-w-0 text-center px-1">
          <p className="text-sm font-semibold text-slate-100 truncate">{isTemplateMode ? templateNameState || "Formation" : playName || "Play"}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">{currentSide.replace("_", " ")}</p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            className="h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 font-semibold"
            onClick={handleSave}
            disabled={isSaving || (isTemplateMode ? (!templateNameState.trim() || players.length !== 11) : !playName.trim())}
          >
            <Save className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">{isSaving ? "…" : "Save"}</span>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl border-slate-600 bg-slate-900 text-slate-200 shrink-0"
          onClick={() => setMobileEditorMenuOpen(true)}
          aria-label="More options"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>

      <PlaybookBottomSheet open={mobileEditorMenuOpen} onOpenChange={setMobileEditorMenuOpen} title="Playbook setup">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={currentSide === "offense" ? "default" : "outline"}
              size="sm"
              className="rounded-xl"
              onClick={() => setCurrentSide("offense")}
              disabled={!canEdit}
            >
              Offense
            </Button>
            <Button
              variant={currentSide === "defense" ? "default" : "outline"}
              size="sm"
              className="rounded-xl"
              onClick={() => setCurrentSide("defense")}
              disabled={!canEdit}
            >
              Defense
            </Button>
            <Button
              variant={currentSide === "special_teams" ? "default" : "outline"}
              size="sm"
              className="rounded-xl"
              onClick={() => setCurrentSide("special_teams")}
              disabled={!canEdit}
            >
              Special teams
            </Button>
          </div>
          {isTemplateMode ? (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Formation name
              <Input
                value={templateNameState}
                onChange={(e) => setTemplateNameState(e.target.value)}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Play name
              <Input value={playName} onChange={(e) => setPlayName(e.target.value)} className="h-11 rounded-xl" disabled={!canEdit} />
            </label>
          )}
          {(showPlayerCountWarning || (isTemplateMode && playerCount !== 11)) && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              {isTemplateMode ? `${playerCount} players (need 11)` : `${playerCount} on field (expected ${expectedCount})`}
            </p>
          )}
          {(liveStrokeKind || blockDraft || motionDraft) && (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  if (canFinishMotionDraft) finishMotionDraft()
                  else if (blockDraft) finishBlockDraft()
                }}
                disabled={!!liveStrokeKind}
              >
                <Check className="h-4 w-4 mr-1" />
                Finish line
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  cancelRouteDraft()
                  cancelBlockDraft()
                  cancelMotionDraft()
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </PlaybookBottomSheet>

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between p-2 border-b-2 flex-shrink-0" style={{ borderBottomColor: "#0B2A5B" }}>
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
              {(liveStrokeKind || blockDraft || motionDraft) && (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (canFinishMotionDraft) finishMotionDraft()
                      else if (blockDraft) finishBlockDraft()
                    }}
                    disabled={!!liveStrokeKind || (motionDraft ? !canFinishMotionDraft : !blockDraft)}
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
              disabled={isSaving || (isTemplateMode ? (!templateNameState.trim() || players.length !== 11) : !playName.trim())}
              title={isTemplateMode ? "Save formation (Ctrl+S)" : "Save (Ctrl+S)"}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : (isTemplateMode ? "Save Formation" : "Save")}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Drawing helper text — wraps with toolbar strip styling */}
      {canEdit && !isTemplateMode && (
        <div className="hidden lg:flex flex-shrink-0 flex-wrap items-center gap-3 py-2 px-3 border-b border-slate-200 bg-slate-50/50 text-sm text-slate-600">
          {tool === "route" && (
            <span>
              Route: <strong>Draw from a player</strong> with pen or mouse (start near a marker). Stylus draws immediately; finger pans unless{" "}
              <strong>Allow finger drawing</strong> is on. <strong>Esc</strong> cancels an in-progress stroke.
            </span>
          )}
          {tool === "draw" && (
            <span>Draw: freehand ink (not saved with the play). Clear ink from the dock. Pen preferred; finger pans unless finger drawing is enabled.</span>
          )}
          {tool === "ink_arrow" && <span>Arrow: drag to place a straight arrow on the field (ink layer).</span>}
          {tool === "block" && !blockDraft && (
            <span>Block: <strong>Click a player</strong> to start, then click target. Enter to finish, Esc to cancel.</span>
          )}
          {tool === "block" && blockDraft && (
            <span>Block: Click to set target · <strong>Enter</strong> to finish · <strong>Esc</strong> to cancel.</span>
          )}
          {tool === "zone" && "Zone: Click on the field to place a zone. Switch to Select to move or remove."}
          {tool === "man" && currentSide === "defense" && "Man: Click defender, then receiver to assign coverage."}
          {tool === "erase" && "Erase: Click a player to remove from the field."}
          {getPositionByCode(tool) && getPositionByCode(tool)?.unit === currentSide && (
            <span>Position: Click on the field to place <strong>{getPositionByCode(tool)?.label}</strong>.</span>
          )}
          {tool === "motion" && !motionDraft && (
            <span>Motion: <strong>Click a player</strong> to start pre-snap motion, then add waypoints. Enter to finish, Esc to cancel.</span>
          )}
          {tool === "motion" && motionDraft && (
            <span>Motion: Click to add points · <strong>Double-click</strong> or <strong>Enter</strong> to finish · <strong>Esc</strong> to cancel.</span>
          )}
          {tool === "select" && !liveStrokeKind && !blockDraft && !motionDraft && (
            <span>Select: Drag players to move. <strong>V</strong> Select · <strong>R</strong> Route · <strong>B</strong> Block · <strong>M</strong> Motion · <strong>Z</strong> Zone · <strong>E</strong> Erase.</span>
          )}
          <label className="flex items-center gap-2 text-xs cursor-pointer border border-slate-200 rounded-lg px-2 py-1 bg-white">
            <input type="checkbox" checked={allowFingerDrawing} onChange={(e) => setFingerDrawPref(e.target.checked)} className="rounded" />
            Allow finger drawing
          </label>
          {(tool === "draw" || tool === "ink_arrow") && (
            <>
              <div className="flex items-center gap-1">
                {DRAW_COLORS.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-7 w-7 rounded-full border-2 ${drawColorIdx === i ? "border-slate-900 scale-110" : "border-slate-300"}`}
                    style={{ backgroundColor: c }}
                    title="Color"
                    onClick={() => setDrawColorIdx(i)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                {strokeWidthChoices.map((w, i) => (
                  <Button
                    key={w}
                    type="button"
                    size="sm"
                    variant={drawWidthIdx === i ? "default" : "outline"}
                    className="h-8 px-2 text-xs"
                    onClick={() => setDrawWidthIdx(i)}
                  >
                    {w}px
                  </Button>
                ))}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={undoEditorInk} disabled={editorInkUndoStack.length === 0}>
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Ink undo
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={clearEditorInk} disabled={editorInkStrokes.length === 0}>
                Clear ink
              </Button>
            </>
          )}
        </div>
      )}

      {/* Selected player: position and depth number editor — wrapping toolbar with logical groups */}
      {canEdit && selectedPlayerId && (() => {
        const sel = players.find((p) => p.id === selectedPlayerId)
        if (!sel) return null
        const positions = getPositionsForUnit(currentSide)
        const def = sel.positionCode ? getPositionByCode(sel.positionCode) : null
        const inputClass = "h-8 min-w-[70px] px-2 rounded-md border border-slate-200 text-sm"
        return (
          <div className="flex-shrink-0 py-2 px-3 border-b border-slate-200 bg-slate-50/50 max-lg:max-h-[min(30vh,260px)] max-lg:overflow-y-auto max-lg:rounded-2xl max-lg:mx-2 max-lg:mb-1 max-lg:bg-white max-lg:shadow-md max-lg:border max-lg:border-slate-200">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {/* Group 1: Marker selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-600">Marker:</span>
                <select
                  value={sel.positionCode ?? ""}
                  onChange={(e) => {
                    const code = e.target.value || null
                    const newDef = code ? getPositionByCode(code) : null
                    const num = newDef?.numberable ? (sel.positionNumber ?? 1) : null
                    const label = newDef && code ? getDisplayLabel(code, num) : sel.label
                    setPlayers((prev) =>
                      prev.map((p) =>
                        p.id === selectedPlayerId
                          ? {
                              ...p,
                              positionCode: code,
                              positionNumber: num ?? undefined,
                              label,
                              shape: newDef?.shape ?? p.shape,
                            }
                          : p
                      )
                    )
                  }}
                  className={`${inputClass} min-w-[72px]`}
                >
                  <option value="">—</option>
                  {positions.map((p) => (
                    <option key={p.code} value={p.code}>{p.label}</option>
                  ))}
                </select>
                {def?.numberable && (
                  <>
                    <span className="text-xs text-slate-500">#</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={sel.positionNumber ?? 1}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10)
                        const num = isNaN(n) || n < 1 ? 1 : Math.min(99, n)
                        const label = getDisplayLabel(sel.positionCode ?? "", num)
                        setPlayers((prev) =>
                          prev.map((p) =>
                            p.id === selectedPlayerId ? { ...p, positionNumber: num, label } : p
                          )
                        )
                      }}
                      className={`${inputClass} w-14 text-center`}
                    />
                  </>
                )}
                <span className="text-xs text-slate-500">→ {sel.label}</span>
                {sel.positionCode && depthChartEntries?.length && (() => {
                  const slotNum = sel.positionNumber ?? 1
                  const assigned = getPlayerForSlot(depthChartEntries, currentSide, sel.positionCode, slotNum)
                  return (
                    <span className="text-xs font-medium text-slate-700">
                      {assigned ? (
                        <>Assigned: {assigned.jerseyNumber != null ? `#${assigned.jerseyNumber} ` : ""}{[assigned.firstName, assigned.lastName].filter(Boolean).join(" ")}</>
                      ) : (
                        <span className="text-slate-500">Unassigned</span>
                      )}
                    </span>
                  )
                })()}
                {sel.positionCode && hasDuplicateRoleLabel(players, sel.id) && (
                  <span className="text-xs text-amber-600" title="Another marker has the same role label on this play">
                    Duplicate role
                  </span>
                )}
              </div>

              {/* Group 2: Animation status */}
              {!isTemplateMode && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Animation:</span>
                  {hasCustomAnimationTiming(sel.animationTiming) ? (
                    <span className="text-xs font-medium text-amber-700 flex items-center gap-1" title="This marker has custom animation timing">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      Custom timing: {formatAnimationTimingSummary(sel.animationTiming)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Default timing</span>
                  )}
                </div>
              )}

              {/* Group 3: Timing controls */}
              {!isTemplateMode && (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 whitespace-nowrap">Start delay</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={sel.animationTiming?.startDelay ?? 0}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        const startDelay = isNaN(v) ? 0 : Math.max(0, Math.min(1, v))
                        setPlayers((prev) =>
                          prev.map((p) => {
                            if (p.id !== selectedPlayerId) return p
                            const next = {
                              ...p.animationTiming,
                              startDelay: startDelay === 0 ? undefined : startDelay,
                            }
                            const timing =
                              next.startDelay != null || next.durationScale != null ? next : undefined
                            return { ...p, animationTiming: timing }
                          })
                        )
                      }}
                      title="0 = starts immediately, 0.2 = after 20% of the play"
                      className={`${inputClass} text-right w-16`}
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 whitespace-nowrap">Duration scale</span>
                    <input
                      type="number"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={sel.animationTiming?.durationScale ?? 1}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        const durationScale = isNaN(v) ? 1 : Math.max(0.1, Math.min(3, v))
                        setPlayers((prev) =>
                          prev.map((p) => {
                            if (p.id !== selectedPlayerId) return p
                            const next = {
                              ...p.animationTiming,
                              durationScale: durationScale === 1 ? undefined : durationScale,
                            }
                            const timing =
                              next.startDelay != null || next.durationScale != null ? next : undefined
                            return { ...p, animationTiming: timing }
                          })
                        )
                      }}
                      title="1 = normal speed, 0.5 = faster, 2 = slower"
                      className={`${inputClass} text-right w-16`}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Row 2: Reset timing + hint */}
            {!isTemplateMode && (
              <div className="w-full text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Button
                  variant={hasCustomAnimationTiming(sel.animationTiming) ? "outline" : "ghost"}
                  size="sm"
                  className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:underline"
                  onClick={() =>
                    setPlayers((prev) =>
                      prev.map((p) =>
                        p.id === selectedPlayerId ? { ...p, animationTiming: undefined } : p
                      )
                    )
                  }
                  title="Reset to default (starts immediately, normal speed)"
                  disabled={!hasCustomAnimationTiming(sel.animationTiming)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset timing
                </Button>
                <span className="text-slate-400">
                  0 = now · 0.2 = 20% in · 0.5 scale = faster · 2 = slower
                </span>
              </div>
            )}
          </div>
        )
      })()}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Tree */}
        {teamId && (
          <div className="hidden lg:flex w-64 border-r flex-shrink-0 overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
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
          <div className="hidden lg:flex flex-shrink-0 h-full min-h-0">
            <PlaybookShapePalette
              currentSide={currentSide}
              selectedTool={tool}
              onSelectTool={(newTool) => {
                cancelRouteDraft()
                cancelBlockDraft()
                cancelMotionDraft()
                setHoveredPlayerId(null)
                setTool(newTool)
                if (newTool === "select") setSelectedPlayerId(null)
                else if (newTool === "man") setManCoverageStart(null)
              }}
              isTemplateMode={isTemplateMode}
              canEdit={canEdit}
            />
          </div>
        )}

        {/* Canvas - fills entire area; tablet finger-pan on route/draw/arrow when finger draw off */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden flex items-center justify-center min-h-0 min-w-0 relative"
          style={{ backgroundColor: "#2d5016" }}
          onPointerDownCapture={onFieldPanPointerDownCapture}
          onPointerMove={onFieldPanPointerMove}
          onPointerUp={onFieldPanPointerUp}
          onPointerCancel={onFieldPanPointerUp}
        >
          <div
            className="w-full h-full min-h-0 flex items-center justify-center"
            style={{ transform: `translate(${fieldPan.x}px, ${fieldPan.y}px)` }}
          >
          <svg
            ref={canvasRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${fieldDimensions.width} ${fieldDimensions.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              touchAction: tool === "route" || tool === "draw" || tool === "ink_arrow" ? "none" : undefined,
              cursor:
                liveStrokeKind || blockDraft || motionDraft
                  ? "crosshair"
                  : tool === "route" || tool === "draw" || tool === "ink_arrow"
                    ? "crosshair"
                    : tool === "block" || tool === "motion"
                      ? "pointer"
                      : (getPositionByCode(tool) && getPositionByCode(tool)?.unit === currentSide) || tool === "zone" || tool === "erase"
                        ? "crosshair"
                        : tool === "select"
                          ? "move"
                          : "default",
            }}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onDoubleClick={handleCanvasDoubleClick}
            onMouseLeave={handleCanvasMouseLeave}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={endSvgStroke}
            onPointerCancel={endSvgStroke}
          >
            {/* Field surface */}
            <PlaybookFieldSurface
              width={fieldDimensions.width}
              height={fieldDimensions.height}
              yardStart={yardLineStart}
              yardEnd={yardLineEnd}
            />

            {/* Live freehand preview (route / draw / arrow drag) */}
            {liveStrokePreview && liveStrokePreview.length > 1 && (
              <g className="live-stroke-preview" pointerEvents="none">
                {liveStrokeKind === "arrow" && liveStrokePreview.length >= 2 ? (
                  (() => {
                    const [a, b] = liveStrokePreview
                    const ang = Math.atan2(b.y - a.y, b.x - a.x)
                    const ah = 14
                    const aw = 8
                    const x1 = b.x - ah * Math.cos(ang)
                    const y1 = b.y - ah * Math.sin(ang)
                    return (
                      <g>
                        <line x1={a.x} y1={a.y} x2={x1} y2={y1} stroke={drawColor} strokeWidth={drawStrokeWidth} strokeLinecap="round" strokeDasharray="5,4" opacity={0.9} />
                        <polygon
                          points={`${b.x},${b.y} ${x1 + aw * Math.sin(ang)},${y1 - aw * Math.cos(ang)} ${x1 - aw * Math.sin(ang)},${y1 + aw * Math.cos(ang)}`}
                          fill={drawColor}
                          opacity={0.9}
                        />
                      </g>
                    )
                  })()
                ) : (
                  <polyline
                    points={liveStrokePreview.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={liveStrokeKind === "draw" ? drawColor : "#2563EB"}
                    strokeWidth={liveStrokeKind === "draw" ? Math.max(2, drawStrokeWidth * 0.85) : 4}
                    strokeDasharray={liveStrokeKind === "route" ? "8,5" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.92}
                  />
                )}
              </g>
            )}

            {/* Motion draft: dashed teal — pre-snap motion path */}
            {motionDraft && motionDraft.points.length > 0 && (
              <g className="motion-draft">
                <polyline
                  points={
                    cursorPosition
                      ? [...motionDraft.points, cursorPosition].map((p) => `${p.x},${p.y}`).join(" ")
                      : motionDraft.points.map((p) => `${p.x},${p.y}`).join(" ")
                  }
                  fill="none"
                  stroke="#0D9488"
                  strokeWidth="4"
                  strokeDasharray="8,5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={cursorPosition ? 1 : 0.9}
                />
                {motionDraft.points.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="6" fill="#0D9488" stroke="white" strokeWidth="2" />
                ))}
                {cursorPosition && (
                  <circle cx={cursorPosition.x} cy={cursorPosition.y} r="5" fill="none" stroke="#0D9488" strokeWidth="2" strokeDasharray="3,3" />
                )}
              </g>
            )}

            {/* Block draft: orange/amber, thick dashed — distinct from route and saved blocks */}
            {blockDraft && (() => {
              const blocker = players.find((p) => p.id === blockDraft.playerId)
              if (!blocker) return null
              const start = getPlayerDisplayPos(blocker)
              const end = cursorPosition ?? { x: blockDraft.endPoint.x, y: blockDraft.endPoint.y }
              return (
                <g className="block-draft">
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#D97706"
                    strokeWidth="4"
                    strokeDasharray="10,6"
                    strokeLinecap="round"
                  />
                  <circle cx={end.x} cy={end.y} r="7" fill="#F59E0B" stroke="white" strokeWidth="2" />
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
              const dPos = getPlayerPos(defender)
              const rPos = getPlayerPos(receiver)
              return (
                <line
                  key={coverage.id}
                  x1={dPos.x}
                  y1={dPos.y}
                  x2={rPos.x}
                  y2={rPos.y}
                  stroke="#DC2626"
                  strokeWidth="2"
                  strokeDasharray="3,3"
                />
              )
            })}

            {/* Players */}
            {players.map((player) => {
              const isSelected = selectedPlayerId === player.id
              const isHoveredAsOrigin =
                !previewMode &&
                hoveredPlayerId === player.id &&
                (tool === "route" || tool === "block") &&
                !liveStrokeKind &&
                !blockDraft
              const isOffense = currentSide === "offense" || currentSide === "special_teams"
              const playerColor = isOffense ? "#3B82F6" : "#DC2626"
              const assigned =
                player.positionCode && depthChartEntries?.length
                  ? getPlayerForSlot(depthChartEntries, currentSide, player.positionCode, player.positionNumber ?? 1)
                  : null
              const assignTip =
                assigned
                  ? `Assigned: ${assigned.jerseyNumber != null ? `#${assigned.jerseyNumber} ` : ""}${[assigned.firstName, assigned.lastName].filter(Boolean).join(" ")}`
                  : "Unassigned"

              const pos = getPlayerPos(player)
              const customTiming = hasCustomAnimationTiming(player.animationTiming)
              const timingTooltip = customTiming
                ? `Custom timing: ${formatAnimationTimingSummary(player.animationTiming).replace(" · ", " / ")}`
                : null
              return (
                <g key={player.id} style={previewMode ? { pointerEvents: "none" } : undefined}>
                  {player.positionCode && depthChartEntries?.length ? (
                    <title>{assignTip}</title>
                  ) : null}
                  {customTiming && (
                    <g>
                      <title>{timingTooltip ?? "Custom timing"}</title>
                      <circle
                        cx={pos.x - markerSize / 2 + 10}
                        cy={pos.y - markerSize / 2 + 10}
                        r={5}
                        fill="#F59E0B"
                        stroke="white"
                        strokeWidth={1.5}
                        opacity={0.95}
                      />
                    </g>
                  )}
                  {/* Hover "start here" ring when Route/Block tool and no draft (hidden in preview) */}
                  {isHoveredAsOrigin && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={markerSize / 2 + 6}
                      fill="none"
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                  )}
                  {/* Player route — hidden in preview when showRoutesInPreview is false */}
                  {(showRoutesInPreview || !previewMode) && player.route && player.route.length > 1 && (
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

                  {/* Blocking line — hidden in preview when showRoutesInPreview is false */}
                  {(showRoutesInPreview || !previewMode) && player.blockingLine && (
                    <g>
                      <line
                        x1={pos.x}
                        y1={pos.y}
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
                      cx={pos.x}
                      cy={pos.y}
                      r={markerSize / 2}
                      fill={playerColor}
                      stroke={isSelected ? "#0B2A5B" : "white"}
                      strokeWidth={isSelected ? "4" : "2"}
                      style={{ cursor: canEdit ? (tool === "select" ? "move" : "pointer") : "default" }}
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
                      onPointerDown={(e) => {
                        if (canEdit && tool === "select" && (e.pointerType === "pen" || e.pointerType === "touch")) {
                          handlePlayerDrag(player.id, e)
                        }
                      }}
                    />
                  )}
                  {player.shape === "square" && (
                    <rect
                      x={pos.x - markerSize / 2}
                      y={pos.y - markerSize / 2}
                      width={markerSize}
                      height={markerSize}
                      fill={playerColor}
                      stroke={isSelected ? "#0B2A5B" : "white"}
                      strokeWidth={isSelected ? "4" : "2"}
                      style={{ cursor: canEdit ? (tool === "select" ? "move" : "pointer") : "default" }}
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
                      onPointerDown={(e) => {
                        if (canEdit && tool === "select" && (e.pointerType === "pen" || e.pointerType === "touch")) {
                          handlePlayerDrag(player.id, e)
                        }
                      }}
                    />
                  )}
                  {player.shape === "triangle" && (
                    <polygon
                      points={`${pos.x},${pos.y + markerSize / 2} ${pos.x - markerSize / 2},${pos.y - markerSize / 2} ${pos.x + markerSize / 2},${pos.y - markerSize / 2}`}
                      fill={playerColor}
                      stroke={isSelected ? "#0B2A5B" : "white"}
                      strokeWidth={isSelected ? "4" : "2"}
                      style={{ cursor: canEdit ? (tool === "select" ? "move" : "pointer") : "default" }}
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
                      onPointerDown={(e) => {
                        if (canEdit && tool === "select" && (e.pointerType === "pen" || e.pointerType === "touch")) {
                          handlePlayerDrag(player.id, e)
                        }
                      }}
                    />
                  )}

                  {/* Player label: centered inside marker (position-based read-only; legacy editable via overlay) */}
                  {editingLabelId === player.id && !player.positionCode ? (
                    <foreignObject
                      x={pos.x - 20}
                      y={pos.y - 10}
                      width="40"
                      height="20"
                    >
                      <input
                        type="text"
                        value={editingLabelValue}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().slice(0, 2)
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
                          if (e.key === "Enter") e.currentTarget.blur()
                          else if (e.key === "Escape") {
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
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={Math.max(7, Math.min(11, Math.round(markerSize * 0.28)))}
                      fontWeight="bold"
                      style={{
                        cursor: canEdit && tool === "select" && !player.positionCode ? "pointer" : "default",
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (canEdit && tool === "select" && !player.positionCode) {
                          setEditingLabelId(player.id)
                          setEditingLabelValue(player.label)
                        }
                      }}
                    >
                      {player.label}
                    </text>
                  )}

                  {/* Assignment status dot (position-based markers only) */}
                  {player.positionCode && depthChartEntries?.length && (
                    <circle
                      cx={pos.x + markerSize / 2 - 5}
                      cy={pos.y - markerSize / 2 + 5}
                      r={4}
                      fill={assigned ? "#22c55e" : "#94a3b8"}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  )}

                  {/* Technique/Gap (defense) — secondary, below triangle */}
                  {player.shape === "triangle" && (player.technique || player.gap) && (
                    <text
                      x={pos.x}
                      y={pos.y + markerSize / 2 + 10}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      fill="white"
                      fillOpacity={0.85}
                      fontSize={8}
                      fontWeight="normal"
                      style={{ pointerEvents: "none" }}
                    >
                      {player.technique && player.gap ? `${player.technique}/${player.gap}` : player.technique || player.gap}
                    </text>
                  )}
                </g>
              )
            })}
            {editorInkStrokes.map((stroke, i) => {
              if (stroke.kind === "freehand" && stroke.points.length > 1) {
                return (
                  <polyline
                    key={`editor-ink-${i}`}
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
              if (stroke.kind === "arrow" && stroke.points.length >= 2) {
                const [a, b] = stroke.points
                const ang = Math.atan2(b.y - a.y, b.x - a.x)
                const ah = 14
                const aw = 8
                const x1 = b.x - ah * Math.cos(ang)
                const y1 = b.y - ah * Math.sin(ang)
                return (
                  <g key={`editor-arrow-${i}`} style={{ pointerEvents: "none" }}>
                    <line x1={a.x} y1={a.y} x2={x1} y2={y1} stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" />
                    <polygon
                      points={`${b.x},${b.y} ${x1 + aw * Math.sin(ang)},${y1 - aw * Math.cos(ang)} ${x1 - aw * Math.sin(ang)},${y1 + aw * Math.cos(ang)}`}
                      fill={stroke.color}
                    />
                  </g>
                )
              }
              return null
            })}
          </svg>
          </div>
        </div>
      </div>

      {canEdit && !previewMode && (
        <div
          className={`lg:hidden fixed z-40 flex flex-col gap-2 p-2 rounded-2xl bg-slate-950/96 border border-slate-700 shadow-2xl touch-manipulation ${
            tabletRailRight ? "right-1.5" : "left-1.5"
          } top-[40%] -translate-y-1/2 max-h-[min(72vh,520px)] overflow-y-auto`}
          aria-label="Drawing tools"
        >
          <Button
            type="button"
            size="icon"
            variant={tool === "select" ? "default" : "secondary"}
            className="h-14 w-14 shrink-0 rounded-2xl"
            onClick={() => {
              cancelRouteDraft()
              cancelBlockDraft()
              cancelMotionDraft()
              setTool("select")
            }}
            title="Select"
          >
            <Move className="h-7 w-7" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={tool === "draw" ? "default" : "secondary"}
            className="h-14 w-14 shrink-0 rounded-2xl"
            onClick={() => {
              cancelBlockDraft()
              cancelMotionDraft()
              setTool("draw")
            }}
            title="Pen"
          >
            <Pen className="h-7 w-7" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={tool === "route" ? "default" : "secondary"}
            className="h-14 w-14 shrink-0 rounded-2xl"
            disabled={currentSide !== "offense"}
            onClick={() => {
              cancelBlockDraft()
              cancelMotionDraft()
              setTool("route")
            }}
            title="Route"
          >
            <Pencil className="h-7 w-7" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={tool === "ink_arrow" ? "default" : "secondary"}
            className="h-14 w-14 shrink-0 rounded-2xl"
            onClick={() => {
              cancelBlockDraft()
              cancelMotionDraft()
              setTool("ink_arrow")
            }}
            title="Arrow"
          >
            <ArrowRight className="h-7 w-7" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={tool === "erase" ? "default" : "secondary"}
            className="h-14 w-14 shrink-0 rounded-2xl"
            onClick={() => {
              cancelRouteDraft()
              setTool("erase")
            }}
            title="Erase"
          >
            <Eraser className="h-7 w-7" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-10 w-14 shrink-0 rounded-xl text-xs"
            onClick={() => setTabletRailRight((v) => !v)}
            title="Move tool rail"
          >
            ⇄
          </Button>
        </div>
      )}

      {canEdit && (
        <>
          <div
            className="lg:hidden flex-shrink-0 flex items-stretch gap-1.5 px-2 pt-2 z-30 rounded-t-3xl bg-slate-950/98 backdrop-blur-xl border-t border-slate-800 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]"
            style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))" }}
          >
            <Button
              type="button"
              variant={mobilePaletteOpen ? "default" : "secondary"}
              className="flex-1 h-[52px] rounded-2xl text-[10px] font-bold shrink min-w-0 flex-col gap-0.5 bg-slate-800 text-slate-100 border-slate-700"
              onClick={() => setMobilePaletteOpen(true)}
            >
              <MoreHorizontal className="h-5 w-5" />
              Players
            </Button>
            <Button
              type="button"
              variant={tool === "select" ? "default" : "secondary"}
              className={`flex-1 h-[52px] rounded-2xl text-[10px] font-bold min-w-0 flex-col gap-0.5 ${tool === "select" ? "bg-emerald-600 hover:bg-emerald-500 text-white border-0" : "bg-slate-800 text-slate-100 border-slate-700"}`}
              onClick={() => {
                cancelRouteDraft()
                cancelBlockDraft()
                cancelMotionDraft()
                setTool("select")
                setSelectedPlayerId(null)
              }}
            >
              <Move className="h-5 w-5" />
              Select
            </Button>
            <Button
              type="button"
              variant={tool === "route" ? "default" : "secondary"}
              className={`flex-1 h-[52px] rounded-2xl text-[10px] font-bold min-w-0 flex-col gap-0.5 ${tool === "route" ? "bg-emerald-600 text-white border-0" : "bg-slate-800 text-slate-100 border-slate-700"}`}
              onClick={() => {
                cancelBlockDraft()
                cancelMotionDraft()
                setTool("route")
              }}
              disabled={currentSide !== "offense"}
            >
              <Pencil className="h-5 w-5" />
              Route
            </Button>
            <Button
              type="button"
              variant={["motion", "block", "zone", "erase", "man", "draw", "ink_arrow"].includes(tool) ? "default" : "secondary"}
              className={`flex-1 h-[52px] rounded-2xl text-[10px] font-bold min-w-0 px-1 flex-col gap-0.5 ${["motion", "block", "zone", "erase", "man", "draw", "ink_arrow"].includes(tool) ? "bg-amber-600 text-white border-0" : "bg-slate-800 text-slate-100 border-slate-700"}`}
              onClick={() => setMobilePaletteOpen(true)}
            >
              <Square className="h-5 w-5" />
              More
            </Button>
          </div>
          {!isTemplateMode && (
            <div
              className="lg:hidden flex flex-wrap items-center justify-center gap-2 px-2 py-2 z-20 bg-slate-900/95 border-t border-slate-800"
              style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
            >
              <Button type="button" size="sm" variant="secondary" className="h-10 rounded-xl" onClick={undo} disabled={undoStack.length === 0}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Undo
              </Button>
              <Button type="button" size="sm" variant="secondary" className="h-10 rounded-xl" onClick={redo} disabled={redoStack.length === 0}>
                <RotateCw className="h-4 w-4 mr-1" />
                Redo
              </Button>
              <Button type="button" size="sm" variant="secondary" className="h-10 rounded-xl" onClick={undoEditorInk} disabled={editorInkUndoStack.length === 0}>
                <Undo2 className="h-4 w-4 mr-1" />
                Ink
              </Button>
              <Button type="button" size="sm" variant="secondary" className="h-10 rounded-xl" onClick={clearEditorInk} disabled={editorInkStrokes.length === 0}>
                Clear ink
              </Button>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-300 px-1">
                <input type="checkbox" checked={allowFingerDrawing} onChange={(e) => setFingerDrawPref(e.target.checked)} className="rounded" />
                Finger draw
              </label>
              {(tool === "draw" || tool === "ink_arrow") && (
                <div className="flex items-center gap-1">
                  {DRAW_COLORS.map((c, i) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 shrink-0 ${drawColorIdx === i ? "border-white" : "border-slate-600"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setDrawColorIdx(i)}
                    />
                  ))}
                </div>
              )}
              {(tool === "draw" || tool === "ink_arrow") && (
                <div className="flex gap-1">
                  {strokeWidthChoices.map((w, i) => (
                    <Button
                      key={w}
                      type="button"
                      size="sm"
                      variant={drawWidthIdx === i ? "default" : "secondary"}
                      className="h-9 min-w-[2.25rem] px-2 rounded-lg text-xs"
                      onClick={() => setDrawWidthIdx(i)}
                    >
                      {w}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          <PlaybookBottomSheet open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen} title="Tools & positions" className="max-h-[min(88vh,640px)]">
            <div className="w-full min-w-0 [&>div]:!w-full [&>div]:max-w-full">
            <PlaybookShapePalette
              currentSide={currentSide}
              selectedTool={tool}
              onSelectTool={(newTool) => {
                cancelRouteDraft()
                cancelBlockDraft()
                cancelMotionDraft()
                setHoveredPlayerId(null)
                setTool(newTool)
                if (newTool === "select") setSelectedPlayerId(null)
                else if (newTool === "man") setManCoverageStart(null)
                setMobilePaletteOpen(false)
              }}
              isTemplateMode={isTemplateMode}
              canEdit={canEdit}
            />
            </div>
          </PlaybookBottomSheet>
        </>
      )}
    </div>
  )
}
