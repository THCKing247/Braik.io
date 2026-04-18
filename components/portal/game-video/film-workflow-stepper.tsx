"use client"

import { cn } from "@/lib/utils"

export type FilmWorkflowStep = 1 | 2 | 3 | 4

const STEPS: Array<{ step: FilmWorkflowStep; label: string }> = [
  { step: 1, label: "Capture" },
  { step: 2, label: "Review" },
  { step: 3, label: "Name & tag" },
  { step: 4, label: "Finalize" },
]

export function FilmWorkflowStepper({
  step,
  draftCount,
  onStepChange,
  disabled,
}: {
  step: FilmWorkflowStep
  draftCount: number
  onStepChange: (s: FilmWorkflowStep) => void
  disabled?: boolean
}) {
  const canEnter = (s: FilmWorkflowStep) => {
    if (s <= 1) return true
    return draftCount > 0
  }

  return (
    <nav aria-label="Clip workflow steps" className="rounded-xl border border-white/15 bg-[#0f172a]/95 p-1.5 shadow-sm">
      <ol className="flex flex-wrap gap-1">
        {STEPS.map(({ step: id, label }) => {
          const active = step === id
          const allowed = canEnter(id)
          return (
            <li key={id} className="min-w-0 flex-1 basis-[calc(50%-4px)] sm:basis-auto">
              <button
                type="button"
                disabled={disabled || !allowed}
                onClick={() => allowed && onStepChange(id)}
                className={cn(
                  "flex h-10 w-full min-w-[7rem] flex-col justify-center rounded-lg px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-45",
                  active
                    ? "bg-sky-600 text-white shadow-sm"
                    : "border border-white/15 bg-[#0b1220]/85 text-slate-100 hover:bg-white/12",
                )}
              >
                <span className="text-[11px] font-bold uppercase tracking-wide opacity-95">Step {id}</span>
                <span className="truncate text-[13px] font-semibold">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
