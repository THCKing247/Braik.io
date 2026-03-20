"use client"

import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

const fabBase =
  "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 lg:hidden touch-manipulation"

/**
 * Floating action button: 56px, bottom-right, clears the mobile tab bar + safe area.
 * Pass `immersive` when the tab bar is hidden (e.g. play editor).
 */
export function MobileFab({
  className,
  style,
  immersive,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { immersive?: boolean }) {
  return (
    <button
      type="button"
      className={cn(fabBase, className)}
      style={{
        bottom: immersive
          ? "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))"
          : "var(--mobile-fab-bottom)",
        right: "max(1rem, env(safe-area-inset-right, 0px))",
        ...style,
      }}
      {...props}
    />
  )
}
