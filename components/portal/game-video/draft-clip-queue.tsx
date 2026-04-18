"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type { FilmDraftClip } from "@/components/portal/game-video/film-draft-types"
import { durationMsLabel, formatMsAsTimecode, formatMsRange } from "@/lib/video/timecode"
import { cn } from "@/lib/utils"

export function DraftClipQueue({
  drafts,
  selectedId,
  bulkSelectedIds,
  markPhase,
  pendingStartMs,
  onSelect,
  onToggleBulk,
  onTitleChange,
  onRemove,
  onDiscardOpenMark,
  disabled,
}: {
  drafts: FilmDraftClip[]
  selectedId: string | null
  bulkSelectedIds: Set<string>
  markPhase: "idle" | "await_end"
  pendingStartMs: number | null
  onSelect: (id: string) => void
  onToggleBulk: (id: string, checked: boolean) => void
  onTitleChange: (id: string, title: string) => void
  onRemove: (id: string) => void
  onDiscardOpenMark: () => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-base font-bold tracking-tight text-foreground">Marked clips (draft)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mark start/end while the film plays — clips stack here. Name them, then save selected or all.
          </p>
        </div>
        {markPhase === "await_end" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
              Recording range…
            </span>
            <span className="text-xs text-amber-900/90 dark:text-amber-50">
              Started at {pendingStartMs != null ? formatMsAsTimecode(pendingStartMs) : "—"} — press{" "}
              <strong>Mark end</strong> at the stop point.
            </span>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onDiscardOpenMark} disabled={disabled}>
              Cancel mark
            </Button>
          </div>
        )}
      </div>

      {drafts.length === 0 && markPhase === "idle" ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No draft clips yet. Press <strong className="text-foreground">Mark start</strong>, then{" "}
          <strong className="text-foreground">Mark end</strong> while watching — repeat as many times as you need.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {drafts.map((d) => {
            const selected = selectedId === d.id
            const bulkOn = bulkSelectedIds.has(d.id)
            const dur = durationMsLabel(d.startMs, d.endMs)
            return (
              <li key={d.id}>
                <div
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:gap-3",
                    selected ? "border-primary bg-primary/10 ring-2 ring-primary/25" : "border-border bg-muted/20 hover:bg-muted/35",
                  )}
                >
                  <div className="flex shrink-0 items-center gap-2">
                    <Checkbox
                      checked={bulkOn}
                      onCheckedChange={(c) => onToggleBulk(d.id, c === true)}
                      aria-label={`Select ${d.slotLabel} for bulk save`}
                      disabled={disabled}
                    />
                    <button
                      type="button"
                      className={cn(
                        "min-w-0 rounded-md px-2 py-1 text-left text-sm font-bold",
                        selected ? "text-primary" : "text-foreground",
                      )}
                      onClick={() => onSelect(d.id)}
                    >
                      {d.slotLabel}
                      <span className="mt-0.5 block font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                        {formatMsRange(d.startMs, d.endMs)} · {dur}
                      </span>
                    </button>
                  </div>
                  <Input
                    className="min-h-10 flex-1 text-sm font-medium"
                    placeholder={`Title (${d.slotLabel})`}
                    value={d.titleDraft}
                    onChange={(e) => onTitleChange(d.id, e.target.value)}
                    onClick={() => onSelect(d.id)}
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${d.slotLabel}`}
                    onClick={() => onRemove(d.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
