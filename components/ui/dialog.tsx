"use client"

import * as React from "react"
import { useEffect } from "react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps {
  className?: string
  children: React.ReactNode
  /** When false, hides the bottom-sheet drag pill (use for full-height centered panels). Default true. */
  showMobileSheetHandle?: boolean
}

interface DialogHeaderProps {
  className?: string
  children: React.ReactNode
}

interface DialogTitleProps {
  className?: string
  children: React.ReactNode
}

interface DialogDescriptionProps {
  className?: string
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[999] bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      {children}
    </>
  )
}

export function DialogContent({ className, children, showMobileSheetHandle = true }: DialogContentProps) {
  return (
    <div
      className={cn(
        /* position: fixed; top/left 50%; transform: translate(-50%,-50%); z-index: 1000 */
        "fixed left-1/2 top-1/2 z-[1000] w-[calc(100%-2rem)] max-w-[500px] -translate-x-1/2 -translate-y-1/2",
        "min-h-0 max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl",
        "pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:p-6",
        /** Consumers may override width/max-width for wide modals via `className`. */
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {showMobileSheetHandle ? (
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted md:hidden" aria-hidden />
      ) : null}
      {children}
    </div>
  )
}

export function DialogHeader({ className, children }: DialogHeaderProps) {
  return <div className={cn("mb-4", className)}>{children}</div>
}

export function DialogTitle({ className, children }: DialogTitleProps) {
  return (
    <h2 className={cn("text-xl font-semibold", className)} style={{ color: "rgb(var(--text))" }}>
      {children}
    </h2>
  )
}

export function DialogDescription({ className, children }: DialogDescriptionProps) {
  return (
    <p className={cn("text-sm mt-1", className)} style={{ color: "rgb(var(--muted))" }}>
      {children}
    </p>
  )
}

interface DialogFooterProps {
  className?: string
  children: React.ReactNode
}

export function DialogFooter({ className, children }: DialogFooterProps) {
  return (
    <div className={cn("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2", className)}>
      {children}
    </div>
  )
}
