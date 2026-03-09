"use client"

import { useState, useEffect } from "react"
import { CoachBProvider } from "@/components/portal/coach-b-context"
import { DashboardSidebar, DASHBOARD_SIDEBAR_WIDTH } from "@/components/portal/dashboard-sidebar"
import { QuickActionsSidebar } from "@/components/portal/quick-actions-sidebar"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"

const SIDEBAR_GAP = 24

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

export function DashboardLayoutClient({
  teams,
  children,
}: {
  teams: Team[]
  children: React.ReactNode
}) {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const handler = () => setIsDesktop(mq.matches)
    handler()
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <CoachBProvider isDesktop={isDesktop}>
      {isDesktop ? (
        <DashboardSidebar teams={teams} />
      ) : (
        <QuickActionsSidebar />
      )}
      <main
        className="app-content"
        style={{
          backgroundColor: "rgb(var(--snow))",
          paddingLeft: isDesktop
            ? `${DASHBOARD_SIDEBAR_WIDTH + SIDEBAR_GAP}px`
            : undefined,
        }}
      >
        {children}
      </main>
      <AIWidgetWrapper />
    </CoachBProvider>
  )
}
