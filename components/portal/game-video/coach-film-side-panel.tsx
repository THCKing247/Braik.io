"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ClipboardList,
  Loader2,
  PanelRightClose,
  Sparkles,
  Tags,
  PenLine,
  Video,
  Wand2,
} from "lucide-react"
import { ClipReelPanel } from "@/components/portal/game-video/clip-reel-panel"
import type { ClipRow } from "@/components/portal/game-video/game-video-types"
import { ClipPlayerAttachmentField } from "@/components/portal/game-video/clip-player-attachment-field"
import { FilmInfoTip } from "@/components/portal/game-video/film-info-tip"
import { COACH_QUICK_TAG_GROUPS } from "@/components/portal/game-video/coach-quick-tags"
import { cn } from "@/lib/utils"

export type CoachFilmTabId = "clip" | "tags" | "notes" | "assistant" | "reel"

type Props = {
  clipTitleInputRef?: React.RefObject<HTMLInputElement>
  clipCount: number
  reelCount: number
  canCreateClips: boolean
  videoReady: boolean
  taggingEnabled: boolean
  aiVideoEnabled: boolean
  aiWorking: boolean
  clipTitle: string
  setClipTitle: (v: string) => void
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
  canDeleteVideo: boolean
  onDeleteVideo: () => void
  onRunAiAssist: () => void
  clips: ClipRow[]
  highlightClipId: string | null
  reelClipIds: Set<string>
  onToggleReel: (clipId: string) => void
  onLoadClipInEditor: (c: ClipRow) => void
  onPreviewClip: (c: ClipRow) => void
  onDeleteClip: (clipId: string) => void
  teamId: string
  clipAttachedPlayerIds: string[]
  onClipAttachedPlayerIdsChange: (ids: string[]) => void
  /** Full-film recruiting links — collapsible under clip details (desktop moved from center column). */
  filmAttachedPlayerIds?: string[]
  onFilmAttachedPlayerIdsChange?: (ids: string[]) => void | Promise<void>
  filmRosterLinksDisabled?: boolean
  /** Hide this panel to widen the player (desktop). */
  onRequestCollapse?: () => void
}

const TAB_DEFS: Array<{ id: CoachFilmTabId; label: string; icon: typeof Video }> = [
  { id: "clip", label: "Clip details", icon: ClipboardList },
  { id: "tags", label: "Quick tags", icon: Tags },
  { id: "notes", label: "Notes", icon: PenLine },
  { id: "assistant", label: "Assistant", icon: Wand2 },
  { id: "reel", label: "Saved clips", icon: Video },
]

