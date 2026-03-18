"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MobileBottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** Optional subtitle or slot info below title */
  subtitle?: React.ReactNode
  /** Extra class for the sheet panel */
  className?: string
}

export function MobileBottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  className = "",
}: MobileBottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onEscape)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onEscape)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="mobile-sheet-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[90vh] flex-col rounded-t-3xl bg-background shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border px-4 pt-3 pb-3">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/25" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="mobile-sheet-title" className="text-lg font-semibold text-foreground">
                {title}
              </h2>
              {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
