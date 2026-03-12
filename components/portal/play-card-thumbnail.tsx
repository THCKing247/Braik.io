"use client"

import { useMemo } from "react"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import type { PlayCanvasData } from "@/types/playbook"

const THUMB_WIDTH = 200
const THUMB_HEIGHT = 140
const YARD_START = 15
const YARD_END = 50

interface PlayCardThumbnailProps {
  canvasData: PlayCanvasData | null
  className?: string
}

interface PlayerThumb {
  x: number
  y: number
  shape: string
  markerSize: number
  label: string
  routePoints?: Array<{ x: number; y: number }>
  blockEnd?: { x: number; y: number }
}

/**
 * Mini field thumbnail for play cards. Renders field, player positions, routes, and blocks.
 * Centered and legible at card size.
 */
export function PlayCardThumbnail({ canvasData, className = "" }: PlayCardThumbnailProps) {
  const { players, side } = useMemo(() => {
    if (!canvasData?.players?.length) {
      return { players: [] as PlayerThumb[], side: "offense" as const }
    }
    const coord = new FieldCoordinateSystem(THUMB_WIDTH, THUMB_HEIGHT, YARD_START, YARD_END)
    const markerSize = Math.max(5, Math.min(9, coord.getMarkerSize() * 0.4))
    const players: PlayerThumb[] = canvasData.players.map((p) => {
      const xYards = p.xYards ?? 0
      const yYards = p.yYards ?? 0
      const { x, y } = coord.yardToPixel(xYards, yYards)
      const routePoints: Array<{ x: number; y: number }> | undefined = p.route?.length
        ? p.route.map((pt) => {
            const xY = "xYards" in pt && "yYards" in pt ? coord.yardToPixel(pt.xYards, pt.yYards) : { x: (pt as { x?: number }).x ?? x, y: (pt as { y?: number }).y ?? y }
            return xY
          })
        : undefined
      const blockEnd =
        p.blockingLine && "xYards" in p.blockingLine
          ? coord.yardToPixel(p.blockingLine.xYards, p.blockingLine.yYards)
          : p.blockingLine && "x" in p.blockingLine && p.blockingLine.x != null
          ? { x: p.blockingLine.x, y: (p.blockingLine as { y?: number }).y ?? y }
          : undefined
      return {
        x,
        y,
        shape: p.shape,
        markerSize,
        label: p.label ?? "",
        routePoints,
        blockEnd,
      }
    })
    return { players, side: canvasData.side ?? "offense" }
  }, [canvasData])

  const color = side === "defense" ? "#DC2626" : "#3B82F6"
  const routeColor = "#FBBF24"
  const blockColor = "#EF4444"

  return (
    <div className={`relative overflow-hidden rounded-t-lg bg-[#2d5016] ${className}`} style={{ aspectRatio: `${THUMB_WIDTH}/${THUMB_HEIGHT}` }}>
      <svg
        viewBox={`0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}`}
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Field */}
        <rect x={0} y={0} width={THUMB_WIDTH} height={THUMB_HEIGHT} fill="#2d5016" />
        <line x1={0} y1={0} x2={0} y2={THUMB_HEIGHT} stroke="white" strokeWidth={1.5} opacity={0.9} />
        <line x1={THUMB_WIDTH} y1={0} x2={THUMB_WIDTH} y2={THUMB_HEIGHT} stroke="white" strokeWidth={1.5} opacity={0.9} />
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={0}
            y1={THUMB_HEIGHT * t}
            x2={THUMB_WIDTH}
            y2={THUMB_HEIGHT * t}
            stroke="white"
            strokeWidth={0.8}
            opacity={0.4}
          />
        ))}
        {/* Routes (draw under markers so they read clearly) */}
        {players.map((p, i) => {
          if (p.routePoints && p.routePoints.length >= 1) {
            const start = { x: p.x, y: p.y }
            const points = [start, ...p.routePoints]
            const pathD = points.map((pt, j) => `${j === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")
            return <path key={`route-${i}`} d={pathD} fill="none" stroke={routeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
          }
          if (p.blockEnd) {
            return (
              <line
                key={`block-${i}`}
                x1={p.x}
                y1={p.y}
                x2={p.blockEnd.x}
                y2={p.blockEnd.y}
                stroke={blockColor}
                strokeWidth={1.2}
                strokeLinecap="round"
                opacity={0.9}
              />
            )
          }
          return null
        })}
        {/* Player markers */}
        {players.map((p, i) => {
          const r = p.markerSize
          const fontSize = Math.max(6, Math.min(9, Math.round(r * 0.65)))
          return (
            <g key={i}>
              {p.shape === "circle" && (
                <circle cx={p.x} cy={p.y} r={r} fill={color} stroke="white" strokeWidth={1.2} />
              )}
              {p.shape === "square" && (
                <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} fill={color} stroke="white" strokeWidth={1.2} />
              )}
              {p.shape === "triangle" && (
                <polygon
                  points={`${p.x},${p.y + r} ${p.x - r},${p.y - r} ${p.x + r},${p.y - r}`}
                  fill={color}
                  stroke="white"
                  strokeWidth={1.2}
                />
              )}
              {p.label && (
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={fontSize}
                  fontWeight="bold"
                  style={{ pointerEvents: "none" }}
                >
                  {p.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
