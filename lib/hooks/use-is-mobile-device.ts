"use client"

import { useState, useEffect } from "react"

/**
 * Returns true only for actual mobile/touch-first devices, not for desktop
 * browsers with a narrow window. Uses device capability media queries so that
 * desktop keeps the full sidebar even when the viewport is resized small.
 *
 * Logic: mobile if (pointer: coarse) OR (hover: none AND width < 1024px).
 * Desktop otherwise (fine pointer and/or hover available, or wide enough).
 */
export function useIsMobileDevice(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)")
    const hoverNone = window.matchMedia("(hover: none)")
    const narrow = window.matchMedia("(max-width: 1023px)")

    const update = () => {
      const coarse = coarsePointer.matches
      const noHover = hoverNone.matches
      const isNarrow = narrow.matches
      setIsMobile(coarse || (noHover && isNarrow))
    }

    update()
    coarsePointer.addEventListener("change", update)
    hoverNone.addEventListener("change", update)
    narrow.addEventListener("change", update)
    return () => {
      coarsePointer.removeEventListener("change", update)
      hoverNone.removeEventListener("change", update)
      narrow.removeEventListener("change", update)
    }
  }, [])

  return isMobile
}
