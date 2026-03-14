"use client"

import { useMemo } from "react"
import { PlaybookFieldSurface, FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { getConceptOverlay } from "@/lib/constants/concept-overlay-shapes"
import type { TemplateData } from "@/types/playbook"

const VIEWBOX_W = 800
const VIEWBOX_H = 600
const YARD_START = 15
const YARD_END = 50

const OVERLAY_STROKE_WIDTH = 3

/** Category-based overlay colors (slate-aligned, readable on field) */
const OVERLAY_COLORS: Record<string, string> = {
  run: "rgba(22, 163, 74, 0.9)",           // green-600
  pass: "rgba(59, 130, 246, 0.9)",         // blue-500
  play_action: "rgba(139, 92, 246, 0.9)", // violet-500
  rpo: "rgba(20, 184, 166, 0.9)",         // teal-500
  option: "rgba(20, 184, 166, 0.9)",     // teal
}
const OVERLAY_FALLBACK = "rgba(71, 85, 105, 0.9)" // slate-600

function getOverlayColorForConcept(concept: { name: string; category?: string }): string {
  const cat = (concept.category ?? "").trim().toLowerCase().replace(/\s+/g, "_")
  if (cat && OVERLAY_COLORS[cat]) return OVERLAY_COLORS[cat]
  const name = concept.name.toLowerCase()
  if (name.includes("zone") || name.includes("power") || name.includes("iso") || name.includes("counter") || name.includes("sweep") || name.includes("belly")) return OVERLAY_COLORS.run
  if (name.includes("boot") || name.includes("pa ")) return OVERLAY_COLORS.play_action
  if (name.includes("rpo") || name.includes("read")) return OVERLAY_COLORS.rpo
  return OVERLAY_FALLBACK
}

export interface PreviewConcept {
  name: string
  category?: string
}

interface FormationPreviewProps {
  templateData: TemplateData | null
  side: "offense" | "defense" | "special_teams"
  /** When set, a lightweight concept overlay is drawn on top of the formation (hover or selected). */
  previewConcept?: PreviewConcept | null
  className?: string
}

/**
 * Read-only formation preview using the same field and player rendering as the play editor/presenter.
 * No marker tools, icons, or animation. Uses xYards/yYards for correct spacing.
 */
export function FormationPreview({ templateData, side, previewConcept = null, className = "" }: FormationPreviewProps) {
  const overlay = useMemo(() => (previewConcept ? getConceptOverlay(previewConcept.name) : null), [previewConcept])
  const overlayColor = useMemo(() => (previewConcept ? getOverlayColorForConcept(previewConcept) : OVERLAY_FALLBACK), [previewConcept])

  const { coord, players, playerColor } = useMemo(() => {
    const coord = new FieldCoordinateSystem(VIEWBOX_W, VIEWBOX_H, YARD_START, YARD_END)
    if (!templateData?.shapes?.length) {
      return { coord, players: [] as { id: string; x: number; y: number; label: string; shape: string }[], playerColor: "#3B82F6" }
    }
    const canvasData = templateDataToCanvasData(templateData, side)
    const players = (canvasData.players ?? []).map((p) => {
      const raw = p as { xYards?: number; yYards?: number; x?: number; y?: number }
      const hasYards = typeof raw.xYards === "number" && typeof raw.yYards === "number"
      const xYards = hasYards ? raw.xYards! : 0
      const yYards = hasYards ? raw.yYards! : 0
      const pixel = coord.yardToPixel(xYards, yYards)
      return {
        id: p.id,
        x: pixel.x,
        y: pixel.y,
        label: p.label ?? "X",
        shape: p.shape ?? "circle",
      }
    })
    const isOffense = side === "offense" || side === "special_teams"
    const playerColor = isOffense ? "#3B82F6" : "#DC2626"
    return { coord, players, playerColor }
  }, [templateData, side])

  const markerSize = coord.getMarkerSize()
  const hasPlayers = players.length > 0

  if (!hasPlayers) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 ${className}`}
        style={{ minHeight: 280 }}
      >
        <p className="text-sm">No formation template available</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${className}`}>
      {previewConcept && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 bg-slate-100/80">
          <p className="text-sm font-medium text-slate-800">Previewing: {previewConcept.name}</p>
          {previewConcept.category && (
            <p className="text-xs text-slate-500 mt-0.5">{previewConcept.category} concept</p>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1" style={{ aspectRatio: `${VIEWBOX_W}/${VIEWBOX_H}` }}>
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          className="w-full h-full block touch-none"
          preserveAspectRatio="xMidYMid meet"
          style={{ background: "#2d5016" }}
        >
        <PlaybookFieldSurface width={VIEWBOX_W} height={VIEWBOX_H} yardStart={YARD_START} yardEnd={YARD_END} />
        {players.map((p) => {
          const r = markerSize / 2
          const fontSize = Math.max(7, Math.min(11, Math.round(markerSize * 0.28)))
          return (
            <g key={p.id} style={{ pointerEvents: "none" }}>
              {p.shape === "circle" && (
                <circle cx={p.x} cy={p.y} r={r} fill={playerColor} stroke="white" strokeWidth={2} />
              )}
              {p.shape === "square" && (
                <rect
                  x={p.x - r}
                  y={p.y - r}
                  width={r * 2}
                  height={r * 2}
                  fill={playerColor}
                  stroke="white"
                  strokeWidth={2}
                />
              )}
              {p.shape === "triangle" && (
                <polygon
                  points={`${p.x},${p.y + r} ${p.x - r},${p.y - r} ${p.x + r},${p.y - r}`}
                  fill={playerColor}
                  stroke="white"
                  strokeWidth={2}
                />
              )}
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
            </g>
          )
        })}
        {overlay?.routes?.map((route, i) => {
          if (!route.points?.length) return null
          const pts = route.points
            .map((pt) => coord.yardToPixel(pt.xYards, pt.yYards))
            .map((p) => `${p.x},${p.y}`)
            .join(" ")
          return (
            <polyline
              key={i}
              points={pts}
              fill="none"
              stroke={overlayColor}
              strokeWidth={OVERLAY_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: "none" }}
            />
          )
        })}
        </svg>
      </div>
    </div>
  )
}
