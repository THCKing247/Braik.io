"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PortalSessionInactivityWarningProps = {
  open: boolean
  secondsRemaining: number
  onStillHere: () => void
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function PortalSessionInactivityWarning({
  open,
  secondsRemaining,
  onStillHere,
}: PortalSessionInactivityWarningProps) {
  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="max-w-md" showMobileSheetHandle={false}>
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            You&apos;ve been inactive for a while. For your security, you&apos;ll be signed out in{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatCountdown(secondsRemaining)}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" className="w-full sm:w-auto" onClick={onStillHere}>
            Still here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
