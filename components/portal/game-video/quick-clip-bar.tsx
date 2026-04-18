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
  /** Sidebar / narrow rail: stack workflow groups vertically with 2-column button rows */
  layoutDensity?: "default" | "sidebar"
  savedClipEditing?: boolean
  draftWorkflow?: boolean
  /** Hide Save all / Save selected / Discard for drafts — used when persistence happens only on a Finalize step. */
  hideDraftPersistActions?: boolean
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
  layoutDensity = "default",
  savedClipEditing = false,
  draftWorkflow = false,
  hideDraftPersistActions = false,
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

  const sidebar = layoutDensity === "sidebar"

  const showDraftActions =
    draftWorkflow && !savedClipEditing && draftCount > 0 && !hideDraftPersistActions
  const canPreviewClip = previewClipAllowed ?? clipValid

  const previewDisabledReason =
    !previewActive && !canPreviewClip
      ? "Preview needs a valid in→out range. Select a draft, finish marking, or open a saved clip."
      : undefined

  const sectionMuted = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"

  const tipOverview = draftWorkflow ? (
    hideDraftPersistActions ? (
      <>
        <p>
          <strong className="text-foreground">Mark start</strong> opens a clip;{" "}
          <strong className="text-foreground">Mark end</strong> logs it locally — nothing uploads until you finish the workflow on{" "}
          <strong className="text-foreground">Finalize</strong>.
        </p>
        <p>
          <strong className="text-foreground">Play</strong> uses full film from the scrubber unless a clip range is ready — then it
          plays in→out once. <strong className="text-foreground">Preview</strong> loops that range for trimming.
        </p>
      </>
    ) : (
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
    )
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

  const jumpGridClass = sidebar
    ? "grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3"
    : "flex flex-wrap gap-1.5"

  const surfaceCard = cn(
    "rounded-lg border shadow-sm",
    sidebar
      ? "border-white/15 bg-[#0f172a] p-1.5 ring-1 ring-white/[0.06]"
      : "border-border/80 bg-card p-2 ring-1 ring-black/[0.03] dark:ring-white/[0.05]",
  )

  const primaryTransportWrap = sidebar ? "flex flex-col gap-2" : "grid gap-2 sm:grid-cols-2"

  const markBtn =
    "h-10 min-h-[40px] min-w-0 gap-1.5 px-2 text-sm font-semibold shadow-sm sm:px-3 disabled:opacity-60 disabled:saturate-75"
  const markStartClasses = cn(
    markBtn,
    "border border-sky-700 bg-sky-600 text-white hover:bg-sky-500 hover:text-white dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500",
    markPhase === "await_end" && "ring-2 ring-sky-300/50 dark:ring-sky-400/45",
  )
  const markEndClasses = cn(
    markBtn,
    "border border-amber-700 bg-amber-600 text-white hover:bg-amber-500 hover:text-white dark:bg-amber-600 dark:text-white dark:hover:bg-amber-500",
    markPhase === "await_end" && "ring-2 ring-amber-300/45 dark:ring-amber-400/40",
  )
  const playPrimaryClasses = cn(
    "h-10 min-h-[40px] w-full min-w-0 gap-2 border border-blue-800 bg-blue-600 px-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:px-3 disabled:bg-slate-700 disabled:text-slate-300 disabled:opacity-70 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500",
    mainTransportPlaying && "ring-2 ring-white/40 ring-offset-2 ring-offset-background",
  )
  const previewClasses = cn(
    "h-10 min-h-[40px] w-full min-w-0 gap-2 px-2 text-sm font-semibold shadow-sm sm:px-3 disabled:opacity-60 disabled:saturate-75",
    previewActive
      ? "border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-600"
      : sidebar
        ? "border border-slate-500/80 bg-slate-800 text-white hover:bg-slate-700"
        : "border border-border bg-background text-foreground hover:bg-muted",
  )

  const outlineToolBtnBase = "h-9 min-h-[36px] w-full min-w-0 gap-1.5 px-2 text-[13px] font-semibold disabled:opacity-55 sm:px-3"

  return (
    <div className={surfaceCard}>
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b pb-2",
          sidebar ? "border-white/10" : "border-border/70",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3
            className={cn(
              "font-semibold tracking-tight text-foreground",
              sidebar ? "text-[13px]" : "text-sm",
            )}
          >
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
                {draftWorkflow && hideDraftPersistActions
                  ? "finalize (Finalize step)"
                  : draftWorkflow
                    ? "save all drafts"
                    : "save & next"}{" "}
                ·{" "}
                <kbd className="rounded bg-muted px-1 font-mono">Ctrl</kbd>+
                <kbd className="rounded bg-muted px-1 font-mono">Shift</kbd>+
                <kbd className="rounded bg-muted px-1 font-mono">S</kbd>{" "}
                {draftWorkflow && hideDraftPersistActions
                  ? "(not used in finalize-only flow)"
                  : draftWorkflow
                    ? "save selected"
                    : "save only"}
              </p>
            </div>
          </FilmInfoTip>
        </div>
        {markPhase === "await_end" && (
          <span className="max-w-full shrink-0 rounded-full border border-amber-600/45 bg-amber-600/15 px-2 py-0.5 text-[10px] font-semibold leading-snug text-amber-50 sm:px-2.5 sm:text-[11px]">
            Clip open — mark end
          </span>
        )}
      </div>

      {/* Primary: marks + playback — sidebar mode stacks rows; default uses 2-col split */}
      <div className={cn("mt-2", primaryTransportWrap)}>
        {sidebar ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Mark range</p>
        ) : null}
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <Button
            type="button"
            size="default"
            variant="secondary"
            className={cn(markStartClasses, "w-full")}
            onClick={onMarkStart}
            aria-label={draftWorkflow && !savedClipEditing ? "Mark start — begin a new clip" : "Mark start"}
          >
            <Flag className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
            Mark start
          </Button>
          <Button
            type="button"
            size="default"
            variant="secondary"
            className={cn(markEndClasses, "w-full")}
            onClick={onMarkEnd}
            aria-label={
              draftWorkflow && !savedClipEditing ? "Mark end — finish clip and add to draft list" : "Mark end"
            }
          >
            <Flag className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
            Mark end
          </Button>
        </div>

        {sidebar ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Playback</p>
        ) : null}

        <div className="grid min-w-0 grid-cols-2 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex min-w-0 [&>button]:w-full",
                  mainPlayDisabled && "cursor-not-allowed",
                )}
                tabIndex={mainPlayDisabled ? 0 : undefined}
              >
                <Button
                  type="button"
                  size="default"
                  className={playPrimaryClasses}
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
                  "inline-flex min-w-0 [&>button]:w-full",
                  !previewActive && !canPreviewClip && "cursor-not-allowed",
                )}
                tabIndex={!previewActive && !canPreviewClip ? 0 : undefined}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className={previewClasses}
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

      {/* Secondary: trim tools + saves */}
      <div
        className={cn(
          "mt-3 flex flex-col gap-2 border-t pt-3",
          sidebar ? "border-white/10" : "border-border/60",
        )}
      >
        {sidebar ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Trim &amp; reset</p>
        ) : null}
        <div className={cn(sidebar ? "grid min-w-0 grid-cols-2 gap-2" : "flex flex-wrap items-center gap-2")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={fineTuneExpanded ? "secondary" : "outline"}
                size="default"
                aria-pressed={fineTuneExpanded}
                className={cn(
                  outlineToolBtnBase,
                  sidebar &&
                    (fineTuneExpanded
                      ? "border border-slate-500 bg-slate-800 text-white hover:bg-slate-700"
                      : "border border-slate-500/90 bg-transparent text-white hover:bg-white/10"),
                  !sidebar && "h-9 w-auto shrink-0 px-3",
                )}
                onClick={onToggleFineTune}
              >
                <Wrench className="h-4 w-4 shrink-0" aria-hidden />
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
                className={cn(
                  outlineToolBtnBase,
                  sidebar
                    ? "border border-slate-500/90 bg-transparent text-white hover:bg-white/10"
                    : "border-border text-foreground hover:bg-muted/80",
                  !sidebar && "h-9 w-auto shrink-0 px-3",
                )}
                onClick={onResetMarks}
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
                {draftWorkflow && !savedClipEditing ? "Cancel mark" : "Reset marks"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs leading-snug">
              {draftWorkflow && !savedClipEditing
                ? "Discard the open mark-in without saving a draft."
                : "Clear in/out marks on the timeline (saved clip editing: resets trim to previous save when applicable)."}
            </TooltipContent>
          </Tooltip>
        </div>

        {showDraftActions || savedClipEditing || (!draftWorkflow && !savedClipEditing) ? (
          sidebar ? (
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {showDraftActions ? "Save drafts" : "Save"}
            </p>
          ) : null
        ) : null}

        <div
          className={cn(
            "grid min-w-0 gap-2",
            sidebar ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5",
          )}
        >
            {showDraftActions ? (
              <>
                {!sidebar ? (
                <div className="col-span-full flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={sectionMuted}>Save drafts</span>
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
                </div>
                ) : null}
                <Button
                  type="button"
                  size="default"
                  className="h-9 w-full min-w-0 gap-1.5 border border-emerald-800 bg-emerald-600 px-2 text-[13px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-65 sm:px-3"
                  onClick={() => onSaveDraftsAll?.()}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Save className="h-4 w-4 shrink-0" aria-hidden />}
                  <span className="truncate">Save all ({draftCount})</span>
                </Button>
                <Button
                  type="button"
                  size="default"
                  className="h-9 w-full min-w-0 gap-1.5 border border-blue-800 bg-blue-600 px-2 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-65 sm:px-3"
                  onClick={() => onSaveDraftsSelected?.()}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Save className="h-4 w-4 shrink-0" aria-hidden />}
                  <span className="truncate">Save selected{bulkSaveCount > 0 ? ` (${bulkSaveCount})` : ""}</span>
                </Button>
                {onSaveDraftsAndContinue ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="default"
                    className="h-9 w-full min-w-0 gap-1.5 border border-slate-500/80 bg-slate-800 px-2 text-[13px] font-semibold text-white hover:bg-slate-700 disabled:opacity-65 sm:px-3"
                    onClick={() => onSaveDraftsAndContinue?.()}
                    disabled={saving}
                  >
                    <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">Save all &amp; continue</span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  size="default"
                  className="h-9 w-full px-2 text-[13px] font-semibold shadow-sm hover:bg-red-700 sm:px-3"
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
                    className="col-span-full h-9 w-full min-w-0 gap-1.5 border border-emerald-800 bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-65 sm:col-span-1"
                    onClick={onSaveAndContinue}
                    disabled={saving || !clipValid}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    Save &amp; next
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="default"
                  className="col-span-full h-9 w-full min-w-0 gap-1.5 border border-blue-800 bg-blue-600 px-3 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-65 sm:col-span-1"
                  onClick={onSaveClip}
                  disabled={saving || !clipValid}
                >
                  {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Save className="h-4 w-4 shrink-0" aria-hidden />}
                  Save changes
                </Button>
              </>
            ) : draftWorkflow ? null : (
              <>
                {onSaveAndContinue ? (
                  <Button
                    type="button"
                    size="default"
                    className="col-span-full h-9 w-full gap-1.5 border border-emerald-800 bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-65 sm:col-span-1"
                    onClick={onSaveAndContinue}
                    disabled={saving || !clipValid}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : (
                      <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    Save &amp; next
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="default"
                  className={cn(
                    "col-span-full h-9 gap-1.5 border border-blue-800 px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-65 sm:col-span-1",
                    onSaveAndContinue ? "w-full bg-blue-700" : "w-full bg-blue-600",
                  )}
                  onClick={onSaveClip}
                  disabled={saving || !clipValid}
                >
                  {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Save className="h-4 w-4 shrink-0" aria-hidden />}
                  {onSaveAndContinue ? "Save only" : "Save clip"}
                </Button>
              </>
            )}
        </div>

        {/* Jump & coarse scrub */}
        <div className={cn("border-t pt-2", sidebar ? "border-white/10" : "border-border/50")}>
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className={sectionMuted}>Jump &amp; scrub</span>
            <FilmInfoTip label="Jump and coarse scrub">
              <p>
                Skip forward/back on the timeline. Jump snaps to current in/out marks. Replay clip starts preview loop when a range
                is valid.
              </p>
            </FilmInfoTip>
          </div>
          <div className={jumpGridClass}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 gap-1.5 px-2.5 text-[13px] font-semibold",
                sidebar ? "text-slate-100 hover:bg-white/10 hover:text-white" : "text-foreground hover:bg-muted",
              )}
              onClick={onSkipBack5}
            >
              <SkipBack className="h-4 w-4 shrink-0" aria-hidden />
              −{SKIP / 1000}s
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 gap-1.5 px-2.5 text-[13px] font-semibold",
                sidebar ? "text-slate-100 hover:bg-white/10 hover:text-white" : "text-foreground hover:bg-muted",
              )}
              onClick={onSkipForward5}
            >
              <SkipForward className="h-4 w-4 shrink-0" aria-hidden />
              +{SKIP / 1000}s
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 gap-1.5 px-2.5 text-[13px] font-semibold",
                sidebar ? "text-slate-100 hover:bg-white/10 hover:text-white" : "text-foreground hover:bg-muted",
              )}
              onClick={onReplayClip}
            >
              <Redo2 className="h-4 w-4 shrink-0" aria-hidden />
              Replay
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 gap-1 px-2.5 text-[13px] font-semibold",
                sidebar ? "text-slate-100 hover:bg-white/10 hover:text-white" : "text-foreground hover:bg-muted",
              )}
              onClick={onJumpToMarkStart}
            >
              To in
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 gap-1 px-2.5 text-[13px] font-semibold",
                sidebar ? "text-slate-100 hover:bg-white/10 hover:text-white" : "text-foreground hover:bg-muted",
              )}
              onClick={onJumpToMarkEnd}
            >
              To out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
