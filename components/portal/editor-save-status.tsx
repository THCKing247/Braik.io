"use client"

import type { EditorSaveStatus } from "@/lib/hooks/use-editor-save-state"

const SAVED_JUST_NOW_MS = 60 * 1000

function formatSavedAt(ts: number): string {
  const now = Date.now()
  if (now - ts < SAVED_JUST_NOW_MS) return "Saved just now"
  const d = new Date(ts)
  return `Saved at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
}

interface EditorSaveStatusProps {
  status: EditorSaveStatus
  lastSavedAt?: number
  className?: string
}

export function EditorSaveStatusChip({ status, lastSavedAt, className = "" }: EditorSaveStatusProps) {
  const [label, style] = ((): [string, string] => {
    switch (status) {
      case "saved":
        return [
          lastSavedAt != null ? formatSavedAt(lastSavedAt) : "Saved",
          "bg-slate-100 text-slate-700 border-slate-200",
        ]
      case "dirty":
        return ["Unsaved changes", "bg-amber-50 text-amber-800 border-amber-200"]
      case "saving":
        return ["Saving...", "bg-blue-50 text-blue-700 border-blue-200"]
      case "error":
        return ["Save failed", "bg-red-50 text-red-700 border-red-200"]
      default:
        return ["", "bg-slate-100 text-slate-600 border-slate-200"]
    }
  })()

  if (!label) return null

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${style} ${className}`}
      aria-live="polite"
    >
      {label}
    </span>
  )
}
