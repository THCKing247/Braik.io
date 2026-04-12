"use client"

import * as React from "react"
import { useEffect } from "react"
import { X } from "lucide-react"
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
    <div
      className={cn(
        "fixed inset-0 z-50 grid min-h-0 grid-cols-1 grid-rows-1 overflow-hidden bg-black/50",
        "p-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-4 pr-4",
        "sm:p-6 sm:pt-[max(1.5rem,env(safe-area-inset-top,0px))] sm:pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
      )}
      onClick={() => onOpenChange(false)}
    >
      {/*
        One grid cell fills the padded viewport. The shell uses max-h-full so panels never exceed
        the visible frame; self-end = bottom sheet on phones, sm:self-center = true center on larger.
      */}
      <div
        className="col-start-1 row-start-1 min-h-0 w-full max-h-full max-w-full justify-self-center self-end overflow-x-hidden sm:self-center"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogContent({ className, children, showMobileSheetHandle = true }: DialogContentProps) {
  return (
    <div
      className={cn(
        /* max-h-full: stay inside padded overlay grid; min-h-0: allow inner flex children to shrink */
        "min-h-0 w-full max-w-none rounded-t-3xl border border-border bg-card p-4 shadow-2xl max-h-full overflow-y-auto",
        "pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:mx-0 md:max-w-lg md:rounded-2xl md:p-6",
        /** Consumers (e.g. wide stat forms) may override `md:max-w-*` and flex layout via `className`. */
        className
      )}
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
