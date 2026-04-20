"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const portalPageHeaderSurfaceClassName =
  "overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:shadow-sm md:ring-0"

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
