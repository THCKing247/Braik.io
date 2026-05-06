"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import { useAppBootstrapUnreadOptional } from "@/components/portal/app-bootstrap-context"

export type DashboardNotificationUnreadBadgeVariant = "sidebar" | "mobile-tab"

/**
 * Isolated unread pill: only this subtree subscribes to `AppBootstrapUnreadContext`,
 * so sidebar / tab bar shells do not rerender when counts change.
 */
export const DashboardNotificationUnreadBadge = memo(function DashboardNotificationUnreadBadge({
  variant,
  className,
}: {
  variant: DashboardNotificationUnreadBadgeVariant
  className?: string
}) {
  const unread = useAppBootstrapUnreadOptional()
  const count = unread?.effectiveUnreadNotifications ?? 0
  if (count <= 0) return null

  const display = Math.min(count, 99)
  const label = `${display} unread notifications`

  if (variant === "mobile-tab") {
    return (
      <span
        className={cn(
          "absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold text-white",
          className
        )}
        aria-label={label}
      >
        {count > 9 ? "9+" : count}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "ml-1 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white",
        className
      )}
      aria-label={label}
    >
      {count > 9 ? "9+" : count}
    </span>
  )
})
