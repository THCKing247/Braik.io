"use client"

import React from "react"

type CoachBContextValue = {
  open: () => void
  registerOpen: (fn: () => void) => void
  isDesktop: boolean
}

const CoachBContext = React.createContext<CoachBContextValue | null>(null)

export function useCoachB(): CoachBContextValue | null {
  return React.useContext(CoachBContext)
}

export function CoachBProvider({
  children,
  isDesktop,
}: {
  children: React.ReactNode
  isDesktop: boolean
}) {
  const openRef = React.useRef<(() => void) | null>(null) as React.MutableRefObject<(() => void) | null>

  const value: CoachBContextValue = React.useMemo(
    () => ({
      open: () => openRef.current?.(),
      registerOpen: (fn) => {
        openRef.current = fn
      },
      isDesktop,
    }),
    [isDesktop]
  )

  return <CoachBContext.Provider value={value}>{children}</CoachBContext.Provider>
}
