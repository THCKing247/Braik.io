"use client"

import { ArrowLeft, Loader2, Save } from "lucide-react"
import { mergeQuickAndFreeTags } from "@/components/portal/game-video/coach-quick-tags"
import type { FilmDraftClip } from "@/components/portal/game-video/film-draft-types"
import { formatMsRange } from "@/lib/video/timecode"
import { Button } from "@/components/ui/button"

export function FinalizeStepPanel({
  drafts,
  taggingEnabled,
  saving,
  onFinalize,
  onBack,
}: {
  drafts: FilmDraftClip[]
  taggingEnabled: boolean
  saving: boolean
  onFinalize: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] leading-snug text-slate-300">
        Saving uploads every draft clip to the roster with the names, tags, and athlete links you added. Full-film recruiting links stay
        separate unless you edit them below.
      </p>
      {drafts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 px-3 py-8 text-center text-sm text-muted-foreground">
          Nothing to save — add drafts from Capture first.
        </p>
      ) : (
        <ul className="max-h-[min(280px,38vh)] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
          {drafts.map((d) => {
            const tags =
              taggingEnabled ? mergeQuickAndFreeTags(new Set(d.quickTagKeys), d.clipTagsFree) : []
            return (
              <li key={d.id} className="rounded-lg bg-card/90 px-3 py-2 text-sm shadow-sm">
                <div className="font-semibold text-foreground">{d.titleDraft.trim() || d.slotLabel}</div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatMsRange(d.startMs, d.endMs)}
                </div>
                {tags.length > 0 ? (
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{tags.slice(0, 6).join(", ")}
                    {tags.length > 6 ? "…" : ""}</p>
                ) : null}
                {d.attachedPlayerIds.length > 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {d.attachedPlayerIds.length} athlete{d.attachedPlayerIds.length === 1 ? "" : "s"} linked to this clip
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full shrink-0 gap-2 font-semibold sm:w-auto sm:min-w-[7rem]"
          onClick={onBack}
          disabled={saving}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          className="h-10 w-full min-w-0 flex-1 gap-2 bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-700 sm:min-h-0 sm:min-w-[12rem]"
          disabled={saving || drafts.length === 0}
          onClick={onFinalize}
        >
          {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Save className="h-4 w-4 shrink-0" aria-hidden />}
          Save all clips
        </Button>
      </div>
    </div>
  )
}
