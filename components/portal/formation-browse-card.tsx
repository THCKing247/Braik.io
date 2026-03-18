"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FormationThumbnail } from "@/components/portal/formation-thumbnail"
import { Copy, Pencil, Trash2 } from "lucide-react"
import type { FormationRecord } from "@/types/playbook"

function FootballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <ellipse cx="24" cy="14" rx="22" ry="12" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
      <path d="M8 14h32M24 6v16M14 8l20 12M14 20l20-12M18 10l12 8M18 18l12-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
    </svg>
  )
}

interface FormationBrowseCardProps {
  formation: FormationRecord
  subformationCount: number
  playCount: number
  onSelect: () => void
  canEdit?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
}

export function FormationBrowseCard({
  formation,
  subformationCount,
  playCount,
  onSelect,
  canEdit,
  onEdit,
  onDelete,
  onDuplicate,
}: FormationBrowseCardProps) {
  const isOffense = formation.side === "offense"
  const isDefense = formation.side === "defense"
  const barBg = isOffense ? "bg-blue-600" : isDefense ? "bg-red-600" : "bg-amber-600"
  const accentBg = isOffense
    ? "bg-blue-500/10 border-blue-200 hover:border-blue-500"
    : isDefense
      ? "bg-red-500/10 border-red-200 hover:border-red-500"
      : "bg-amber-500/10 border-amber-200 hover:border-amber-500"
  const hasTemplate = formation.templateData?.shapes?.length > 0

  return (
    <Card
      className={`min-w-0 max-w-full cursor-pointer overflow-hidden border-2 transition-all shadow-sm rounded-2xl p-0 relative ${accentBg}`}
      onClick={onSelect}
    >
      <div className="relative w-full min-w-0 overflow-hidden rounded-t-2xl">
        {hasTemplate ? (
          <FormationThumbnail templateData={formation.templateData} side={formation.side} className="rounded-t-2xl min-h-[140px] sm:min-h-[160px]" />
        ) : (
          <div className="aspect-[200/140] min-h-[120px] flex items-center justify-center bg-slate-100 rounded-t-2xl">
            <FootballIcon className={`h-14 w-14 sm:h-16 sm:w-16 ${isOffense ? "text-blue-500/50" : isDefense ? "text-red-500/50" : "text-amber-500/50"}`} />
          </div>
        )}
      </div>
      <div className={`relative ${barBg} px-3 py-2.5 lg:py-3 text-center min-w-0`}>
        <span className="font-bold text-white text-base lg:text-lg tracking-tight block truncate px-8 lg:px-10" title={formation.name}>
          {formation.name}
        </span>
        {/* Desktop: overlay action icons */}
        {canEdit && (onEdit || onDuplicate || onDelete) && (
          <div className="hidden lg:flex absolute top-1/2 right-2 -translate-y-1/2 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/90 hover:text-white hover:bg-white/20" onClick={onEdit} title="Edit formation">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDuplicate && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/90 hover:text-white hover:bg-white/20" onClick={onDuplicate} title="Duplicate formation">
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/90 hover:text-red-200 hover:bg-white/20" onClick={onDelete} title="Delete formation">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
      <CardContent className="p-3 lg:p-4 flex flex-col gap-2 lg:gap-3 min-h-0">
        <div className="flex flex-wrap gap-1.5 lg:gap-2">
          <span className="rounded-full bg-slate-200/90 px-2 py-0.5 text-[11px] lg:text-xs font-medium text-slate-600 tabular-nums">
            {subformationCount} sub
          </span>
          <span className="rounded-full bg-slate-200/90 px-2 py-0.5 text-[11px] lg:text-xs font-medium text-slate-600 tabular-nums">
            {playCount} {playCount === 1 ? "play" : "plays"}
          </span>
        </div>
        {/* Mobile: icon row for secondary actions */}
        {canEdit && (onEdit || onDuplicate || onDelete) && (
          <div className="flex lg:hidden items-center justify-end gap-1 pt-1 border-t border-slate-200/80" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={onEdit} title="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDuplicate && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={onDuplicate} title="Duplicate">
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0 text-red-600 border-red-200" onClick={onDelete} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
