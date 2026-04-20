"use client"

import { cn } from "@/lib/utils"
import { AppLoader } from "@/components/ui/app-loader"

export function LoadingState({
  label = "Loading",
  className,
  minHeightClassName = "min-h-[40vh]",
  size = "md",
}: {
  label?: string
  className?: string
  minHeightClassName?: string
  size?: "sm" | "md" | "lg"
}) {
  return (
    <div className={cn("flex items-center justify-center", minHeightClassName, className)} aria-busy="true">
      <AppLoader size={size} label={label} />
    </div>
  )
}

