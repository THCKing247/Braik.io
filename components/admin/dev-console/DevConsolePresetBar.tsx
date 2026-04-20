"use client"

import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

type Preset = { id: string; name: string }

export function DevConsolePresetBar(props: {
  presets: Preset[]
  recent: string[]
  onChip: (key: string) => void
  onSavePreset?: () => void
  onLoadPreset?: (id: string) => void
}) {
  const savePreset = props.onSavePreset

  const chips: { key: string; label: string }[] = [
    { key: "errors", label: "Recent errors" },
    { key: "user_email", label: "User by email" },
    { key: "uuid_trace", label: "UUID trace" },
    { key: "team_activity", label: "Team activity" },
    { key: "audit_today", label: "Audit today" },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            className={cn(
              "rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/90 hover:text-orange-950"
            )}
            onClick={() => props.onChip(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-600">
          Saved views
          <select
            className={cn(adminUi.select, "h-8 max-w-[200px] py-1 text-[11px]")}
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value
              if (id) props.onLoadPreset?.(id)
              e.target.value = ""
            }}
          >
            <option value="">Load…</option>
            {props.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {savePreset ? (
          <button type="button" className={adminUi.btnSecondarySm} onClick={() => savePreset()}>
            Save current view
          </button>
        ) : null}
      </div>

      {props.recent.length > 0 ? (
        <div className="text-[11px] text-neutral-500">
          <span className="font-semibold text-neutral-600">Recent: </span>
          {props.recent.slice(0, 5).join(" · ")}
        </div>
      ) : null}
    </div>
  )
}
