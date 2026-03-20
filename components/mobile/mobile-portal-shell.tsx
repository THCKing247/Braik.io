"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Centers portal content on phone (max 480px) with 16px horizontal inset.
 * Use below lg only; desktop passes through full width (lg: resets).
 */
export function MobilePortalShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 max-w-[min(100%,var(--mobile-shell-max-width))] px-[var(--mobile-shell-pad-x)] lg:max-w-none lg:px-0",
        className
      )}
    >
      {children}
    </div>
  )
}
