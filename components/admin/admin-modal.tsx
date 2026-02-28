"use client"

import { ReactNode } from "react"

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
        className="absolute inset-0 bg-black/75"
        aria-label="Close modal"
      />
      <div className="relative z-[121] w-full max-w-6xl rounded-xl border border-white/15 bg-[#141418] p-4 text-white shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {summary ? <p className="mt-1 text-xs text-white/70">{summary}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
