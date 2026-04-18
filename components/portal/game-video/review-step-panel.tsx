"use client"

import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import type { FilmDraftClip } from "@/components/portal/game-video/film-draft-types"
import { durationMsLabel, formatMsRange } from "@/lib/video/timecode"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ReviewStepPanel({
  drafts,
  selectedId,
  onSelect,
  onRemove,
  onMove,
  onBack,
  onContinue,
  disabled,
}: {
  drafts: FilmDraftClip[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onBack: () => void
  onContinue: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Preview each draft on the timeline. Remove mistakes and reorder plays if needed. Nothing is saved to the server yet.
      </p>
      {drafts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 px-3 py-8 text-center text-sm text-muted-foreground">
          No draft clips — go back to Capture.
        </p>
      ) : (
        <ul className="max-h-[min(320px,42vh)] space-y-2 overflow-y-auto pr-0.5">
          {drafts.map((d, idx) => {
            const active = selectedId === d.id
            return (
              <li key={d.id}>
                <div
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center",
                    active ? "border-primary bg-primary/10 ring-2 ring-primary/25" : "border-border bg-muted/15",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelect(d.id)}
                  >
                    <span className="text-sm font-bold text-foreground">{d.slotLabel}</span>
                    <span className="mt-0.5 block font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                      {formatMsRange(d.startMs, d.endMs)} · {durationMsLabel(d.startMs, d.endMs)}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={disabled || idx === 0}
                      aria-label="Move up"
                      onClick={() => onMove(d.id, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={disabled || idx >= drafts.length - 1}
                      aria-label="Move down"
                      onClick={() => onMove(d.id, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      aria-label={`Remove ${d.slotLabel}`}
                      disabled={disabled}
                      onClick={() => onRemove(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" className="h-11 gap-2 font-semibold" onClick={onBack} disabled={disabled}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to capture
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-11 gap-2 font-semibold sm:min-w-[200px]"
          disabled={disabled || drafts.length === 0}
          onClick={onContinue}
        >
          Name &amp; tag
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
