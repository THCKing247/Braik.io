"use client"

import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

const DAY_OPTIONS = [7, 30, 90, 365] as const

type Props = {
  /** Current selection (must match a DAY_OPTIONS value) */
  value: number
  /** Query param name for the GET form */
  paramName?: string
  className?: string
}

/** Segmented timeframe control (7d / 30d / 90d / 1yr) — GET submit preserves other search params only if parent uses hidden fields; base pages use `tf` only. */
export function AdminTimeframeSegment({ value, paramName = "tf", className }: Props) {
  return (
    <form method="get" className={cn("inline-flex", className)}>
      <div className={adminUi.pillGroup} role="group" aria-label="Time range">
        {DAY_OPTIONS.map((days) => (
          <button
            key={days}
            type="submit"
            name={paramName}
            value={days}
            className={cn(adminUi.pill, value === days && adminUi.pillActive)}
          >
            {days === 365 ? "1yr" : `${days}d`}
          </button>
        ))}
      </div>
    </form>
  )
}
