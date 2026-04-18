"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Full-viewport film workspace row: one-screen layout (no outer page scroll inside Film Room). */
export function FilmRoomShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden xl:flex-row xl:items-stretch xl:gap-3",
        className,
      )}
    >
      {children}
    </div>
  )
}
