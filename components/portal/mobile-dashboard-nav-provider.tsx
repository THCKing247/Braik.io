"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { AdPortalLinkProvider } from "@/components/portal/ad-portal-link-context"
import { DashboardMoreBottomSheet } from "@/components/portal/dashboard-more-bottom-sheet"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

type MobileNavContextValue = {
  openMoreSheet: () => void
  closeMoreSheet: () => void
  moreSheetOpen: boolean
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

export function useMobileDashboardNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext)
  if (!ctx) {
    return {
      openMoreSheet: () => {},
      closeMoreSheet: () => {},
      moreSheetOpen: false,
    }
  }
  return ctx
}

export function MobileDashboardNavProvider({
  teams,
  showAdminLink,
  children,
}: {
  teams: Team[]
  showAdminLink?: boolean
  children: ReactNode
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const openMoreSheet = useCallback(() => setMoreOpen(true), [])
  const closeMoreSheet = useCallback(() => setMoreOpen(false), [])
  const value = useMemo(
    () => ({ openMoreSheet, closeMoreSheet, moreSheetOpen: moreOpen }),
    [openMoreSheet, closeMoreSheet, moreOpen]
  )

  return (
    <MobileNavContext.Provider value={value}>
      {/* Dedupes AD portal eligibility fetch for header + any future consumers */}
      <AdPortalLinkProvider>{children}</AdPortalLinkProvider>
      <DashboardMoreBottomSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        teams={teams}
        showAdminLink={showAdminLink}
      />
    </MobileNavContext.Provider>
  )
}
