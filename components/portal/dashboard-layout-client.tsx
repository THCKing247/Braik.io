"use client"

import { useState, useEffect } from "react"
import { CoachBProvider } from "@/components/portal/coach-b-context"
import { DashboardSidebar } from "@/components/portal/dashboard-sidebar"
import { QuickActionsSidebar } from "@/components/portal/quick-actions-sidebar"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { cn } from "@/lib/utils"

const SIDEBAR_GAP = 24
const HEADER_HEIGHT_PX = 54

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
  className,
}: {
  teams: Team[]
  children: React.ReactNode
  className?: string
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
      <div
        className={cn("flex flex-col min-w-0 overflow-hidden", className)}
        style={{ height: `calc(100vh - ${HEADER_HEIGHT_PX}px)` }}
      >
        {/* One horizontal row: sidebar + main; height is viewport-based so sidebar stays consistent */}
        <div className="flex flex-1 min-h-0 min-w-0">
          {isDesktop && (
            <DashboardSidebar teams={teams} />
          )}
          {!isDesktop && <QuickActionsSidebar />}
          <main
            className={cn(
              "flex-1 min-w-0 overflow-auto",
              !isDesktop && "app-content"
            )}
            style={{
              backgroundColor: "rgb(var(--snow))",
              paddingLeft: isDesktop ? SIDEBAR_GAP : undefined,
            }}
          >
            {children}
          </main>
        </div>
        <AIWidgetWrapper />
      </div>
    </CoachBProvider>
  )
}
