"use client"

import { usePathname } from "next/navigation"
import { CoachBProvider } from "@/components/portal/coach-b-context"
import { PlaybookToastProvider } from "@/components/portal/playbook-toast"
import { PortalTeamProvider } from "@/components/portal/portal-team-context"
import { DashboardSidebar } from "@/components/portal/dashboard-sidebar"
import { DashboardMobileTabBar } from "@/components/portal/dashboard-mobile-tab-bar"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { useMinWidthMd } from "@/lib/hooks/use-min-width-md"
import { cn } from "@/lib/utils"

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
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
        {/* One horizontal row: sidebar + main; height is viewport-based so sidebar stays consistent */}
        <div className="flex w-full min-w-0 max-w-full flex-1">
          <div className="hidden h-full min-h-0 shrink-0 md:flex">
            <DashboardSidebar teams={teams} />
          </div>
          {/* On schedule: main must NOT scroll (overflow-hidden) so only the time grid scrolls. */}
          <main
            className={cn(
              "w-full min-w-0 flex-1 min-h-0",
              isSchedulePage
                ? "flex flex-col overflow-hidden"
                : cn(
                    "overflow-x-hidden overflow-y-auto overscroll-y-contain",
                    "md:flex md:flex-col md:overflow-hidden"
                  ),
              "pl-0 md:pl-6",
              "max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
            )}
            style={{
              backgroundColor: "rgb(var(--snow))",
            }}
          >
            <div
              className={cn(
                "w-full min-w-0 max-w-full flex-1 flex flex-col min-h-0",
                "px-3 py-3 sm:px-4 md:min-h-0 md:px-6 md:py-4"
              )}
            >
              {/* Desktop: bordered card shell. Mobile: full-bleed snow canvas */}
              <div
                className={cn(
                  "min-w-0 w-full max-w-full min-h-0",
                  "md:rounded-xl md:border-2 md:border-[#E5E7EB] md:bg-white md:shadow-sm",
                  isSchedulePage
                    ? "flex flex-1 flex-col overflow-hidden md:[scrollbar-gutter:stable]"
                    : cn(
                        "md:flex md:flex-1 md:flex-col md:overflow-y-auto md:[scrollbar-gutter:stable]",
                        "md:[&::-webkit-scrollbar]:hidden md:[-ms-overflow-style:none] md:[scrollbar-width:none]"
                      )
                )}
                aria-label="Page content"
              >
                <div
                  className={cn(
                    "min-w-0 w-full max-w-full",
                    "md:p-6",
                    isSchedulePage && "flex min-h-0 flex-1 flex-col"
                  )}
                >
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
        {!isMdUp && <DashboardMobileTabBar />}
      </div>
      </PlaybookToastProvider>
    </CoachBProvider>
    </PortalTeamProvider>
  )
}
