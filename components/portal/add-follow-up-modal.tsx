"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FOLLOW_UP_CATEGORY_LABELS } from "@/lib/roster/follow-up-ui"
import { DateTimePicker } from "@/components/portal/date-time-picker"

/** Same next-slot rounding as scheduling create-event flow (`defaultCreateWindow` start). */
function defaultFollowUpStart(): Date {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
  if (start <= now) start.setMinutes(start.getMinutes() + 15)
  return start
}

export type AddFollowUpModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerId: string
  teamId: string
  playerDisplayName: string
  onSuccess?: () => void
}

export function AddFollowUpModal({
  open,
  onOpenChange,
  playerId,
  teamId,
  playerDisplayName,
  onSuccess,
}: AddFollowUpModalProps) {
  const [category, setCategory] = useState("physical_follow_up")
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setCategory("physical_follow_up")
    setStartDate(defaultFollowUpStart())
    setNote("")
  }, [open])

  const handleSubmit = async () => {
    setError(null)
    if (!startDate || Number.isNaN(startDate.getTime())) {
      setError("Choose a date and time using the picker.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/roster/${encodeURIComponent(playerId)}/follow-ups?teamId=${encodeURIComponent(teamId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          note: note.trim() || undefined,
          start: startDate.toISOString(),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(typeof body.error === "string" ? body.error : "Could not create follow-up.")
        return
      }
      onOpenChange(false)
      onSuccess?.()
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-visible">
        <DialogHeader>
          <DialogTitle>Add follow-up</DialogTitle>
          <DialogDescription>
            Schedule a coach follow-up for <span className="font-medium text-foreground">{playerDisplayName}</span>. It will appear on the team calendar
            in purple.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="follow-up-type">Type</Label>
            <select
              id="follow-up-type"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {Object.entries(FOLLOW_UP_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <DateTimePicker
            label="Scheduled time *"
            value={startDate}
            onChange={setStartDate}
            placeholder="Date and time"
            id="follow-up-scheduled-start"
          />
          <div className="grid gap-1.5">
            <Label htmlFor="follow-up-note">Notes (optional)</Label>
            <textarea
              id="follow-up-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Call parent after practice"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Save & add to calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
