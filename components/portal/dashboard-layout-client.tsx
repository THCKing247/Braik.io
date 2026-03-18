"use client"

import { usePathname } from "next/navigation"
import { CoachBProvider } from "@/components/portal/coach-b-context"
import { PlaybookToastProvider } from "@/components/portal/playbook-toast"
import { PortalTeamProvider } from "@/components/portal/portal-team-context"
import { DashboardSidebar } from "@/components/portal/dashboard-sidebar"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { useMinWidthMd } from "@/lib/hooks/use-min-width-md"
import { cn } from "@/lib/utils"

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
  const isMdUp = useMinWidthMd()
  const pathname = usePathname()
  const isSchedulePage = pathname?.includes("/dashboard/schedule") ?? false
  const teamIds = teams.map((t) => t.id)
  const resolvedCurrentTeamId = currentTeamId ?? teams[0]?.id ?? ""

  return (
    <PortalTeamProvider teamIds={teamIds} currentTeamId={resolvedCurrentTeamId}>
    <CoachBProvider isDesktop={isMdUp}>
      <PlaybookToastProvider>
      <div
        className={cn("flex flex-col min-w-0 min-h-0 overflow-hidden", className)}
        style={{ height: `calc(100vh - ${HEADER_HEIGHT_PX}px)` }}
      >
        {/* One horizontal row: sidebar + main; height is viewport-based so sidebar stays consistent */}
        <div className="flex w-full min-w-0 max-w-full flex-1">
          <div className="hidden h-full min-h-0 shrink-0 md:flex">
            <DashboardSidebar teams={teams} />
          </div>
          {/* On schedule: main must NOT scroll (overflow-hidden) so only the time grid scrolls. */}
          <main
            className={cn(
              "w-full min-w-0 flex-1",
              isSchedulePage
                ? "flex min-h-0 flex-col overflow-hidden"
                : "min-h-0 overflow-x-hidden overflow-y-auto",
              "pl-0 md:pl-6"
            )}
            style={{
              backgroundColor: "rgb(var(--snow))",
            }}
          >
            {/* Schedule: flex chain so only time grid scrolls. Other pages: scrollable area. */}
            <div
              className={cn(
                "flex min-h-0 w-full min-w-0 max-w-full flex-col px-3 py-3 md:px-6 md:py-4",
                isSchedulePage ? "flex-1" : "flex-1"
              )}
            >
              <div
                className={cn(
                  "min-w-0 w-full max-w-full rounded-lg border-2 border-[#E5E7EB] bg-white shadow-sm",
                  isSchedulePage
                    ? "flex-1 min-h-0 overflow-hidden flex flex-col [scrollbar-gutter:stable]"
                    : "flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                )}
                aria-label="Page content"
              >
                <div className={cn("min-w-0 p-3 md:p-6", isSchedulePage && "flex-1 min-h-0 flex flex-col")}>
                  {children}
                </div>
              </div>
            </div>
          </main>
        </div>
        {/* Widget slot for md+: min-h-0 so flex chain does not block modal's internal scroll */}
        {isMdUp && (
          <div className="min-h-0 flex-shrink-0">
            <AIWidgetWrapper />
          </div>
        )}
        {/* Below md: fixed-position floating Coach B */}
        {!isMdUp && <AIWidgetWrapper />}
      </div>
      </PlaybookToastProvider>
    </CoachBProvider>
    </PortalTeamProvider>
  )
}
