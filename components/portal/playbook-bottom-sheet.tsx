"use client"

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Bottom sheet: rounded top, slide-up, safe-area padding — mobile only (lg:hidden root).
 */
export function PlaybookBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  variant = "light",
  isFullscreen = false,
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
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  const dark = variant === "dark"
  const maxH = isFullscreen ? "max-h-[60vh]" : "max-h-[70vh]"
  const footerPad = isFullscreen
    ? "pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3"
    : "pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3"

  useLayoutEffect(() => {
    if (open) setMounted(true)
    else setVisible(false)
  }, [open])

  useEffect(() => {
    if (!open) {
      const id = window.setTimeout(() => setMounted(false), 320)
      return () => clearTimeout(id)
    }
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [open])

  useEffect(() => {
    if (!mounted || !visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted, visible])

  if (!mounted) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col justify-end items-stretch lg:hidden",
        visible ? "pointer-events-auto" : "pointer-events-none"
      )}
      role="presentation"
    >
      <button
        type="button"
        className={cn(
          "min-h-[28vh] flex-1 w-full shrink border-0 transition-opacity duration-300 ease-out",
          dark ? "bg-black/50" : "bg-black/40",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-label="Close"
        onClick={close}
      />
      <div
        className={cn(
          "pointer-events-auto w-full shrink-0 flex flex-col rounded-t-2xl border-l border-r border-t shadow-2xl overflow-hidden transition-transform duration-300 ease-out",
          maxH,
          visible ? "translate-y-0" : "translate-y-full",
          dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playbook-sheet-title"
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2 pb-1 active:cursor-grabbing"
          onTouchStart={(e) => {
            dragStartY.current = e.touches[0].clientY
          }}
          onTouchEnd={(e) => {
            if (dragStartY.current === null) return
            const dy = e.changedTouches[0].clientY - dragStartY.current
            dragStartY.current = null
            if (dy > 48) close()
          }}
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-4 pt-1 pb-2 shrink-0 border-b",
            dark ? "border-slate-700" : "border-slate-100"
          )}
        >
          <h2
            id="playbook-sheet-title"
            className={cn(
              "truncate pr-2 font-sans text-lg font-semibold tracking-tight",
              dark ? "text-slate-100" : "text-slate-900"
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            className={cn(
              "p-2 rounded-full touch-manipulation shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center",
              dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-600"
            )}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 touch-scroll",
            footer ? "pb-3" : isFullscreen ? "pb-[calc(2rem+env(safe-area-inset-bottom,0px))]" : "pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
          )}
          style={{ WebkitOverflowScrolling: "touch" }}
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
