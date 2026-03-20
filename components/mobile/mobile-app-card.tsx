"use client"

import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

/** Raised card for mobile-first lists and panels; desktop keeps subtle shadow. */
export function MobileAppCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-4 shadow-[0_2px_14px_rgba(0,0,0,0.07)] lg:rounded-xl lg:shadow-sm",
        className
      )}
      {...props}
    />
  )
}
