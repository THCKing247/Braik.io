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
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col",
              className
            )}
          >
            {/* Sidebar + main: stack on mobile; row on md+. Schedule keeps nested scroll for calendar grid. */}
            <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overscroll-contain md:flex-row">
              <aside
                className={cn(
                  "flex w-full max-w-full shrink-0 flex-col overflow-hidden overscroll-contain",
                  "max-h-[40vh] shrink-0 border-b border-border bg-card md:max-h-none md:w-64 md:min-h-0 md:self-stretch md:border-b-0 md:border-r"
                )}
                style={{
                  background: "linear-gradient(180deg, #0B2A5B 0%, #0f172a 100%)",
                  boxShadow: "4px 0 24px rgba(0,0,0,0.08)",
                }}
                aria-label="Dashboard navigation"
              >
                <DashboardSidebar teams={teams} />
              </aside>

              <main
                className={cn(
                  "min-h-0 w-full min-w-0 flex-1 overscroll-contain touch-scroll scroll-smooth",
                  "p-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:p-6 md:pb-6",
                  isSchedulePage
                    ? "flex min-h-0 flex-col overflow-hidden"
                    : "overflow-x-hidden overflow-y-auto"
                )}
                style={{
                  backgroundColor: "rgb(var(--snow))",
                }}
              >
                <div
                  className={cn(
                    "w-full min-w-0 max-w-full min-h-0",
                    isSchedulePage
                      ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                      : "min-h-min"
                  )}
                >
                  <div
                    className={cn(
                      "min-w-0 w-full max-w-full rounded-none border-0 bg-transparent shadow-none",
                      "md:rounded-xl md:border-2 md:border-[#E5E7EB] md:bg-white md:p-6 md:shadow-sm",
                      isSchedulePage &&
                        "flex min-h-0 flex-1 flex-col overflow-hidden md:[scrollbar-gutter:stable]"
                    )}
                    aria-label="Page content"
                  >
                    <div
                      className={cn(
                        "min-w-0 w-full max-w-full",
                        isSchedulePage && "flex min-h-0 flex-1 flex-col"
                      )}
                    >
                      {children}
                    </div>
                  </div>
                </div>
              </main>
            </div>

            {isMdUp && (
              <div className="min-h-0 flex-shrink-0">
                <AIWidgetWrapper />
              </div>
            )}
            {!isMdUp && <AIWidgetWrapper />}
            {!isMdUp && <DashboardMobileTabBar />}
          </div>
        </PlaybookToastProvider>
      </CoachBProvider>
    </PortalTeamProvider>
  )
}
