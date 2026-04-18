"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClipboardList, Loader2, Sparkles, Tags, PenLine, Video, Wand2 } from "lucide-react"
import { ClipReelPanel } from "@/components/portal/game-video/clip-reel-panel"
import type { ClipRow } from "@/components/portal/game-video/game-video-types"
import { ClipPlayerAttachmentField } from "@/components/portal/game-video/clip-player-attachment-field"
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
    <div className="flex max-h-none min-h-0 flex-col rounded-2xl border-2 border-border bg-card shadow-lg ring-1 ring-black/[0.04] dark:ring-white/[0.06] xl:max-h-[calc(100dvh-12rem)]">
      <div className="border-b border-border px-3 py-3 lg:px-4">
        <div className="flex flex-wrap gap-2">
          {TAB_DEFS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4",
                tab === id
                  ? "bg-[#0F172A] text-white shadow-md dark:bg-[#1E293B]"
                  : "border border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span>{label}</span>
              {id === "reel" && props.clipCount > 0 ? (
                <span className="rounded-md bg-background/25 px-1.5 py-0.5 font-mono text-[10px]">{props.clipCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-5 lg:py-6" role="tabpanel">
        {tab === "clip" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide text-foreground">Clip name</h4>
              <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-400">
                Short label players will recognize in the locker room — e.g. “Counter TD” or “Cover 4 bust.”
              </p>
              <Input
                ref={props.clipTitleInputRef}
                className="mt-2 min-h-[44px] text-base"
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

            <div className="grid gap-3 sm:grid-cols-2">
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
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
              Fast breakdown: use <strong className="text-foreground">Save &amp; next clip</strong> under the player to chain
              plays on the same film. <strong className="text-foreground">Save clip only</strong> keeps your marks if you’re
              adjusting metadata.
            </p>
            {props.canDeleteVideo && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-foreground">Remove this game film</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Deletes the full file from storage and all clips on it. Use only if the upload was wrong.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  className="mt-3 h-12 min-h-[48px] px-6 text-base font-bold shadow-md"
                  onClick={() => void props.onDeleteVideo()}
                >
                  Delete film
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "tags" && (
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Tap what applies — we’ll attach them when you save. Add custom tags below if your program uses its own
              vocabulary.
            </p>
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
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Jot what you’ll tell the room — mistakes, coaching points, or shout-outs. This drives search and the
              assistant (not automatic video analysis).
            </p>
            <textarea
              className="min-h-[200px] w-full rounded-xl border border-input bg-background px-3 py-3 text-sm leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={props.clipDescription}
              onChange={(e) => props.setClipDescription(e.target.value)}
              placeholder="What happened on this play? What should athletes take away?"
            />
          </div>
        )}

        {tab === "assistant" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                What the assistant does
              </p>
              <ul className="mt-3 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>Suggest a clear clip title from your notes</li>
                <li>Draft or tighten coaching notes</li>
                <li>Propose tags and categories you can edit</li>
                <li>Summarize why this moment matters for teaching</li>
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Uses:</strong> your notes, tags, clip timing, and labels you typed — not
                computer vision or automatic play detection yet. Transcripts and deeper analysis can plug in later.
              </p>
            </div>
            <details className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Future: auto key moments</summary>
              <p className="mt-2 leading-relaxed">
                Planned hooks: transcript alignment, scorebug OCR, detector-backed clips. Same clip records — richer
                metadata when those ship.
              </p>
            </details>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="h-12 min-h-[48px] w-full gap-2 border-2 border-primary/30 bg-primary/10 text-base font-bold text-primary hover:bg-primary/15"
              disabled={assistantDisabled}
              onClick={() => void props.onRunAiAssist()}
            >
              {props.aiWorking ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="h-5 w-5" aria-hidden />
              )}
              Run breakdown assistant
            </Button>
            {!props.aiVideoEnabled && (
              <p className="text-center text-xs text-amber-800 dark:text-amber-200">Assistant is off for this team.</p>
            )}
          </div>
        )}

        {tab === "reel" && (
          <div className="space-y-2">
            <p className="text-sm leading-snug text-slate-700 dark:text-slate-300">
              {reelSummary}. Tap <strong className="font-semibold text-foreground">Add to reel</strong> to queue teaching clips.
            </p>
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
      <label className="text-sm font-bold uppercase tracking-wide text-foreground">{label}</label>
      <Input className="mt-2 min-h-[44px] text-base" value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint} />
    </div>
  )
}