export function CoachFilmSidePanel(props: Props) {
  const [tab, setTab] = useState<CoachFilmTabId>("clip")

  const assistantDisabled = props.aiWorking || !props.aiVideoEnabled

  const reelSummary = useMemo(() => {
    const base = `${props.clipCount} clip${props.clipCount === 1 ? "" : "s"}`
    if (props.reelCount > 0) return `${base} · ${props.reelCount} on your teaching reel`
    return base
  }, [props.clipCount, props.reelCount])

  return (
    <div className="flex max-h-none min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] xl:max-h-[calc(100dvh-7.5rem)]">
      <div className="relative border-b border-border">
        {props.onRequestCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-0.5 z-10 hidden h-8 w-8 text-muted-foreground hover:text-foreground xl:inline-flex"
            onClick={props.onRequestCollapse}
            aria-label="Hide clip details panel"
          >
            <PanelRightClose className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
        <div
          className={cn(
            "scrollbar-thin flex flex-wrap gap-0.5 overflow-x-auto px-1.5 py-1.5",
            props.onRequestCollapse && "xl:pr-10",
          )}
        >
          {TAB_DEFS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:gap-1.5 sm:px-2.5 sm:text-xs",
                tab === id
                  ? "bg-[#0F172A] text-white shadow-sm dark:bg-[#1E293B]"
                  : "border border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="max-w-[8rem] truncate sm:max-w-none">{label}</span>
              {id === "reel" && props.clipCount > 0 ? (
                <span className="rounded bg-background/25 px-1 py-0.5 font-mono text-[9px] sm:text-[10px]">{props.clipCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2.5 lg:px-3 lg:py-3" role="tabpanel">
        {tab === "clip" && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-1">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-foreground">Clip name</h4>
                <FilmInfoTip label="Clip title">
                  <p>Short label athletes recognize — e.g. Counter TD, Cover 4 bust.</p>
                </FilmInfoTip>
              </div>
              <Input
                ref={props.clipTitleInputRef}
                className="mt-1.5 min-h-9 text-sm"
                value={props.clipTitle}
                onChange={(e) => props.setClipTitle(e.target.value)}
                placeholder="Name this clip"
              />
            </div>

            {props.canCreateClips && (
              <ClipPlayerAttachmentField
                teamId={props.teamId}
                selectedIds={props.clipAttachedPlayerIds}
                onChange={props.onClipAttachedPlayerIdsChange}
                disabled={!props.videoReady}
              />
            )}

            {props.onFilmAttachedPlayerIdsChange && (
              <details className="rounded-lg border border-border bg-muted/20 px-2.5 py-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-foreground">
                  Full film — recruiting links
                </summary>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                  Optional whole-file links for recruiting profiles. Use clip attachments above for play-level highlights.
                </p>
                <div className="mt-2">
                  <ClipPlayerAttachmentField
                    teamId={props.teamId}
                    selectedIds={props.filmAttachedPlayerIds ?? []}
                    disabled={Boolean(props.filmRosterLinksDisabled)}
                    onChange={(ids) => {
                      void props.onFilmAttachedPlayerIdsChange?.(ids)
                    }}
                  />
                </div>
              </details>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Field
                label="Play / concept"
                hint="Inside zone, mesh, stunt…"
                value={props.clipCategories.playType}
                onChange={(v) => props.setClipCategories((o) => ({ ...o, playType: v }))}
              />
              <Field
                label="Situation"
                hint="Down & distance, field zone…"
                value={props.clipCategories.situation}
                onChange={(v) => props.setClipCategories((o) => ({ ...o, situation: v }))}
              />
              <Field
                label="Personnel"
                hint="11 personnel, empty, nickels…"
                value={props.clipCategories.personnel}
                onChange={(v) => props.setClipCategories((o) => ({ ...o, personnel: v }))}
              />
              <Field
                label="Result"
                hint="Explosive, turnover, penalty…"
                value={props.clipCategories.outcome}
                onChange={(v) => props.setClipCategories((o) => ({ ...o, outcome: v }))}
              />
            </div>
            {props.canDeleteVideo && (
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-medium leading-snug text-foreground">Delete this game film</p>
                  <FilmInfoTip label="Deleting game film">
                    <p>Removes the full file and every clip on it from storage.</p>
                  </FilmInfoTip>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="mt-2 h-9 w-full font-semibold"
                  onClick={() => void props.onDeleteVideo()}
                >
                  Delete film
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "tags" && (
          <div className="space-y-4">
            {(Object.entries(COACH_QUICK_TAG_GROUPS) as Array<[string, (typeof COACH_QUICK_TAG_GROUPS)["unit"]]>).map(
              ([key, group]) => (
                <div key={key}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.tags.map((t) => {
                      const on = props.quickTagsSelected.has(t.value)
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => props.toggleQuickTag(t.value)}
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
            {props.taggingEnabled ? (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Extra tags (comma-separated)
                </label>
                <Input
                  className="mt-2"
                  value={props.clipTagsFree}
                  onChange={(e) => props.setClipTagsFree(e.target.value)}
                  placeholder="e.g. #12, jet motion, 4th quarter"
                />
              </div>
            ) : (
              <p className="text-xs text-amber-800 dark:text-amber-200">Tagging is off for your team.</p>
            )}
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-2">
            <textarea
              className="min-h-[160px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={props.clipDescription}
              onChange={(e) => props.setClipDescription(e.target.value)}
              placeholder="What happened on this play? What should athletes take away?"
            />
          </div>
        )}

        {tab === "assistant" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="flex min-w-0 flex-1 items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <span>
                  Suggests title, notes, and tags from what you typed and clip timing — not automatic video analysis.
                </span>
                <FilmInfoTip label="Assistant details">
                  <p>Uses your notes, tags, and timing. Edits nothing until you save the clip.</p>
                </FilmInfoTip>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-10 w-full gap-2 border border-primary/30 bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/15"
              disabled={assistantDisabled}
              onClick={() => void props.onRunAiAssist()}
            >
              {props.aiWorking ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="h-4 w-4" aria-hidden />
              )}
              Run assistant
            </Button>
            {!props.aiVideoEnabled && (
              <p className="text-center text-xs text-amber-800 dark:text-amber-200">Assistant is off for this team.</p>
            )}
          </div>
        )}

        {tab === "reel" && (
          <div className="space-y-2">
            <p className="text-[11px] leading-snug text-muted-foreground">{reelSummary}</p>
            <ClipReelPanel
              clips={props.clips}
              highlightClipId={props.highlightClipId}
              taggingEnabled={props.taggingEnabled}
              reelClipIds={props.reelClipIds}
              onToggleReel={props.onToggleReel}
              onLoadInEditor={props.onLoadClipInEditor}
              onPreview={props.onPreviewClip}
              onDelete={props.onDeleteClip}
            />
          </div>
        )}
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
