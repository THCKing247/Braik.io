"use client"

import {
  Flag,
  Loader2,
  Play,
  Redo2,
  RotateCcw,
  Save,
  SkipBack,
  SkipForward,
  Square,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SKIP = 5000

type Props = {
  enabled: boolean
  previewActive: boolean
  clipValid: boolean
  saving: boolean
  fineTuneExpanded: boolean
  onToggleFineTune: () => void
  onMarkStart: () => void
  onMarkEnd: () => void
  onPreview: () => void
  onStopPreview: () => void
  onSaveClip: () => void
  onResetMarks: () => void
  onSkipBack5: () => void
  onSkipForward5: () => void
  onReplayClip: () => void
  onJumpToMarkStart: () => void
  onJumpToMarkEnd: () => void
}

export function QuickClipBar({
  enabled,
  previewActive,
  clipValid,
  saving,
  fineTuneExpanded,
  onToggleFineTune,
  onMarkStart,
  onMarkEnd,
  onPreview,
  onStopPreview,
  onSaveClip,
  onResetMarks,
  onSkipBack5,
  onSkipForward5,
  onReplayClip,
  onJumpToMarkStart,
  onJumpToMarkEnd,
}: Props) {
  if (!enabled) return null

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Mark this play</h3>
          <p className="text-xs text-muted-foreground">
            Watch the film, tap where the play starts and ends, then save. No typing times first.
          </p>
        </div>
        <Button
          type="button"
          variant={fineTuneExpanded ? "secondary" : "outline"}
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={onToggleFineTune}
        >
          <Wrench className="h-4 w-4" aria-hidden />
          {fineTuneExpanded ? "Hide fine tune" : "Fine tune"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="min-h-[48px] flex-1 gap-2 sm:flex-none sm:min-w-[140px]"
          onClick={onMarkStart}
        >
          <Flag className="h-5 w-5 shrink-0 text-sky-500" aria-hidden />
          Mark start
        </Button>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="min-h-[48px] flex-1 gap-2 sm:flex-none sm:min-w-[140px]"
          onClick={onMarkEnd}
        >
          <Flag className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
          Mark end
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className={cn(
            "min-h-[44px] flex-1 gap-2 border-[#2563EB]/40 sm:flex-none",
            previewActive && "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
          )}
          onClick={() => (previewActive ? onStopPreview() : onPreview())}
          disabled={!clipValid && !previewActive}
        >
          {previewActive ? (
            <>
              <Square className="h-4 w-4" aria-hidden />
              Stop preview
            </>
          ) : (
            <>
              <Play className="h-4 w-4" aria-hidden />
              Preview clip
            </>
          )}
        </Button>
        <Button
          type="button"
          size="lg"
          className="min-h-[48px] flex-[2] gap-2 bg-[#0F172A] px-8 dark:bg-[#1E293B]"
          onClick={onSaveClip}
          disabled={saving || !clipValid}
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
          Save clip
        </Button>
        <Button type="button" variant="outline" className="min-h-[44px] gap-2" onClick={onResetMarks}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Reset marks
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onSkipBack5}>
          <SkipBack className="h-4 w-4" aria-hidden />
          Back {SKIP / 1000}s
        </Button>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onSkipForward5}>
          <SkipForward className="h-4 w-4" aria-hidden />
          Ahead {SKIP / 1000}s
        </Button>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onReplayClip}>
          <Redo2 className="h-4 w-4" aria-hidden />
          Replay clip
        </Button>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onJumpToMarkStart}>
          Jump to start
        </Button>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onJumpToMarkEnd}>
          Jump to end
        </Button>
      </div>
    </div>
  )
}
