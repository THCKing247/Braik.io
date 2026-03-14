"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2 } from "lucide-react"
import type { PlaybookRecord } from "@/types/playbook"

interface PlaybookCardProps {
  playbook: PlaybookRecord
  formationCount: number
  playCount: number
  onSelect: () => void
  onEdit?: () => void
  onDelete?: () => void
  canEdit: boolean
  className?: string
}

export function PlaybookCard({
  playbook,
  formationCount,
  playCount,
  onSelect,
  onEdit,
  onDelete,
  canEdit,
  className = "",
}: PlaybookCardProps) {
  return (
    <Card
      className={`cursor-pointer overflow-hidden rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/90 to-white hover:border-slate-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 min-w-[220px] ${className}`}
      onClick={onSelect}
    >
      <CardContent className="p-5 flex flex-col min-h-[200px]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="rounded-xl p-2.5 bg-slate-200/80">
            <span className="text-2xl font-bold text-slate-600" aria-hidden>
              📋
            </span>
          </div>
          {canEdit && (onEdit || onDelete) && (
            <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={onEdit}
                  title="Edit playbook"
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-600" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-destructive/20 hover:text-destructive"
                  onClick={onDelete}
                  title="Delete playbook"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
        <h3 className="font-semibold text-base text-slate-800 mb-1.5">{playbook.name}</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-600 tabular-nums">
            {formationCount} {formationCount === 1 ? "formation" : "formations"}
          </span>
          <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-600 tabular-nums">
            {playCount} {playCount === 1 ? "play" : "plays"}
          </span>
        </div>
        <div className="mt-auto pt-4 border-t border-slate-200/80">
          <Button variant="outline" size="sm" className="w-full rounded-lg" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
            Open playbook
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
