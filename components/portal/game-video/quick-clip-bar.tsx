"use client"

import {
  Flag,
  Loader2,
  Pause,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FilmInfoTip } from "@/components/portal/game-video/film-info-tip"
import { cn } from "@/lib/utils"

const SKIP = 5000

type MarkPhaseUi = "idle" | "await_end"

type Props = {
  enabled: boolean
  savedClipEditing?: boolean
  draftWorkflow?: boolean
  draftCount?: number
  bulkSaveCount?: number
  markPhase?: MarkPhaseUi
  onSaveDraftsSelected?: () => void
  onSaveDraftsAll?: () => void
  onDiscardDraftsSelected?: () => void
  onSaveDraftsAndContinue?: () => void
  previewActive: boolean
  clipValid: boolean
  previewClipAllowed?: boolean
  saving: boolean
  fineTuneExpanded: boolean
  onToggleFineTune: () => void
  onMarkStart: () => void
  onMarkEnd: () => void
  mainPlayPrimaryLabel: string
  mainPlayDisabled: boolean
  mainPlayDisabledReason?: string
  playbackScopeHint?: string
  mainTransportPlaying?: boolean
  onMainPlayToggle: () => void
  onPreview: () => void
  onStopPreview: () => void
  onSaveClip: () => void
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
  draftWorkflow = false,
  draftCount = 0,
  bulkSaveCount = 0,
  markPhase = "idle",
  onSaveDraftsSelected,
  onSaveDraftsAll,
  onDiscardDraftsSelected,
  onSaveDraftsAndContinue,
  previewActive,
  clipValid,
  previewClipAllowed,
  saving,
  fineTuneExpanded,
  onToggleFineTune,
  onMarkStart,
  onMarkEnd,
  mainPlayPrimaryLabel,
  mainPlayDisabled,
  mainPlayDisabledReason,
  playbackScopeHint,
  mainTransportPlaying = false,
  onMainPlayToggle,
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

  const showDraftActions = draftWorkflow && !savedClipEditing && draftCount > 0
  const canPreviewClip = previewClipAllowed ?? clipValid

  const previewDisabledReason =
    !previewActive && !canPreviewClip
      ? "Preview needs a valid in→out range. Select a draft, finish marking, or open a saved clip."
      : undefined

  const sectionMuted = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"

  const tipOverview = draftWorkflow ? (
    <>
      <p>
        <strong className="text-foreground">Mark start</strong> opens a clip;{" "}
        <strong className="text-foreground">Mark end</strong> logs it as a draft. Name clips in the list, then save to the roster
        when you want.
      </p>
      <p>
        <strong className="text-foreground">Play</strong> uses full film from the scrubber unless a clip range is ready — then it
        plays in→out once. <strong className="text-foreground">Preview</strong> loops that range for trimming.
      </p>
    </>
  ) : savedClipEditing ? (
    <>
      <p>
        <strong className="text-foreground">Play clip</strong> runs your range once; <strong className="text-foreground">Preview</strong>{" "}
        loops while you adjust marks in Fine tune.
      </p>
    </>
  ) : (
    <>
      <p>
        Mark <strong className="text-foreground">start</strong> then <strong className="text-foreground">end</strong>, then save.
        Play watches from the scrubber until you have a valid range — then it plays that segment once.
      </p>
    </>
  )

  return (
    <div className="rounded-lg border border-border/80 bg-card p-2.5 shadow-sm ring-1 ring-black/[0.03] md:p-3 dark:ring-white/[0.05]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground md:text-base">
            {savedClipEditing ? "Clip controls" : draftWorkflow ? "Mark & clip" : "Clip controls"}
          </h3>
          <FilmInfoTip label="How these controls work">
            <div className="space-y-2">
              {tipOverview}
              <p className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                Shortcuts (when not typing):{" "}
                <kbd className="rounded bg-muted px-1 font-mono">I</kbd> mark start ·{" "}
                <kbd className="rounded bg-muted px-1 font-mono">O</kbd> mark end ·{" "}
                <kbd className="rounded bg-muted px-1 font-mono">Ctrl</kbd>+
                <kbd className="rounded bg-muted px-1 font-mono">Enter</kbd>{" "}
                {draftWorkflow ? "save all drafts" : "save & next"} ·{" "}
                <kbd className="rounded bg-muted px-1 font-mono">Ctrl</kbd>+
                <kbd className="rounded bg-muted px-1 font-mono">Shift</kbd>+
                <kbd className="rounded bg-muted px-1 font-mono">S</kbd>{" "}
                {draftWorkflow ? "save selected" : "save only"}
              </p>
            </div>
          </FilmInfoTip>
        </div>
        {markPhase === "await_end" && (
          <span className="shrink-0 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-950 dark:text-amber-50">
            Clip open — Mark end to finish
          </span>
        )}
      </div>

      {/* Primary: marks + playback */}
      <div className="mt-3 flex flex-wrap items-stretch gap-2 md:gap-2.5">
        <div className="flex min-w-0 flex-[1_1_240px] flex-wrap gap-2">
          <Button
            type="button"
            size="default"
            variant="secondary"
            className={cn(
              "h-10 min-h-[40px] flex-1 gap-1.5 border border-sky-500/30 bg-sky-50 px-3 text-sm font-semibold text-sky-950 shadow-sm dark:bg-sky-950/30 dark:text-sky-50 sm:max-w-[200px]",
              markPhase === "await_end" && "ring-2 ring-sky-400/40 dark:ring-sky-500/35",
            )}
            onClick={onMarkStart}
            aria-label={draftWorkflow && !savedClipEditing ? "Mark start — begin a new clip" : "Mark start"}
          >
            <Flag className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
            Mark start
          </Button>
          <Button
            type="button"
            size="default"
            variant="secondary"
            className={cn(
              "h-10 min-h-[40px] flex-1 gap-1.5 border border-amber-500/35 bg-amber-50 px-3 text-sm font-semibold text-amber-950 shadow-sm dark:bg-amber-950/30 dark:text-amber-50 sm:max-w-[200px]",
              markPhase === "await_end" && "ring-2 ring-amber-400/40 dark:ring-amber-500/35",
            )}
            onClick={onMarkEnd}
            aria-label={
              draftWorkflow && !savedClipEditing ? "Mark end — finish clip and add to draft list" : "Mark end"
            }
          >
            <Flag className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            Mark end
          </Button>
        </div>

        <div className="hidden h-10 w-px shrink-0 bg-border/80 md:block" aria-hidden />

        <div className="flex min-w-0 flex-[1_1_280px] flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex min-w-0 flex-1 [&>button]:w-full",
                  mainPlayDisabled && "cursor-not-allowed",
                )}
                tabIndex={mainPlayDisabled ? 0 : undefined}
              >
                <Button
                  type="button"
                  size="default"
                  className={cn(
                    "h-10 min-h-[40px] w-full min-w-[120px] gap-2 border border-[#1d4ed8]/70 bg-[#2563EB] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#1d4ed8]",
                    mainTransportPlaying && "ring-2 ring-white/30 ring-offset-2 ring-offset-background",
                  )}
                  disabled={mainPlayDisabled}
                  onClick={onMainPlayToggle}
                  aria-pressed={mainTransportPlaying}
                >
                  {mainPlayPrimaryLabel === "Pause" ? (
                    <Pause className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <Play className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {mainPlayPrimaryLabel}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[min(18rem,calc(100vw-2rem))] leading-snug">
              {mainPlayDisabled ? (
                <span>{mainPlayDisabledReason ?? "Unavailable"}</span>
              ) : (
                <span>{playbackScopeHint ?? "Starts Braik playback from the scrubber or your marked range."}</span>
              )}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex min-w-0 flex-1 [&>button]:w-full",
                  !previewActive && !canPreviewClip && "cursor-not-allowed",
                )}
                tabIndex={!previewActive && !canPreviewClip ? 0 : undefined}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className={cn(
                    "h-10 min-h-[40px] w-full min-w-[140px] gap-2 px-3 text-sm font-semibold shadow-sm",
                    previewActive
                      ? "border-emerald-600/55 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-50"
                      : "border-primary/25",
                  )}
                  disabled={!previewActive && !canPreviewClip}
                  onClick={() => (previewActive ? onStopPreview() : onPreview())}
                  aria-pressed={previewActive}
                >
                  {previewActive ? (
                    <>
                      <Square className="h-4 w-4 shrink-0" aria-hidden />
                      Stop preview
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 shrink-0" aria-hidden />
                      Preview clip
                    </>
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[min(18rem,calc(100vw-2rem))] leading-snug">
              {previewActive ? (
                <span>Stop looping the in→out range.</span>
              ) : previewDisabledReason ? (
                <span>{previewDisabledReason}</span>
              ) : (
                <span>Loop the marked range for precise in/out adjustments.</span>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Secondary: utilities | saves */}
      <div className="mt-5 flex flex-col gap-4 border-t border-border/60 pt-5">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={fineTuneExpanded ? "secondary" : "outline"}
                size="default"
                aria-pressed={fineTuneExpanded}
                className="h-10 gap-2 px-4 text-sm font-semibold"
                onClick={onToggleFineTune}
              >
                <Wrench className="h-4 w-4" aria-hidden />
                {fineTuneExpanded ? "Hide fine tune" : "Fine tune"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs leading-snug">
              Frame-accurate trim fields and nudges below the scrubber (when expanded). Optional — use when you need exact edges.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="default"
                className="h-10 gap-2 px-4 text-sm font-semibold text-foreground"
                onClick={onResetMarks}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                {draftWorkflow && !savedClipEditing ? "Cancel mark" : "Reset marks"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs leading-snug">
              {draftWorkflow && !savedClipEditing
                ? "Discard the open mark-in without saving a draft."
                : "Clear in/out marks on the timeline (saved clip editing: resets trim to previous save when applicable)."}
            </TooltipContent>
          </Tooltip>

          <div className="mx-1 hidden h-8 w-px shrink-0 bg-border/70 sm:block" aria-hidden />

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 md:justify-end">
            {showDraftActions ? (
              <>
                <span className={cn(sectionMuted, "mr-1 hidden sm:inline")}>Save</span>
                <FilmInfoTip label="Save drafts to the roster" side="bottom">
                  <p>
                    <strong className="text-foreground">Save all</strong> uploads every draft in the queue.
                  </p>
                  <p>
                    <strong className="text-foreground">Save selected</strong> uses checked clips, or the clip you last clicked if
                    none are checked.
                  </p>
                  <p>
                    <strong className="text-foreground">Discard selected</strong> removes drafts from this session only — nothing
                    saved to the roster yet.
                  </p>
                </FilmInfoTip>
                <Button
                  type="button"
                  size="default"
                  className="h-10 gap-2 border border-emerald-700/35 bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                  onClick={() => onSaveDraftsAll?.()}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
                  Save all ({draftCount})
                </Button>
                <Button
                  type="button"
                  size="default"
                  className="h-10 gap-2 border border-[#2563EB]/40 bg-[#2563EB] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#1d4ed8]"
                  onClick={() => onSaveDraftsSelected?.()}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
                  Save selected{bulkSaveCount > 0 ? ` (${bulkSaveCount})` : ""}
                </Button>
                {onSaveDraftsAndContinue ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="default"
                    className="h-10 gap-2 px-4 text-sm font-semibold"
                    onClick={() => onSaveDraftsAndContinue?.()}
                    disabled={saving}
                  >
                    <PlusCircle className="h-5 w-5" aria-hidden />
                    Save all &amp; continue
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  size="default"
                  className="h-10 px-4 text-sm font-semibold shadow-sm"
                  onClick={() => onDiscardDraftsSelected?.()}
                  disabled={saving}
                >
                  Discard
                </Button>
              </>
            ) : savedClipEditing ? (
              <>
                {onSaveAndContinue ? (
                  <Button
                    type="button"
                    size="default"
                    className="h-10 flex-[1_1_auto] gap-2 border border-emerald-700/35 bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 md:min-w-[180px]"
                    onClick={onSaveAndContinue}
                    disabled={saving || !clipValid}
                  >
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <PlusCircle className="h-5 w-5" aria-hidden />
                    )}
                    Save &amp; next
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="default"
                  className="h-10 flex-[1_1_auto] gap-2 border border-[#2563EB]/40 bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
                  onClick={onSaveClip}
                  disabled={saving || !clipValid}
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
                  Save changes
                </Button>
              </>
            ) : draftWorkflow ? null : (
              <>
                {onSaveAndContinue ? (
                  <Button
                    type="button"
                    size="default"
                    className="h-10 flex-[1_1_auto] gap-2 border border-emerald-700/35 bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 md:min-w-[180px]"
                    onClick={onSaveAndContinue}
                    disabled={saving || !clipValid}
                  >
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <PlusCircle className="h-5 w-5" aria-hidden />
                    )}
                    Save &amp; next
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="default"
                  className={cn(
                    "h-10 gap-2 px-4 text-sm font-semibold text-white shadow-sm",
                    onSaveAndContinue
                      ? "flex-1 border border-[#2563EB]/40 bg-[#2563EB]/95 hover:bg-[#1d4ed8]"
                      : "flex-[2] border border-[#2563EB]/40 bg-[#2563EB] hover:bg-[#1d4ed8]",
                  )}
                  onClick={onSaveClip}
                  disabled={saving || !clipValid}
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
                  {onSaveAndContinue ? "Save only" : "Save clip"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Fine scrub */}
        <div className="border-t border-border/50 pt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <span className={sectionMuted}>Jump &amp; scrub</span>
            <FilmInfoTip label="Jump and coarse scrub">
              <p>
                Skip forward/back on the timeline. Jump snaps to current in/out marks. Replay clip starts preview loop when a range
                is valid.
              </p>
            </FilmInfoTip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="default" className="h-10 gap-2 px-3 text-[14px] font-medium" onClick={onSkipBack5}>
              <SkipBack className="h-4 w-4 shrink-0" aria-hidden />
              −{SKIP / 1000}s
            </Button>
            <Button type="button" variant="ghost" size="default" className="h-10 gap-2 px-3 text-[14px] font-medium" onClick={onSkipForward5}>
              <SkipForward className="h-4 w-4 shrink-0" aria-hidden />
              +{SKIP / 1000}s
            </Button>
            <Button type="button" variant="ghost" size="default" className="h-10 gap-2 px-3 text-[14px] font-medium" onClick={onReplayClip}>
              <Redo2 className="h-4 w-4 shrink-0" aria-hidden />
              Replay clip
            </Button>
            <Button type="button" variant="ghost" size="default" className="h-10 gap-2 px-3 text-[14px] font-medium" onClick={onJumpToMarkStart}>
              To in
            </Button>
            <Button type="button" variant="ghost" size="default" className="h-10 gap-2 px-3 text-[14px] font-medium" onClick={onJumpToMarkEnd}>
              To out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
