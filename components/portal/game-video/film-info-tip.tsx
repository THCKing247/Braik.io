"use client"

import type { ReactNode } from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Compact info trigger for Film Room — content shows on hover and keyboard focus (Radix Tooltip). */
export function FilmInfoTip({
  label,
  children,
  className,
  side = "top",
}: {
  label: string
  children: ReactNode
  className?: string
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <Tooltip delayDuration={280}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
          aria-label={label}
        >
          <Info className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-[min(22rem,calc(100vw-2rem))] space-y-1.5 border-border/80 bg-popover px-3 py-2.5 text-xs leading-snug text-popover-foreground shadow-xl"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  )
}
