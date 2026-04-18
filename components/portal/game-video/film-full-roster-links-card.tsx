"use client"

import { ClipPlayerAttachmentField } from "@/components/portal/game-video/clip-player-attachment-field"

/**
 * Whole-file recruiting roster links (`game_video_players`). Keep separate from clip-level attachments in the workflow.
 */
export function FilmFullRosterLinksCard({
  teamId,
  filmAttachedPlayerIds,
  onFilmAttachedPlayerIdsChange,
  disabled,
}: {
  teamId: string
  filmAttachedPlayerIds: string[]
  onFilmAttachedPlayerIdsChange: (ids: string[]) => void | Promise<void>
  disabled?: boolean
}) {
  return (
    <details className="rounded-lg border border-white/12 bg-[#0f172a]/85 p-2 shadow-sm ring-1 ring-white/[0.06]">
      <summary className="cursor-pointer text-[13px] font-semibold leading-snug text-slate-100">
        Full film — recruiting roster links (optional)
      </summary>
      <p className="mt-2 text-[11px] leading-snug text-slate-400">
        Links the entire file for recruiting profiles. Clip highlights use “Players on this clip” in Name &amp; Tag — different from this
        section.
      </p>
      <div className="mt-3">
        <ClipPlayerAttachmentField
          teamId={teamId}
          selectedIds={filmAttachedPlayerIds}
          disabled={disabled}
          heading="Athletes linked to full film file"
          description="Optional whole-game links. Use clip attachments in Step 3 for highlight-specific recruiting film."
          onChange={(ids) => {
            void Promise.resolve(onFilmAttachedPlayerIdsChange(ids))
          }}
        />
      </div>
    </details>
  )
}
