"use client"

import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export type DevConsolePanelMode = "global" | "structured" | "trace"

export function DevConsoleHeader(props: {
  quickSearch: string
  onQuickSearchChange: (v: string) => void
  onQuickSearchRun: () => void
  panelMode: DevConsolePanelMode
  onPanelModeChange: (m: DevConsolePanelMode) => void
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
          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Search mode</span>
          <div className="flex flex-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
            {(
              [
                ["global", "Global"],
                ["structured", "Structured"],
                ["trace", "Trace"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  props.panelMode === id ? "bg-white text-orange-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                )}
                onClick={() => props.onPanelModeChange(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className={adminUi.btnSecondarySm} onClick={() => props.onShareLink()}>
            Copy link
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className={cn(adminUi.label, "min-w-0 flex-1")}>
          {props.panelMode === "trace" ? "Trace id" : "Global search"}
          <input
            value={props.quickSearch}
            onChange={(e) => props.onQuickSearchChange(e.target.value)}
            disabled={props.disabledSearch || props.panelMode === "structured"}
            placeholder={
              props.panelMode === "trace"
                ? "Full or partial UUID"
                : "User UUID · partial UUID · email · inactive · 2026-04-01..2026-04-20 · today · last 7 days"
            }
            className={cn(adminUi.input, "font-mono text-xs")}
          />
          <p className="mt-1 text-[10px] font-medium text-neutral-500">
            Examples: full UUID, 8+ hex chars, email, status token, date range with .. , presets like{" "}
            <span className="font-mono">today</span> or <span className="font-mono">last 7 days</span>.
          </p>
        </label>
        <button
          type="button"
          className={cn(adminUi.btnPrimarySm, "sm:mb-0")}
          disabled={props.disabledSearch || props.panelMode === "structured"}
          onClick={() => props.onQuickSearchRun()}
          title={props.panelMode === "structured" ? "Use Run query below for structured search" : undefined}
        >
          Search
        </button>
      </div>
    </header>
  )
}
