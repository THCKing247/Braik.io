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
    <nav aria-label="Clip workflow steps" className="rounded-lg border border-white/15 bg-[#0f172a]/95 p-1 shadow-sm">
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
                  "flex h-9 w-full min-w-[6.25rem] flex-col justify-center rounded-md px-1.5 py-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-[0.55]",
                  active
                    ? "bg-sky-500 text-white shadow-inner"
                    : "border border-white/15 bg-[#0b1220]/85 text-slate-100 hover:bg-white/12",
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-95">Step {id}</span>
                <span className="truncate text-[12px] font-semibold leading-tight">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
