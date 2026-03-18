"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Bottom sheet anchored to bottom. Capped height + safe padding so content
 * stays out of the vertical center (native fullscreen exit on mobile).
 */
export function PlaybookBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  variant = "light",
  isFullscreen = false,
  /** Pinned above safe area (e.g. timeline scrubber) — stays at physical bottom */
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  className?: string
  variant?: "light" | "dark"
  isFullscreen?: boolean
  footer?: React.ReactNode
}) {
  if (!open) return null
  const dark = variant === "dark"
  const maxH = isFullscreen ? "max-h-[60vh]" : "max-h-[70vh]"
  const footerPad = isFullscreen
    ? "pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3"
    : "pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3"

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end items-stretch lg:hidden pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="playbook-sheet-title"
    >
      <button
        type="button"
        className="min-h-[32vh] flex-1 w-full bg-black/40 border-0 cursor-default pointer-events-auto shrink"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "pointer-events-auto w-full shrink-0 flex flex-col rounded-t-3xl border-l border-r border-t shadow-2xl overflow-hidden",
          maxH,
          dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200",
          className
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0 border-b",
            dark ? "border-slate-700" : "border-slate-100"
          )}
        >
          <h2
            id="playbook-sheet-title"
            className={cn("text-base font-semibold truncate pr-2", dark ? "text-slate-100" : "text-slate-900")}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              "p-2 rounded-full touch-manipulation shrink-0",
              dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-600"
            )}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3",
            footer ? "pb-3" : isFullscreen ? "pb-[calc(2rem+env(safe-area-inset-bottom,0px))]" : "pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
          )}
        >
          {children}
        </div>
        {footer != null && footer !== false && (
          <div
            className={cn(
              "shrink-0 border-t px-4",
              footerPad,
              dark ? "border-slate-700 bg-slate-950/95" : "border-slate-100 bg-slate-50"
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
