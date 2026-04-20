"use client"

import { cn } from "@/lib/utils"

const SEGMENTS = [
  { x: 58.25, y: 12.75, a: 30 },
  { x: 74.75, y: 22.25, a: 30 },
  { x: 83.25, y: 36.5, a: 90 },
  { x: 83.25, y: 55.5, a: 90 },
  { x: 74.75, y: 69.75, a: 150 },
  { x: 58.25, y: 79.25, a: 150 },
  { x: 41.75, y: 79.25, a: 210 },
  { x: 25.25, y: 69.75, a: 210 },
  { x: 16.75, y: 55.5, a: 270 },
  { x: 16.75, y: 36.5, a: 270 },
  { x: 25.25, y: 22.25, a: 330 },
  { x: 41.75, y: 12.75, a: 330 },
] as const

export function AppLoader({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: "sm" | "md" | "lg"
  className?: string
  label?: string
}) {
  const sizeClass = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-12 w-12" : "h-8 w-8"
  return (
    <span className={cn("inline-flex items-center justify-center text-neutral-900", sizeClass, className)} role="status" aria-label={label}>
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" focusable="false">
        {SEGMENTS.map((segment, i) => (
          <g
            key={i}
            transform={`translate(${segment.x} ${segment.y}) rotate(${segment.a})`}
            className={cn("app-loader-segment", i === 0 ? "motion-reduce:opacity-95" : "motion-reduce:opacity-20")}
            style={{
              animationDelay: `${(-1.4 / 12) * i}s`,
            }}
          >
            <rect x={-7} y={-2.3} width={14} height={4.6} rx={2.3} fill="currentColor" />
          </g>
        ))}
      </svg>
    </span>
  )
}

