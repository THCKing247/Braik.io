"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(min-width: 768px)"

/**
 * True when viewport is md breakpoint or wider (Tailwind md).
 * Server snapshot is false (mobile-first) so Coach B / layout match small screens on first paint.
 */
export function useMinWidthMd(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const m = window.matchMedia(QUERY)
      m.addEventListener("change", onStoreChange)
      return () => m.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
