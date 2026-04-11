"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"

const VARIANTS = {
  /** White surfaces (cards, dropdowns light mode) */
  light: {
    top: "bg-gradient-to-b from-white to-transparent",
    bottom: "bg-gradient-to-t from-white to-transparent",
  },
  /** Dashboard main column (#f9fafb) */
  muted: {
    top: "bg-gradient-to-b from-[#f9fafb] to-transparent",
    bottom: "bg-gradient-to-t from-[#f9fafb] to-transparent",
  },
  /** Dark sidebar / slate panels */
  dark: {
    top: "bg-gradient-to-b from-[#0f172a] to-transparent",
    bottom: "bg-gradient-to-t from-[#0f172a] to-transparent",
  },
  /** Notifications-style: white + dark mode gray */
  panel: {
    top: "bg-gradient-to-b from-white to-transparent dark:from-gray-800",
    bottom: "bg-gradient-to-t from-white to-transparent dark:from-gray-800",
  },
} as const

export type ScrollFadeVariant = keyof typeof VARIANTS

type ScrollFadeContainerProps = {
  children: ReactNode
  variant?: ScrollFadeVariant
  /** Outer wrapper (relative) */
  className?: string
  /** Inner scrollable element */
  scrollClassName?: string
  /** Fade strip height */
  fadeHeight?: string
  /** Hide fades at scroll extents (recommended) */
  smart?: boolean
}

/**
 * Scroll area with subtle top/bottom gradient fades (scrollbars stay hidden globally).
 * Fades use pointer-events-none and optional smart visibility at scroll edges.
 */
export function ScrollFadeContainer({
  children,
  variant = "light",
  className,
  scrollClassName,
  fadeHeight = "h-6",
  smart = true,
}: ScrollFadeContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showTop, setShowTop] = useState(false)
  const [showBottom, setShowBottom] = useState(false)

  const updateFades = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const scrollable = scrollHeight > clientHeight + 2
    if (!scrollable) {
      setShowTop(false)
      setShowBottom(false)
      return
    }
    setShowTop(scrollTop > 2)
    setShowBottom(scrollTop + clientHeight < scrollHeight - 2)
  }, [])

  useLayoutEffect(() => {
    updateFades()
  }, [updateFades, children])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updateFades())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateFades])

  const fade = VARIANTS[variant]

  return (
    <div className={cn("relative min-h-0 overflow-hidden", className)}>
      <div
        ref={scrollRef}
        onScroll={smart ? updateFades : undefined}
        className={cn("min-h-0", scrollClassName)}
      >
        {children}
      </div>
      {(!smart || showTop) && (
        <div
          className={cn(
            "pointer-events-none absolute left-0 right-0 top-0 z-10",
            fadeHeight,
            fade.top
          )}
          aria-hidden
        />
      )}
      {(!smart || showBottom) && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-0 left-0 right-0 z-10",
            fadeHeight,
            fade.bottom
          )}
          aria-hidden
        />
      )}
    </div>
  )
}
