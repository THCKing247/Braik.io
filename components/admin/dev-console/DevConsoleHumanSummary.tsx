"use client"

import type { DevModel } from "@/lib/admin/dev-console-schema"

export type DraftSummaryInput = {
  advanced: boolean
  model: DevModel
  quickSearch: string
  dateStart: string
  dateEnd: string
  actionType: string
}

export function summarizeDraft(input: DraftSummaryInput): string {
  if (input.advanced) {
    const range =
      input.dateStart || input.dateEnd
        ? ` — time window ${input.dateStart || "…"} → ${input.dateEnd || "…"}`
        : ""
    return `Structured query on ${input.model}${range}. Review conditions on the left, then Run query.`
  }

  const q = input.quickSearch.trim()
  if (!q) {
    return "Browse recent audit logs and agent actions (last 30 days applies when no date range is set)."
  }
  if (q.includes("@") && !/^[0-9a-f-]{36}$/i.test(q)) {
    return `Find users whose email matches “${q}”.`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(q) || q.includes("..")) {
    return `Filter activity in the time range parsed from “${q}”.`
  }
  if (/^[0-9a-f-]/i.test(q)) {
    return `Trace UUID “${q.slice(0, 12)}…” across entities, audit logs, and agent actions.`
  }
  return `Search platform data using “${q.slice(0, 80)}${q.length > 80 ? "…" : ""}”.`
}
