"use client"

import type { ComponentProps } from "react"
import { ArrowRight } from "lucide-react"
import { DraftClipQueue } from "@/components/portal/game-video/draft-clip-queue"
import { QuickClipBar } from "@/components/portal/game-video/quick-clip-bar"
import { Button } from "@/components/ui/button"

export function CaptureStepPanel({
  quickClipProps,
  draftQueueProps,
  canContinue,
  onContinue,
}: {
  quickClipProps: ComponentProps<typeof QuickClipBar>
  draftQueueProps: ComponentProps<typeof DraftClipQueue>
  canContinue: boolean
  onContinue: () => void
}) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <QuickClipBar {...quickClipProps} />
      <DraftClipQueue {...draftQueueProps} bulkSelectEnabled={false} showTitleInputs={false} />
      <Button
        type="button"
        size="lg"
        className="h-11 w-full gap-2 font-semibold"
        disabled={!canContinue}
        onClick={onContinue}
      >
        Continue to review
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
      {!canContinue ? (
        <p className="text-center text-[11px] text-muted-foreground">
          Mark at least one clip (Mark start → Mark end) to continue.
        </p>
      ) : null}
    </div>
  )
}
