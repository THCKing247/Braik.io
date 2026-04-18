"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClipboardList, Loader2, Sparkles, Tags, PenLine, Video, Wand2 } from "lucide-react"
import { ClipReelPanel } from "@/components/portal/game-video/clip-reel-panel"
import type { ClipRow } from "@/components/portal/game-video/game-video-types"
import { COACH_QUICK_TAG_GROUPS } from "@/components/portal/game-video/coach-quick-tags"
import { cn } from "@/lib/utils"

export type CoachFilmTabId = "clip" | "tags" | "notes" | "assistant" | "reel"

type Props = {
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
}

const TAB_DEFS: Array<{ id: CoachFilmTabId; label: string; icon: typeof Video }> = [
  { id: "clip", label: "Clip", icon: ClipboardList },
  { id: "tags", label: "Tags", icon: Tags },
  { id: "notes", label: "Notes", icon: PenLine },
  { id: "assistant", label: "Assistant", icon: Wand2 },
  { id: "reel", label: "My clips", icon: Video },
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
    <div className="flex max-h-none min-h-0 flex-col rounded-2xl border border-border bg-card shadow-lg ring-1 ring-black/[0.04] dark:ring-white/[0.06] xl:max-h-[calc(100vh-9rem)]">
      <div className="border-b border-border px-3 py-3 lg:px-4">
        <div className="flex flex-wrap gap-1">
          {TAB_DEFS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:text-[13px]",
                tab === id
                  ? "bg-[#0F172A] text-white shadow-sm dark:bg-[#1E293B]"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              <span>{label}</span>
              {id === "reel" && props.clipCount > 0 ? (
                <span className="rounded-md bg-background/25 px-1.5 py-0.5 font-mono text-[10px]">{props.clipCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:py-5" role="tabpanel">
        {tab === "clip" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clip name</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Short label players will recognize in the locker room — e.g. “Counter TD” or “Cover 4 bust.”
              </p>
              <Input
                className="mt-2 min-h-[44px] text-base"
                value={props.clipTitle}
                onChange={(e) => props.setClipTitle(e.target.value)}
                placeholder="Name this clip"
              />
            </div>
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
              Fastest workflow: use the large <strong className="text-foreground">Save clip</strong> button under the scrubber
              once your start/end marks look right.
            </p>
            {props.canDeleteVideo && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-foreground">Remove this game film</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Deletes the full file from storage and all clips on it. Use only if the upload was wrong.
                </p>
                <Button type="button" variant="destructive" size="sm" className="mt-3" onClick={() => void props.onDeleteVideo()}>
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
              className="w-full gap-2"
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
            <p className="text-xs text-muted-foreground">
              {reelSummary}. Star clips for your teaching reel.
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
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <Input className="mt-1.5" value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint} />
    </div>
  )
}
