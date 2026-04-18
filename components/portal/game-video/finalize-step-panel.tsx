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
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
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
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" className="h-11 gap-2 font-semibold" onClick={onBack} disabled={saving}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          size="lg"
          className="h-11 min-w-[200px] gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
          disabled={saving || drafts.length === 0}
          onClick={onFinalize}
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
          Save all clips
        </Button>
      </div>
    </div>
  )
}
