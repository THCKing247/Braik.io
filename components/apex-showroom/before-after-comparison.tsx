"use client"

import Image from "next/image"
import { GripVertical } from "lucide-react"
import { useCallback, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"

import { cn } from "@/lib/utils"

export type BeforeAfterComparisonProps = {
  beforeSrc: string
  afterSrc: string
  beforeLabel?: string
  afterLabel?: string
  beforeAlt?: string
  afterAlt?: string
  className?: string
  /** Outer frame, e.g. aspect-[16/10] rounded-2xl */
  frameClassName?: string
}

/**
 * Premium before/after: pointer + touch via setPointerCapture, aligned clip, no layout jump.
 */
export function BeforeAfterComparison({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
  beforeAlt = "",
  afterAlt = "",
  className,
  frameClassName,
}: BeforeAfterComparisonProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef(50)
  const [pct, setPct] = useState(50)
  const labelId = useId()

  const commit = useCallback((next: number) => {
    const v = Math.min(100, Math.max(0, next))
    liveRef.current = v
    setPct(v)
  }, [])

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = wrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return
      const x = clientX - rect.left
      commit((x / rect.width) * 100)
    },
    [commit],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromClientX(e.clientX)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.preventDefault()
    updateFromClientX(e.clientX)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === "ArrowLeft" || e.key === "Home") {
      e.preventDefault()
      commit(e.key === "Home" ? 0 : liveRef.current - step)
    } else if (e.key === "ArrowRight" || e.key === "End") {
      e.preventDefault()
      commit(e.key === "End" ? 100 : liveRef.current + step)
    }
  }

  const clipRight = `${100 - pct}%`

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={wrapRef}
        tabIndex={0}
        role="slider"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${Math.round(pct)} percent — ${beforeLabel} left, ${afterLabel} right`}
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl bg-slate-950 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.85)] outline-none ring-offset-2 ring-offset-slate-950 focus-visible:ring-2 focus-visible:ring-sky-400",
          "touch-none select-none",
          frameClassName ?? "aspect-[16/10] max-h-[min(72vh,560px)]",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span id={labelId} className="sr-only">
          Drag to compare {beforeLabel} and {afterLabel}. Use arrow keys to move the divider.
        </span>

        {/* Base: "After" full-bleed (right side revealed as divider moves) */}
        <Image
          src={afterSrc}
          alt={afterAlt}
          fill
          sizes="(max-width: 768px) 100vw, min(1150px, 92vw)"
          className="pointer-events-none object-cover"
          draggable={false}
          priority
        />

        {/* Top: "Before" — clipped from the right */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] will-change-[clip-path]"
          style={{
            clipPath: `inset(0 ${clipRight} 0 0)`,
          }}
        >
          <Image
            src={beforeSrc}
            alt={beforeAlt}
            fill
            sizes="(max-width: 768px) 100vw, min(1150px, 92vw)"
            className="object-cover"
            draggable={false}
          />
        </div>

        {/* Labels */}
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-start justify-between p-3 sm:p-4">
          <span className="rounded-full border border-white/25 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm sm:px-3 sm:text-[11px]">
            {beforeLabel}
          </span>
          <span className="rounded-full border border-white/25 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm sm:px-3 sm:text-[11px]">
            {afterLabel}
          </span>
        </div>

        {/* Divider + handle */}
        <div
          className="pointer-events-none absolute inset-y-0 z-[3] w-px bg-white shadow-[0_0_20px_rgba(0,0,0,0.35)]"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
          aria-hidden
        />
        <div
          className="absolute inset-y-0 z-[4] flex w-10 cursor-ew-resize items-center justify-center sm:w-12"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
          aria-hidden
        >
          <div className="flex h-14 w-9 flex-col items-center justify-center rounded-full border-2 border-white bg-slate-950/95 text-white shadow-lg ring-4 ring-black/25 transition-transform group-active:scale-105 sm:h-16 sm:w-10">
            <GripVertical className="h-6 w-6 opacity-95" strokeWidth={2} aria-hidden />
          </div>
        </div>
      </div>

      <p className="mt-2 flex items-center justify-center gap-2 text-center text-[11px] font-medium text-slate-500 sm:text-xs">
        <span className="hidden sm:inline">Drag the handle or swipe —</span>
        <span className="sm:hidden">Drag to compare —</span>
        <kbd className="rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
          ←
        </kbd>
        <kbd className="rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
          →
        </kbd>
        <span className="text-slate-600">when focused</span>
      </p>
    </div>
  )
}
