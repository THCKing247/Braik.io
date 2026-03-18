"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { DashboardMobileDrawer } from "@/components/portal/dashboard-mobile-drawer"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

type MobileNavContextValue = {
  openDrawer: () => void
  closeDrawer: () => void
  drawerOpen: boolean
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null)

export function useMobileDashboardNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext)
  if (!ctx) {
    return {
      openDrawer: () => {},
      closeDrawer: () => {},
      drawerOpen: false,
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const value = useMemo(
    () => ({ openDrawer, closeDrawer, drawerOpen }),
    [openDrawer, closeDrawer, drawerOpen]
  )

  return (
    <MobileNavContext.Provider value={value}>
      {children}
      <DashboardMobileDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        teams={teams}
        showAdminLink={showAdminLink}
      />
    </MobileNavContext.Provider>
  )
}
