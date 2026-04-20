"use client"

import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export function DevConsoleHeader(props: {
  quickSearch: string
  onQuickSearchChange: (v: string) => void
  onQuickSearchRun: () => void
  advanced: boolean
  onAdvancedChange: (v: boolean) => void
  onShareLink: () => void
  disabledSearch?: boolean
}) {
  return (
    <header className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Braik internal</p>
          <h1 className="font-sans text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">Dev Console</h1>
          <p className="max-w-2xl text-sm font-medium leading-relaxed text-neutral-600">
            Search records, trace UUIDs, inspect logs, and review related activity — without writing SQL.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-800">
            <input
              type="checkbox"
              checked={props.advanced}
              onChange={(e) => props.onAdvancedChange(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Advanced mode
          </label>
          <button type="button" className={adminUi.btnSecondarySm} onClick={() => props.onShareLink()}>
            Copy link
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className={cn(adminUi.label, "min-w-0 flex-1")}>
          Quick search
          <input
            value={props.quickSearch}
            onChange={(e) => props.onQuickSearchChange(e.target.value)}
            disabled={props.disabledSearch}
            placeholder="UUID, partial UUID, email, date, or range (2026-04-01 .. 2026-04-02)"
            className={cn(adminUi.input, "font-mono text-xs")}
          />
        </label>
        <button
          type="button"
          className={cn(adminUi.btnPrimarySm, "sm:mb-0")}
          disabled={props.disabledSearch || props.advanced}
          onClick={() => props.onQuickSearchRun()}
          title={props.advanced ? "Turn off Advanced mode to run quick search" : undefined}
        >
          Search
        </button>
      </div>
    </header>
  )
}
