"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const portalPageHeaderSurfaceClassName =
  "overflow-visible rounded-none border-0 bg-transparent shadow-none ring-0"

interface PortalPageHeaderSurfaceProps {
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function PortalPageHeaderSurface({
  children,
  className,
  contentClassName,
}: PortalPageHeaderSurfaceProps) {
  return (
    <section className={cn(portalPageHeaderSurfaceClassName, className)}>
      <div className={cn("px-4 py-4 sm:px-5 sm:py-5 md:px-6", contentClassName)}>{children}</div>
    </section>
  )
}
