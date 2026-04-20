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
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close modal"
      />
      <div
        className={cn(
          adminUi.panel,
          "relative z-[121] flex max-h-[min(90vh,920px)] w-full max-w-6xl flex-col overflow-hidden p-0 text-admin-primary shadow-xl shadow-neutral-900/10"
        )}
      >
        <div className={cn(adminUi.modalHeader, "flex shrink-0 items-start justify-between gap-4")}>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-admin-primary">{title}</h3>
            {summary ? (
              <p className="mt-1 text-xs font-medium leading-relaxed text-admin-secondary">{summary}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(adminUi.btnSecondarySm, "shrink-0")}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
