"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { adminUi } from "@/lib/admin/admin-ui"

interface AdminModalProps {
  open: boolean
  title: string
  summary?: string
  onClose: () => void
  children: ReactNode
}

export function AdminModal({ open, title, summary, onClose, children }: AdminModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Close modal"
      />
      <div
        className={cn(
          adminUi.panel,
          "relative z-[121] w-full max-w-6xl max-h-[min(90vh,920px)] flex flex-col overflow-hidden p-0 text-slate-100 shadow-2xl shadow-black/50"
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.08] bg-[#0a1020]/40 px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-athletic text-lg font-bold uppercase tracking-wide text-white">{title}</h3>
            {summary ? <p className="mt-1 text-xs leading-relaxed text-slate-400">{summary}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(adminUi.btnSecondarySm, "shrink-0 border-white/10")}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
