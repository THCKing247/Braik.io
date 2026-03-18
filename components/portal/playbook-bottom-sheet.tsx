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
  variant = "light",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  className?: string
  /** Dark sheet for presenter / immersive modes */
  variant?: "light" | "dark"
}) {
  if (!open) return null
  const dark = variant === "dark"
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
          "rounded-t-2xl shadow-2xl border border-b-0 max-h-[min(85vh,600px)] flex flex-col",
          "pb-[max(1rem,env(safe-area-inset-bottom))] pt-2",
          dark
            ? "bg-slate-900 border-slate-700"
            : "bg-white border-slate-200",
          className
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-4 pb-2 shrink-0 border-b",
            dark ? "border-slate-700" : "border-slate-100"
          )}
        >
          <h2
            id="playbook-sheet-title"
            className={cn("text-base font-semibold truncate", dark ? "text-slate-100" : "text-slate-900")}
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
        <div className="overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-2 min-h-0">{children}</div>
      </div>
    </div>
  )
}
