"use client"

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Thin scrollbars (matches All Stats / weekly stats tables) — discoverable without dominating the UI. */
export const SCROLLABLE_LIST_THIN_SCROLLBAR =
  "[scrollbar-color:rgb(203_213_225)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/90 [&::-webkit-scrollbar-track]:bg-transparent"

type ScrollableListContainerProps = {
  children: ReactNode
  /** Outer wrapper (e.g. spacing). */
  className?: string
  /** Classes merged onto the scrollable element. */
  scrollClassName?: string
  /** Max height; default matches long unpaginated lists. Ignored when `naturalHeight` is true. */
  maxHeightClassName?: string
  /**
   * Grow with content vertically (no max-height / inner vertical scroll).
   * Use with paginated tables so the card fits the current page of rows.
   */
  naturalHeight?: boolean
  /**
   * Renders below the scroll region but outside it (e.g. pagination).
   * Avoids pinning controls to the bottom of a tall overflow box or leaving dead space above them.
   */
  footer?: ReactNode
  showBackToTop?: boolean
  backToTopThreshold?: number
  backToTopAriaLabel?: string
  /** When list data changes, recalc scroll affordances (back-to-top visibility). */
  contentKey?: string | number
}

export function ScrollableListContainer({
  children,
  className,
  scrollClassName,
  maxHeightClassName = "max-h-[min(480px,55vh)]",
  naturalHeight = false,
  footer,
  showBackToTop = true,
  backToTopThreshold = 72,
  backToTopAriaLabel = "Back to top of list",
  contentKey,
}: ScrollableListContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showTopBtn, setShowTopBtn] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const scrollable = scrollHeight > clientHeight + 2
    setShowTopBtn(Boolean(showBackToTop && scrollable && scrollTop > backToTopThreshold))
  }, [backToTopThreshold, showBackToTop])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateScrollState, contentKey])

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const scrollVerticalClasses = naturalHeight
    ? "overflow-x-auto overflow-y-visible overscroll-x-contain"
    : "overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"

  const scrollBox = (
    <div
      ref={scrollRef}
      onScroll={updateScrollState}
      className={cn(
        "relative",
        scrollVerticalClasses,
        !naturalHeight && maxHeightClassName,
        !footer && "rounded-lg border border-border bg-card shadow-sm",
        SCROLLABLE_LIST_THIN_SCROLLBAR,
        scrollClassName
      )}
    >
      {children}
      {showBackToTop && showTopBtn && (
        <Button
          type="button"
          variant="secondary"
          className="pointer-events-auto absolute bottom-2 right-2 z-10 h-8 w-8 min-h-8 min-w-8 rounded-full border border-[#E2E8F0] bg-[#F8FAFC]/95 p-0 shadow-md backdrop-blur-sm hover:bg-[#F1F5F9]"
          onClick={scrollToTop}
          aria-label={backToTopAriaLabel}
        >
          <ChevronUp className="h-4 w-4 text-[#334155]" aria-hidden />
        </Button>
      )}
    </div>
  )

  return (
    <div className={cn(className)}>
      {footer ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {scrollBox}
          {footer}
        </div>
      ) : (
        scrollBox
      )}
    </div>
  )
}
