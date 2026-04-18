"use client"

import {
  Flag,
  Loader2,
  Play,
  PlusCircle,
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
  /** Editing a saved clip — preview plays segment once; copy reflects clip context */
  savedClipEditing?: boolean
  previewActive: boolean
  clipValid: boolean
  saving: boolean
  fineTuneExpanded: boolean
  onToggleFineTune: () => void
  onMarkStart: () => void
  onMarkEnd: () => void
  onPreview: () => void
  onStopPreview: () => void
  /** Save without advancing range (keep in/out for minor tweaks or manual next marks) */
  onSaveClip: () => void
  /** Save and prepare the next clip range from the end of this one */
  onSaveAndContinue?: () => void
  onResetMarks: () => void
  onSkipBack5: () => void
  onSkipForward5: () => void
  onReplayClip: () => void
  onJumpToMarkStart: () => void
  onJumpToMarkEnd: () => void
}

export function QuickClipBar({
  enabled,
  savedClipEditing = false,
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
  onSaveAndContinue,
  onResetMarks,
  onSkipBack5,
  onSkipForward5,
  onReplayClip,
  onJumpToMarkStart,
  onJumpToMarkEnd,
}: Props) {
  if (!enabled) return null

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-md ring-1 ring-black/[0.06] dark:bg-card md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-foreground">
            {savedClipEditing ? "Adjust this clip" : "Mark this play"}
          </h3>
          <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-400">
            {savedClipEditing ? (
              <>
                Range below matches this saved clip. <strong className="text-foreground">Preview clip</strong> plays in→out once
                and stops. Adjust marks if needed, then save — use <strong className="text-foreground">Save &amp; next</strong> to
                chain another clip without leaving the film.
              </>
            ) : (
              <>
                Mark <strong className="font-semibold text-foreground">start</strong> then{" "}
                <strong className="font-semibold text-foreground">end</strong>. Use{" "}
                <strong className="font-semibold text-foreground">Save &amp; next clip</strong> to save and immediately set up
                the next play on the same film.
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant={fineTuneExpanded ? "secondary" : "outline"}
          size="default"
          className="h-11 min-h-[44px] shrink-0 gap-2 px-4 font-semibold"
          onClick={onToggleFineTune}
        >
          <Wrench className="h-4 w-4" aria-hidden />
          {fineTuneExpanded ? "Hide fine tune" : "Fine tune"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="min-h-[52px] flex-1 gap-2 border-2 border-sky-500/30 bg-sky-50 font-bold text-sky-950 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-950 sm:flex-none sm:min-w-[155px]"
          onClick={onMarkStart}
        >
          <Flag className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          Mark start
        </Button>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="min-h-[52px] flex-1 gap-2 border-2 border-amber-500/35 bg-amber-50 font-bold text-amber-950 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-950 sm:flex-none sm:min-w-[155px]"
          onClick={onMarkEnd}
        >
          <Flag className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          Mark end
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className={cn(
            "min-h-[52px] flex-1 gap-2 border-2 border-[#2563EB]/50 font-semibold sm:flex-none sm:min-w-[160px]",
            previewActive && "border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-50",
          )}
          onClick={() => (previewActive ? onStopPreview() : onPreview())}
          disabled={!clipValid && !previewActive}
        >
          {previewActive ? (
            <>
              <Square className="h-5 w-5" aria-hidden />
              Stop preview
            </>
          ) : (
            <>
              <Play className="h-5 w-5" aria-hidden />
              {savedClipEditing ? "Play clip segment" : "Preview clip"}
            </>
          )}
        </Button>
        {onSaveAndContinue ? (
          <Button
            type="button"
            size="lg"
            className="min-h-[52px] flex-[2] gap-2 border-2 border-emerald-600/50 bg-emerald-600 px-6 text-base font-bold text-white shadow-lg hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            onClick={onSaveAndContinue}
            disabled={saving || !clipValid}
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <PlusCircle className="h-5 w-5" aria-hidden />
            )}
            Save &amp; next clip
          </Button>
        ) : null}
        <Button
          type="button"
          size="lg"
          className={cn(
            "min-h-[52px] gap-2 border-2 px-6 text-base font-bold shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2",
            onSaveAndContinue
              ? "flex-1 border-[#2563EB]/40 bg-[#2563EB]/90 text-white hover:bg-[#1d4ed8] focus-visible:ring-[#2563EB] dark:bg-[#3b82f6] dark:hover:bg-[#2563eb]"
              : "flex-[2] border-[#2563EB]/40 bg-[#2563EB] text-white hover:bg-[#1d4ed8] focus-visible:ring-[#2563EB] dark:bg-[#3b82f6] dark:hover:bg-[#2563eb]",
          )}
          onClick={onSaveClip}
          disabled={saving || !clipValid}
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
          {savedClipEditing ? "Save changes" : onSaveAndContinue ? "Save clip only" : "Save clip"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-[52px] min-h-[52px] gap-2 border-2 border-slate-300 font-semibold text-foreground hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          onClick={onResetMarks}
        >
          <RotateCcw className="h-5 w-5" aria-hidden />
          Reset marks
        </Button>
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        Shortcuts when not typing: <kbd className="rounded border border-border bg-muted px-1 font-mono">I</kbd> mark start ·{" "}
        <kbd className="rounded border border-border bg-muted px-1 font-mono">O</kbd> mark end ·{" "}
        <kbd className="rounded border border-border bg-muted px-1 font-mono">Ctrl</kbd>+
        <kbd className="rounded border border-border bg-muted px-1 font-mono">Enter</kbd> save &amp; next ·{" "}
        <kbd className="rounded border border-border bg-muted px-1 font-mono">Ctrl</kbd>+
        <kbd className="rounded border border-border bg-muted px-1 font-mono">Shift</kbd>+
        <kbd className="rounded border border-border bg-muted px-1 font-mono">S</kbd> save only
      </p>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="h-11 min-h-[44px] gap-2 font-semibold text-foreground hover:bg-muted"
          onClick={onSkipBack5}
        >
          <SkipBack className="h-4 w-4 shrink-0" aria-hidden />
          Back {SKIP / 1000}s
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="h-11 min-h-[44px] gap-2 font-semibold text-foreground hover:bg-muted"
          onClick={onSkipForward5}
        >
          <SkipForward className="h-4 w-4 shrink-0" aria-hidden />
          Ahead {SKIP / 1000}s
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="h-11 min-h-[44px] gap-2 font-semibold text-foreground hover:bg-muted"
          onClick={onReplayClip}
        >
          <Redo2 className="h-4 w-4 shrink-0" aria-hidden />
          Replay clip
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="h-11 min-h-[44px] gap-2 font-semibold text-foreground hover:bg-muted"
          onClick={onJumpToMarkStart}
        >
          Jump to start
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="h-11 min-h-[44px] gap-2 font-semibold text-foreground hover:bg-muted"
          onClick={onJumpToMarkEnd}
        >
          Jump to end
        </Button>
      </div>
    </div>
  )
}
