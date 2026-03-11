"use client"

import { useEffect, useCallback, useMemo, useRef, useState } from "react"
import { X, ChevronLeft, ChevronRight, Pencil, Eraser } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlaybookFieldSurface, FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { clientToViewBox } from "@/lib/utils/canvas-coords"
import { getPlayFormationDisplayName } from "@/lib/utils/playbook-formation"
import type { PlayRecord, PlayCanvasData, RoutePoint, BlockEndPoint, FormationRecord } from "@/types/playbook"

type PresenterTool = "none" | "marker"

const FIELD_WIDTH_YARDS = 53.33
const VISIBLE_YARDS = 35
const YARD_START = 15
const YARD_END = 50
const VIEWBOX_W = 800
const VIEWBOX_H = 600

interface PlaycallerViewProps {
  plays: PlayRecord[]
  currentIndex: number
  onClose: () => void
  onIndexChange: (index: number) => void
  /** When provided, formation name is resolved from the record (formationId-first). */
  formations?: FormationRecord[] | null
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
): Array<{ id: string; x: number; y: number; label: string; shape: string; route?: RoutePoint[]; blockingLine?: BlockEndPoint }> {
  if (!canvasData?.players?.length) return []
  return canvasData.players.map((p) => {
    const pixel = coord.yardToPixel(p.xYards, p.yYards)
    return {
      id: p.id,
      x: pixel.x,
      y: pixel.y,
      label: p.label,
      shape: p.shape,
      route: p.route,
      blockingLine: p.blockingLine,
    }
  })
}

export function PlaycallerView({ plays, currentIndex, onClose, onIndexChange, formations }: PlaycallerViewProps) {
  const coord = usePresenterCoord()
  const play = plays[currentIndex]
  const canvasData = play?.canvasData as PlayCanvasData | null
  const players = getPlayersFromCanvas(canvasData, coord)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<PresenterTool>("none")
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([])
  const [activeStroke, setActiveStroke] = useState<{ x: number; y: number }[] | null>(null)

  const clientToViewBoxPoint = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()
    const pt = clientToViewBox(clientX, clientY, rect, VIEWBOX_W, VIEWBOX_H)
    return { x: Math.max(0, Math.min(VIEWBOX_W, pt.x)), y: Math.max(0, Math.min(VIEWBOX_H, pt.y)) }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (tool !== "marker") return
      e.preventDefault()
      const pt = clientToViewBoxPoint(e.clientX, e.clientY)
      if (pt) {
        setActiveStroke([pt])
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    },
    [tool, clientToViewBoxPoint]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (tool !== "marker" || !activeStroke) return
      e.preventDefault()
      const pt = clientToViewBoxPoint(e.clientX, e.clientY)
      if (pt) setActiveStroke((prev) => (prev ? [...prev, pt] : [pt]))
    },
    [tool, activeStroke, clientToViewBoxPoint]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.releasePointerCapture(e.pointerId)
      if (tool === "marker" && activeStroke && activeStroke.length > 0) {
        setStrokes((prev) => [...prev, activeStroke])
        setActiveStroke(null)
      }
    },
    [tool, activeStroke]
  )

  const handlePointerLeave = useCallback(() => {
    if (tool === "marker" && activeStroke && activeStroke.length > 0) {
      setStrokes((prev) => [...prev, activeStroke])
      setActiveStroke(null)
    }
  }, [tool, activeStroke])

  const clearDrawings = useCallback(() => {
    setStrokes([])
    setActiveStroke(null)
    setTool("none")
  }, [])

  const goPrev = useCallback(() => {
    onIndexChange(Math.max(0, currentIndex - 1))
  }, [currentIndex, onIndexChange])

  const goNext = useCallback(() => {
    onIndexChange(Math.min(plays.length - 1, currentIndex + 1))
  }, [currentIndex, plays.length, onIndexChange])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, goPrev, goNext])

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

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
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
          <Button
            variant={tool === "marker" ? "secondary" : "outline"}
            size="icon"
            onClick={() => setTool((t) => (t === "marker" ? "none" : "marker"))}
            title="Draw on play"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={clearDrawings} title="Clear drawings">
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl aspect-[53.33/35] max-h-[85vh] rounded-lg overflow-hidden shadow-2xl border border-border">
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
            <PlaybookFieldSurface width={VIEWBOX_W} height={VIEWBOX_H} yardStart={YARD_START} yardEnd={YARD_END} />
            {/* Routes and blocking lines first so they render under players */}
            {players.map((p) => (
              <g key={`routes-${p.id}`}>
                {p.route && p.route.length > 1 && (
                  <>
                    <polyline
                      points={p.route.map((pt) => {
                        const px = routePointToPixel(pt, coord)
                        return `${px.x},${px.y}`
                      }).join(" ")}
                      fill="none"
                      stroke={playerColor}
                      strokeWidth={2}
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
                  </>
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
            ))}
            {players.map((p) => (
              <g key={p.id}>
                {p.shape === "circle" && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={markerSize / 2}
                    fill={playerColor}
                    stroke="white"
                    strokeWidth={2}
                  />
                )}
                {p.shape === "square" && (
                  <rect
                    x={p.x - markerSize / 2}
                    y={p.y - markerSize / 2}
                    width={markerSize}
                    height={markerSize}
                    fill={playerColor}
                    stroke="white"
                    strokeWidth={2}
                  />
                )}
                {p.shape === "triangle" && (
                  <polygon
                    points={`${p.x},${p.y + markerSize / 2} ${p.x - markerSize / 2},${p.y - markerSize / 2} ${p.x + markerSize / 2},${p.y - markerSize / 2}`}
                    fill={playerColor}
                    stroke="white"
                    strokeWidth={2}
                  />
                )}
                <text
                  x={p.x}
                  y={p.y + markerSize / 2 + 12}
                  textAnchor="middle"
                  fill="white"
                  fontSize={12}
                  fontWeight="bold"
                >
                  {p.label}
                </text>
              </g>
            ))}
            {/* Marker strokes (presenter drawings) */}
            {strokes.map((stroke, i) =>
              stroke.length > 1 ? (
                <polyline
                  key={i}
                  points={stroke.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null
            )}
            {activeStroke && activeStroke.length > 1 && (
              <polyline
                points={activeStroke.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#FBBF24"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* Overlay to capture pointer when marker is active */}
            <rect
              width={VIEWBOX_W}
              height={VIEWBOX_H}
              fill="transparent"
              pointerEvents={tool === "marker" ? "all" : "none"}
            />
          </svg>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-foreground">{play.name}</p>
        <p className="text-xs text-muted-foreground">
          {getPlayFormationDisplayName(play, formations)} · {play.side.replace("_", " ")}
        </p>
      </div>
    </div>
  )
}
