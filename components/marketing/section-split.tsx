import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Responsive 2-column grid for marketing split layouts (stacks on small screens). */
export function SectionSplit({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12", className)}
    >
      {children}
    </div>
  )
}
