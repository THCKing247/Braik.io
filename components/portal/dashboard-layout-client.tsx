"use client"

import { usePathname } from "next/navigation"
import { CoachBProvider } from "@/components/portal/coach-b-context"
import { PlaybookToastProvider } from "@/components/portal/playbook-toast"
import { PortalTeamProvider } from "@/components/portal/portal-team-context"
import { DashboardSidebar } from "@/components/portal/dashboard-sidebar"
import { QuickActionsSidebar } from "@/components/portal/quick-actions-sidebar"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { useIsMobileDevice } from "@/lib/hooks/use-is-mobile-device"
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
  currentTeamId,
  children,
  className,
}: {
  teams: Team[]
  currentTeamId?: string
  children: React.ReactNode
  className?: string
}) {
  const isMobileDevice = useIsMobileDevice()
  const isDesktop = !isMobileDevice
  const pathname = usePathname()
  const isSchedulePage = pathname?.includes("/dashboard/schedule") ?? false
  const teamIds = teams.map((t) => t.id)
  const resolvedCurrentTeamId = currentTeamId ?? teams[0]?.id ?? ""

  return (
    <PortalTeamProvider teamIds={teamIds} currentTeamId={resolvedCurrentTeamId}>
    <CoachBProvider isDesktop={isDesktop}>
      <PlaybookToastProvider>
      <div
        className={cn("flex flex-col min-w-0 min-h-0 overflow-hidden", className)}
        style={{ height: `calc(100vh - ${HEADER_HEIGHT_PX}px)` }}
      >
        {/* One horizontal row: sidebar + main; height is viewport-based so sidebar stays consistent */}
        <div className="flex flex-1 min-h-0 min-w-0">
          {isDesktop && (
            <DashboardSidebar teams={teams} />
          )}
          {!isDesktop && <QuickActionsSidebar />}
          {/* On schedule: main must NOT scroll (overflow-hidden) so only the time grid scrolls. */}
          <main
            className={cn(
              "flex-1 min-w-0 min-h-0",
              isSchedulePage
                ? "overflow-hidden flex flex-col"
                : "overflow-auto",
              !isDesktop && "app-content"
            )}
            style={{
              backgroundColor: "rgb(var(--snow))",
              paddingLeft: isDesktop ? SIDEBAR_GAP : undefined,
            }}
          >
            {/* Schedule: flex chain so only time grid scrolls. Other pages: scrollable area. */}
            <div
              className={cn(
                "min-h-0 flex flex-col px-4 py-4",
                isSchedulePage ? "flex-1" : "flex-1"
              )}
            >
              <div
                className={cn(
                  "min-w-0 rounded-lg border-2 border-[#E5E7EB] bg-white shadow-sm",
                  isSchedulePage
                    ? "flex-1 min-h-0 overflow-hidden flex flex-col [scrollbar-gutter:stable]"
                    : "flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                )}
                aria-label="Page content"
              >
                <div className={cn("p-6", isSchedulePage && "flex-1 min-h-0 flex flex-col")}>
                  {children}
                </div>
              </div>
            </div>
          </main>
        </div>
        {/* Widget slot for desktop: min-h-0 so flex chain does not block modal's internal scroll */}
        {isDesktop && (
          <div className="min-h-0 flex-shrink-0">
            <AIWidgetWrapper />
          </div>
        )}
        {/* Widget for mobile: rendered but uses fixed positioning, so doesn't affect layout */}
        {!isDesktop && <AIWidgetWrapper />}
      </div>
      </PlaybookToastProvider>
    </CoachBProvider>
    </PortalTeamProvider>
  )
}
