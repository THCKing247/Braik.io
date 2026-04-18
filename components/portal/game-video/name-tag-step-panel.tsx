"use client"

import type React from "react"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Loader2, Wand2 } from "lucide-react"
import { ClipPlayerAttachmentField } from "@/components/portal/game-video/clip-player-attachment-field"
import { FilmInfoTip } from "@/components/portal/game-video/film-info-tip"
import { COACH_QUICK_TAG_GROUPS } from "@/components/portal/game-video/coach-quick-tags"
import type { FilmDraftClip } from "@/components/portal/game-video/film-draft-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function NameTagStepPanel({
  drafts,
  selectedDraftId,
  onSelectDraft,
  clipTitleInputRef,
  clipTitle,
  setClipTitle,
  clipAttachedPlayerIds,
  onClipAttachedPlayerIdsChange,
  clipCategories,
  setClipCategories,
  clipDescription,
  setClipDescription,
  quickTagsSelected,
  toggleQuickTag,
  clipTagsFree,
  setClipTagsFree,
  taggingEnabled,
  aiVideoEnabled,
  aiWorking,
  onRunAiAssist,
  teamId,
  videoReady,
  canCreateClips,
  onBack,
  onContinue,
}: {
  drafts: FilmDraftClip[]
  selectedDraftId: string | null
  onSelectDraft: (id: string) => void
  clipTitleInputRef?: React.RefObject<HTMLInputElement | null>
  clipTitle: string
  setClipTitle: (v: string) => void
  clipAttachedPlayerIds: string[]
  onClipAttachedPlayerIdsChange: (ids: string[]) => void
  clipCategories: {
    playType: string
    situation: string
    personnel: string
    outcome: string
  }
  setClipCategories: React.Dispatch<
    React.SetStateAction<{
      playType: string
      situation: string
      personnel: string
      outcome: string
    }>
  >
  clipDescription: string
  setClipDescription: (v: string) => void
  quickTagsSelected: Set<string>
  toggleQuickTag: (tag: string) => void
  clipTagsFree: string
  setClipTagsFree: (v: string) => void
  taggingEnabled: boolean
  aiVideoEnabled: boolean
  aiWorking: boolean
  onRunAiAssist: () => void | Promise<void>
  teamId: string
  videoReady: boolean
  canCreateClips: boolean
  onBack: () => void
  onContinue: () => void
}) {
  const ix = drafts.findIndex((d) => d.id === selectedDraftId)
  const navigatorLabel =
    selectedDraftId && ix >= 0 ? `${ix + 1} / ${drafts.length}` : drafts.length ? "Select a clip" : ""

  const goPrev = () => {
    if (drafts.length === 0) return
    const cur = ix >= 0 ? ix : 0
    const prev = cur <= 0 ? drafts.length - 1 : cur - 1
    if (drafts[prev]) onSelectDraft(drafts[prev].id)
  }

  const goNext = () => {
    if (drafts.length === 0) return
    const cur = ix >= 0 ? ix : 0
    const next = cur >= drafts.length - 1 ? 0 : cur + 1
    if (drafts[next]) onSelectDraft(drafts[next].id)
  }

  const assistantDisabled = aiWorking || !aiVideoEnabled

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-950 dark:text-sky-50">
        Player attachments here apply only to the <strong className="font-semibold">selected draft clip</strong>. They are saved when you
        finalize clips — not to full-film roster links.
      </div>

      {drafts.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={goPrev} disabled={drafts.length < 2}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Prev clip
          </Button>
          <span className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">{navigatorLabel}</span>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={goNext} disabled={drafts.length < 2}>
            Next clip
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div>
        <div className="flex items-center gap-1">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-foreground">Clip name</h4>
          <FilmInfoTip label="Clip title">
            <p>Short label athletes recognize — finalized with the clip.</p>
          </FilmInfoTip>
        </div>
        <Input
          ref={clipTitleInputRef as React.RefObject<HTMLInputElement>}
          className="mt-1.5 min-h-9 text-sm"
          value={clipTitle}
          onChange={(e) => setClipTitle(e.target.value)}
          placeholder="Name this clip"
        />
      </div>

      {canCreateClips ? (
        <ClipPlayerAttachmentField
          teamId={teamId}
          selectedIds={clipAttachedPlayerIds}
          onChange={onClipAttachedPlayerIdsChange}
          disabled={!videoReady}
        />
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          label="Play / concept"
          hint="Inside zone, mesh, stunt…"
          value={clipCategories.playType}
          onChange={(v) => setClipCategories((o) => ({ ...o, playType: v }))}
        />
        <Field
          label="Situation"
          hint="Down & distance…"
          value={clipCategories.situation}
          onChange={(v) => setClipCategories((o) => ({ ...o, situation: v }))}
        />
        <Field
          label="Personnel"
          hint="11 personnel…"
          value={clipCategories.personnel}
          onChange={(v) => setClipCategories((o) => ({ ...o, personnel: v }))}
        />
        <Field
          label="Result"
          hint="Explosive, turnover…"
          value={clipCategories.outcome}
          onChange={(v) => setClipCategories((o) => ({ ...o, outcome: v }))}
        />
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quick tags</p>
        <div className="mt-2 space-y-4">
          {(Object.entries(COACH_QUICK_TAG_GROUPS) as Array<[string, (typeof COACH_QUICK_TAG_GROUPS)["unit"]]>).map(
            ([key, group]) => (
              <div key={key}>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">{group.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.tags.map((t) => {
                    const on = quickTagsSelected.has(t.value)
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => toggleQuickTag(t.value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                          on
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-muted/40 text-foreground hover:bg-muted",
                        )}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ),
          )}
        </div>
        {taggingEnabled ? (
          <div className="mt-3">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Extra tags (comma-separated)
            </label>
            <Input
              className="mt-2"
              value={clipTagsFree}
              onChange={(e) => setClipTagsFree(e.target.value)}
              placeholder="e.g. jet motion, 4th quarter"
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Tagging is off for your team.</p>
        )}
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Coaching notes</label>
        <textarea
          className="mt-2 min-h-[120px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          value={clipDescription}
          onChange={(e) => setClipDescription(e.target.value)}
          placeholder="What happened on this play?"
        />
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2">
        <div className="flex items-start gap-2">
          <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="flex-1 text-[11px] leading-snug text-muted-foreground">
            Assistant uses your notes and timing — runs when you click below.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2 h-10 w-full gap-2 border border-primary/30 bg-primary/10 text-sm font-semibold text-primary"
          disabled={assistantDisabled}
          onClick={() => void onRunAiAssist()}
        >
          {aiWorking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
          Run assistant
        </Button>
        {!aiVideoEnabled ? (
          <p className="mt-2 text-center text-xs text-amber-800 dark:text-amber-200">Assistant is off for this team.</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" className="h-11 gap-2 font-semibold" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to review
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-11 gap-2 font-semibold sm:min-w-[180px]"
          disabled={drafts.length === 0}
          onClick={onContinue}
        >
          Finalize
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
      <Input className="mt-1 min-h-9 text-sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint} />
    </div>
  )
}
