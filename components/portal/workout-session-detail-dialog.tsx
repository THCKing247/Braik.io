"use client"

import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  parseWorkoutItemsFromDb,
  type WorkoutItem,
  workoutItemsSummaryLine,
} from "@/lib/weight-room/workout-items"

export type WorkoutSessionDetailModel = {
  id: string
  title: string
  description: string | null
  start_time: string
  duration_minutes: number
  workout_items?: unknown
}

function WorkoutItemsReadOnly({ items, legacyDescription }: { items: WorkoutItem[]; legacyDescription: string | null }) {
  if (items.length > 0) {
    return (
      <ul className="space-y-3">
        {items.map((row, i) => (
          <li
            key={`${row.lift}-${row.reps}-${i}`}
            className="flex flex-col gap-0.5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <span className="font-semibold text-[#0F172A]">{row.lift || "—"}</span>
            <span className="text-sm text-[#64748B] sm:text-right">{row.reps || "—"}</span>
          </li>
        ))}
      </ul>
    )
  }
  if (legacyDescription?.trim()) {
    return (
      <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#334155]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Session notes (legacy)</p>
        <p className="mt-1 whitespace-pre-wrap">{legacyDescription.trim()}</p>
      </div>
    )
  }
  return <p className="text-sm text-[#64748B]">No workout details added for this session yet.</p>
}

export function WorkoutSessionDetailDialog({
  open,
  onOpenChange,
  session,
  calendarDay,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: WorkoutSessionDetailModel | null
  /** Calendar date this occurrence refers to (recurring weekly template). */
  calendarDay: Date | null
}) {
  if (!session) return null

  const items = parseWorkoutItemsFromDb(session.workout_items)
  const preview = workoutItemsSummaryLine(items, 4)
  const dayPart = calendarDay ? format(calendarDay, "EEEE, MMM d, yyyy") : null
  const timePart = `${String(session.start_time).slice(0, 5)} · ${session.duration_minutes} min`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-hidden bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-8 text-left text-lg">{session.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 border-b border-[#E5E7EB] pb-3 text-sm text-[#64748B]">
          {dayPart ? <p>{dayPart}</p> : null}
          <p>{timePart}</p>
          {preview && items.length > 0 ? <p className="text-xs text-[#94A3B8]">{preview}</p> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Workout</p>
          <WorkoutItemsReadOnly items={items} legacyDescription={session.description} />
        </div>
        <div className="flex justify-end border-t border-[#E5E7EB] pt-3">
          <Button type="button" variant="secondary" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
