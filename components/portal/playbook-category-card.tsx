"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { SideOfBall } from "@/types/playbook"

/** Football-style icon (oval with laces) for category cards. */
function FootballIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <ellipse
        cx="24"
        cy="14"
        rx="22"
        ry="12"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M8 14h32M24 6v16M14 8l20 12M14 20l20-12M18 10l12 8M18 18l12-8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}

interface PlaybookCategoryCardProps {
  side: SideOfBall
  label: string
  description: string
  formationCount: number
  playCount: number
  formationNames: string[]
  onSelect: () => void
  browseLabel: string
  onCreateFormation?: () => void
  canEdit: boolean
  className?: string
}

const ACCENT = {
  offense: {
    card: "bg-gradient-to-br from-blue-50/90 to-white border-blue-200/80 hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5",
    iconBg: "bg-blue-500/20",
    icon: "text-blue-600",
    counts: "text-blue-700",
    emptyBorder: "border-blue-200/60",
  },
  defense: {
    card: "bg-gradient-to-br from-red-50/90 to-white border-red-200/80 hover:border-red-400 hover:shadow-lg hover:-translate-y-0.5",
    iconBg: "bg-red-500/20",
    icon: "text-red-600",
    counts: "text-red-700",
    emptyBorder: "border-red-200/60",
  },
  special_teams: {
    card: "bg-gradient-to-br from-amber-50/90 to-white border-amber-200/80 hover:border-amber-400 hover:shadow-lg hover:-translate-y-0.5",
    iconBg: "bg-amber-500/20",
    icon: "text-amber-600",
    counts: "text-amber-800",
    emptyBorder: "border-amber-200/60",
  },
} as const

export function PlaybookCategoryCard({
  side,
  label,
  description,
  formationCount,
  playCount,
  formationNames,
  onSelect,
  browseLabel,
  onCreateFormation,
  canEdit,
  className,
}: PlaybookCategoryCardProps) {
  const accent = ACCENT[side]

  return (
    <Card
      className={`cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200 ease-out min-w-[220px] ${accent.card} ${className ?? ""}`}
      onClick={onSelect}
    >
      <CardContent className="p-5 flex flex-col min-h-[220px]">
        {/* Top row: icon + counts */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className={`rounded-xl p-2.5 ${accent.iconBg}`}>
            <FootballIcon className={`h-9 w-9 ${accent.icon}`} />
          </div>
          <div className="flex flex-shrink-0 gap-5 text-right">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Formations</p>
              <p className={`text-lg font-semibold tabular-nums leading-tight ${accent.counts}`}>{formationCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Plays</p>
              <p className={`text-lg font-semibold tabular-nums leading-tight ${accent.counts}`}>{playCount}</p>
            </div>
          </div>
        </div>

        {/* Middle: title + description */}
        <h3 className="font-semibold text-base text-slate-800 mb-1.5">{label}</h3>
        <p className="text-sm leading-relaxed text-slate-600 mb-4 flex-1">{description}</p>

        {/* Formation preview or empty state */}
        <div className="pt-4 border-t border-slate-200/80">
          {formationNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {formationNames.slice(0, 5).map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded-lg bg-white/90 border border-slate-200/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                >
                  {name}
                </span>
              ))}
              {formationCount > formationNames.length && (
                <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-500">
                  +{formationCount - formationNames.length}
                </span>
              )}
            </div>
          ) : (
            <div className={`rounded-xl border border-dashed ${accent.emptyBorder} bg-white/60 px-4 py-4 text-center`}>
              <p className="text-sm font-medium text-slate-600">No formations yet</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Create your first formation to start building this side of the ball.
              </p>
            </div>
          )}
        </div>

        {/* Bottom: action row */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200/60" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" className="h-9 flex-1 rounded-lg border-slate-200 text-slate-700" onClick={onSelect}>
            {browseLabel}
          </Button>
          {canEdit && onCreateFormation && (
            <Button size="sm" variant="secondary" className="h-9 rounded-lg" onClick={onCreateFormation}>
              Create Formation
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
