"use client"

import { PlayCardThumbnail } from "@/components/portal/play-card-thumbnail"
import type { PlayRecord, PlayType } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"

const PLAY_TYPE_STYLE: Record<PlayType, { bg: string; label: string }> = {
  run: { bg: "bg-red-600", label: "RUN" },
  pass: { bg: "bg-blue-600", label: "PASS" },
  rpo: { bg: "bg-amber-600", label: "RPO" },
  screen: { bg: "bg-emerald-600", label: "SCREEN" },
}

export interface CompactPlayCardProps {
  play: PlayRecord
  /** Optional: show remove button and call onRemove */
  onRemove?: () => void
  /** Optional: click handler (e.g. open detail) */
  onClick?: () => void
  /** Size: default 'md'. 'sm' for tighter layout, 'lg' for game day. */
  size?: "sm" | "md" | "lg"
}

export function CompactPlayCard({ play, onRemove, onClick, size = "md" }: CompactPlayCardProps) {
  const canvasData = play.canvasData as PlayCanvasData | null
  const playType = play.playType ?? null
  const typeStyle = playType && PLAY_TYPE_STYLE[playType] ? PLAY_TYPE_STYLE[playType] : null

  const thumbClass = size === "sm" ? "w-16 h-11" : size === "lg" ? "w-28 h-20" : "w-20 h-14"
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"

  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      className={`
        flex items-center gap-2 rounded-lg border border-slate-200 bg-white overflow-hidden
        ${onClick ? "cursor-pointer hover:bg-slate-50 transition-colors" : ""}
        ${size === "lg" ? "p-2 gap-3" : "p-1.5"}
      `}
    >
      <div className={`${thumbClass} flex-shrink-0 rounded-md overflow-hidden bg-[#2d5016] relative`}>
        <PlayCardThumbnail canvasData={canvasData} className="w-full h-full" />
        {typeStyle && (
          <span
            className={`absolute top-0.5 left-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${typeStyle.bg}`}
          >
            {typeStyle.label}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-slate-800 truncate ${textSize}`}>{play.name}</p>
        {(play.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {(play.tags ?? []).slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {tag}
              </span>
            ))}
            {(play.tags ?? []).length > 3 && (
              <span className="text-[10px] text-slate-400">+{(play.tags ?? []).length - 3}</span>
            )}
          </div>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 print:hidden"
          aria-label="Remove from section"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
