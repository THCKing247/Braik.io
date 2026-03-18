"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Presentation, MoreVertical } from "lucide-react"
import type { PlaybookRecord } from "@/types/playbook"
import { PlaybookBottomSheet } from "@/components/portal/playbook-bottom-sheet"

interface PlaybookCardProps {
  playbook: PlaybookRecord
  formationCount: number
  playCount: number
  onSelect: () => void
  onPresenter?: () => void
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
  onPresenter,
  onEdit,
  onDelete,
  canEdit,
  className = "",
}: PlaybookCardProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <>
      <Card
        className={`cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/90 to-white shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200 min-w-0 max-w-full ${className}`}
        onClick={onSelect}
      >
        {/* Mobile / tablet (< lg): compact vertical card */}
        <CardContent className="p-4 lg:hidden flex flex-col gap-3 min-w-0 max-w-full overflow-hidden">
          <div className="flex gap-3 min-w-0">
            <div className="rounded-xl p-2.5 bg-slate-200/80 shrink-0 h-12 w-12 flex items-center justify-center">
              <span className="text-xl" aria-hidden>
                📋
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base text-slate-900 leading-tight line-clamp-2">{playbook.name}</h3>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="rounded-full bg-slate-200/90 px-2 py-0.5 text-[11px] font-medium text-slate-600 tabular-nums">
                  {formationCount} form.
                </span>
                <span className="rounded-full bg-slate-200/90 px-2 py-0.5 text-[11px] font-medium text-slate-600 tabular-nums">
                  {playCount} plays
                </span>
              </div>
            </div>
            {canEdit && (onEdit || onDelete) && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl border-slate-200"
                onClick={(e) => {
                  stop(e)
                  setMoreOpen(true)
                }}
                title="More actions"
              >
                <MoreVertical className="h-4 w-4 text-slate-600" />
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="default"
              size="sm"
              className="rounded-xl h-10 font-medium"
              onClick={(e) => {
                stop(e)
                onSelect()
              }}
            >
              Open
            </Button>
            {onPresenter ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-10 font-medium gap-1"
                onClick={(e) => {
                  stop(e)
                  onPresenter()
                }}
              >
                <Presentation className="h-4 w-4 shrink-0" />
                Present
              </Button>
            ) : (
              <div />
            )}
          </div>
        </CardContent>

        {/* Desktop (lg+): row-style card */}
        <CardContent className="hidden lg:flex p-5 flex-col min-h-[180px]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="rounded-xl p-2.5 bg-slate-200/80">
              <span className="text-2xl font-bold text-slate-600" aria-hidden>
                📋
              </span>
            </div>
            <div className="flex gap-1 shrink-0" onClick={stop}>
              {onPresenter && (
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onPresenter} title="Presenter">
                  <Presentation className="h-4 w-4 text-slate-600" />
                </Button>
              )}
              {canEdit && onEdit && (
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onEdit} title="Edit">
                  <Pencil className="h-4 w-4 text-slate-600" />
                </Button>
              )}
              {canEdit && onDelete && (
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-destructive/15 hover:text-destructive" onClick={onDelete} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <h3 className="font-semibold text-lg text-slate-800 mb-2 line-clamp-2">{playbook.name}</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-600 tabular-nums">
              {formationCount} {formationCount === 1 ? "formation" : "formations"}
            </span>
            <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-600 tabular-nums">
              {playCount} {playCount === 1 ? "play" : "plays"}
            </span>
          </div>
          <div className="mt-auto pt-4 border-t border-slate-200/80 flex gap-2">
            {onPresenter && (
              <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={(e) => { stop(e); onPresenter(); }}>
                <Presentation className="h-4 w-4 mr-1" />
                Presenter
              </Button>
            )}
            <Button variant="default" size="sm" className="flex-1 rounded-xl" onClick={(e) => { stop(e); onSelect(); }}>
              Open playbook
            </Button>
          </div>
        </CardContent>
      </Card>

      <PlaybookBottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="Playbook actions">
        {onEdit && (
          <Button
            variant="outline"
            className="w-full justify-start h-12 rounded-xl gap-2"
            onClick={() => {
              setMoreOpen(false)
              onEdit()
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit playbook
          </Button>
        )}
        {onDelete && (
          <Button
            variant="outline"
            className="w-full justify-start h-12 rounded-xl gap-2 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => {
              setMoreOpen(false)
              onDelete()
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete playbook
          </Button>
        )}
      </PlaybookBottomSheet>
    </>
  )
}
