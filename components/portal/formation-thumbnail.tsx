"use client"

import { useMemo } from "react"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import type { TemplateData } from "@/types/playbook"

const THUMB_WIDTH = 200
const THUMB_HEIGHT = 140
const YARD_START = 15
const YARD_END = 50

function shapeKindToShape(kind: string): "circle" | "square" | "triangle" {
  if (kind === "CENTER_SQUARE" || kind === "SPECIAL_TEAMS_SQUARE") return "square"
  if (kind === "DEFENSE_TRIANGLE") return "triangle"
  return "circle"
}

interface FormationThumbnailProps {
  templateData: TemplateData | null
  side: "offense" | "defense" | "special_teams"
  className?: string
}

/**
 * Mini field thumbnail for formation/sub-formation cards. Renders formation alignment from template shapes.
 */
export function FormationThumbnail({ templateData, side, className = "" }: FormationThumbnailProps) {
  const players = useMemo(() => {
    if (!templateData?.shapes?.length) return []
    const coord = new FieldCoordinateSystem(THUMB_WIDTH, THUMB_HEIGHT, YARD_START, YARD_END)
    const markerSize = Math.max(4, Math.min(8, coord.getMarkerSize() * 0.35))
    return templateData.shapes.map((s) => {
      const { x, y } = coord.yardToPixel(s.xYards, s.yYards)
      return { x, y, shape: shapeKindToShape(s.kind), markerSize, label: s.label ?? "" }
    })
  }, [templateData])

  const color = side === "defense" ? "#DC2626" : "#3B82F6"

  return (
    <div
      className={`relative overflow-hidden rounded-t-lg bg-[#2d5016] ${className}`}
      style={{ aspectRatio: `${THUMB_WIDTH}/${THUMB_HEIGHT}` }}
    >
      <svg
        viewBox={`0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}`}
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
      >
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
        {players.map((p, i) => {
          const r = p.markerSize
          const fontSize = Math.max(6, Math.min(10, Math.round(r * 0.6)))
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
