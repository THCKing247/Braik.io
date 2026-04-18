"use client"

import { BookmarkPlus, Play, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ClipRow } from "@/components/portal/game-video/game-video-types"
import { durationMsLabel, formatMsRange } from "@/lib/video/timecode"
import { cn } from "@/lib/utils"

type Props = {
  clips: ClipRow[]
  highlightClipId: string | null
  taggingEnabled: boolean
  reelClipIds: Set<string>
  onToggleReel: (clipId: string) => void
  onLoadInEditor: (c: ClipRow) => void
  onPreview: (c: ClipRow) => void
  onDelete: (clipId: string) => void
}

export function ClipReelPanel({
  clips,
  highlightClipId,
  taggingEnabled,
  reelClipIds,
  onToggleReel,
  onLoadInEditor,
  onPreview,
  onDelete,
}: Props) {
  const reelCount = reelClipIds.size

  if (clips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">No clips on this film yet</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Mark a start and end on the scrubber, then tap <strong>Save clip</strong>. Your teaching moments will land
          here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <strong className="font-semibold text-foreground">Teaching reel</strong> — clips you star are grouped for review
        sessions or sharing later ({reelCount} on this film). Stored on this device only for now.
      </div>
      <ul className="grid gap-3">
        {clips.map((c) => {
          const onReel = reelClipIds.has(c.id)
          return (
            <li
              key={c.id}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                highlightClipId === c.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-background hover:bg-muted/30",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{c.title || "Untitled clip"}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{formatMsRange(c.start_ms, c.end_ms)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Length {durationMsLabel(c.start_ms, c.end_ms)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={onReel ? "default" : "outline"}
                  className="shrink-0 gap-1.5"
                  onClick={() => onToggleReel(c.id)}
                  title={onReel ? "Remove from teaching reel" : "Add to teaching reel"}
                >
                  <BookmarkPlus className="h-4 w-4" aria-hidden />
                  {onReel ? "On reel" : "Add to reel"}
                </Button>
              </div>
              {c.description && (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
              )}
              {taggingEnabled && Array.isArray(c.tags) && c.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.slice(0, 8).map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {c.metadata?.categories && Object.keys(c.metadata.categories).length > 0 && (
                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                  {Object.entries(c.metadata.categories).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-medium capitalize text-foreground/80">{k}</dt>
                      <dd className="truncate">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                <Button type="button" variant="secondary" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => onLoadInEditor(c)}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Edit marks
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => onPreview(c)}>
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  Play clip
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => onDelete(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
