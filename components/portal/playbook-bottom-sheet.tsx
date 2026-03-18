"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Mobile/tablet bottom sheet for playbook flows (more actions, tools, etc.).
 * Safe-area aware; use lg:hidden on the trigger wrapper when sheet is mobile-only.
 */
export function PlaybookBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  className?: string
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="playbook-sheet-title"
    >
      <button
        type="button"
        className="flex-1 min-h-[20vh] bg-black/50 w-full border-0 cursor-default"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "bg-white rounded-t-2xl shadow-2xl border border-slate-200 border-b-0 max-h-[min(85vh,600px)] flex flex-col",
          "pb-[max(1rem,env(safe-area-inset-bottom))] pt-2",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-2 border-b border-slate-100 shrink-0">
          <h2 id="playbook-sheet-title" className="text-base font-semibold text-slate-900 truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-600 touch-manipulation shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-2 min-h-0">
          {children}
        </div>
      </div>
    </div>
  )
}
