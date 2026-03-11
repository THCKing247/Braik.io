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

/**
 * Mini field thumbnail for play cards. Renders a simplified field and player positions.
 * Handles missing/corrupt data gracefully.
 */
export function PlayCardThumbnail({ canvasData, className = "" }: PlayCardThumbnailProps) {
  const { players, side } = useMemo(() => {
    if (!canvasData?.players?.length) {
      return { players: [] as Array<{ x: number; y: number; shape: string; markerSize: number }>, side: "offense" as const }
    }
    const coord = new FieldCoordinateSystem(THUMB_WIDTH, THUMB_HEIGHT, YARD_START, YARD_END)
    const markerSize = Math.max(4, Math.min(8, coord.getMarkerSize() * 0.35))
    const players = canvasData.players.map((p) => {
      const xYards = p.xYards ?? 0
      const yYards = p.yYards ?? 0
      const { x, y } = coord.yardToPixel(xYards, yYards)
      return { x, y, shape: p.shape, markerSize }
    })
    return { players, side: canvasData.side ?? "offense" }
  }, [canvasData])

  const color = side === "defense" ? "#DC2626" : "#3B82F6"

  return (
    <div className={`relative overflow-hidden rounded-lg bg-[#2d5016] ${className}`} style={{ aspectRatio: `${THUMB_WIDTH}/${THUMB_HEIGHT}` }}>
      <svg
        viewBox={`0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}`}
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Simplified field: turf + sideline outlines */}
        <rect x={0} y={0} width={THUMB_WIDTH} height={THUMB_HEIGHT} fill="#2d5016" />
        <line x1={0} y1={0} x2={0} y2={THUMB_HEIGHT} stroke="white" strokeWidth={1.5} opacity={0.9} />
        <line x1={THUMB_WIDTH} y1={0} x2={THUMB_WIDTH} y2={THUMB_HEIGHT} stroke="white" strokeWidth={1.5} opacity={0.9} />
        {/* Minimal yard lines */}
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
        {/* Player markers */}
        {players.map((p, i) => {
          const r = p.markerSize
          return (
            <g key={i}>
              {p.shape === "circle" && (
                <circle cx={p.x} cy={p.y} r={r} fill={color} stroke="white" strokeWidth={1} />
              )}
              {p.shape === "square" && (
                <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} fill={color} stroke="white" strokeWidth={1} />
              )}
              {p.shape === "triangle" && (
                <polygon
                  points={`${p.x},${p.y + r} ${p.x - r},${p.y - r} ${p.x + r},${p.y - r}`}
                  fill={color}
                  stroke="white"
                  strokeWidth={1}
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
