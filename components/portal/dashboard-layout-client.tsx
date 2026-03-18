"use client"

import { usePathname } from "next/navigation"
import { CoachBProvider } from "@/components/portal/coach-b-context"
import { PlaybookToastProvider } from "@/components/portal/playbook-toast"
import { PortalTeamProvider } from "@/components/portal/portal-team-context"
import { DashboardSidebar } from "@/components/portal/dashboard-sidebar"
import { DashboardMobileTabBar } from "@/components/portal/dashboard-mobile-tab-bar"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { useMinWidthLg } from "@/lib/hooks/use-min-width-lg"
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
  const isLgUp = useMinWidthLg()
  const pathname = usePathname()
  const isSchedulePage = pathname?.includes("/dashboard/schedule") ?? false
  const teamIds = teams.map((t) => t.id)
  const resolvedCurrentTeamId = currentTeamId ?? teams[0]?.id ?? ""

  return (
    <PortalTeamProvider teamIds={teamIds} currentTeamId={resolvedCurrentTeamId}>
      <CoachBProvider isDesktop={isLgUp}>
        <PlaybookToastProvider>
          <div className={cn("flex w-full min-w-0 flex-col", className)}>
            <div className="flex w-full min-w-0 flex-col lg:flex-row lg:items-start">
              <aside
                className={cn(
                  "z-40 hidden w-full shrink-0 flex-col overflow-hidden border-border lg:flex lg:w-64",
                  "lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.75rem)] lg:border-b-0 lg:border-r lg:self-start"
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
                  "min-w-0 w-full flex-1 overflow-x-hidden",
                  "p-4 md:p-6 md:pt-5",
                  "max-lg:pb-28 lg:pb-6",
                  isSchedulePage &&
                    "flex min-h-[calc(100dvh-9rem)] flex-col overflow-hidden lg:min-h-[calc(100dvh-8rem)]"
                )}
                style={{
                  backgroundColor: "rgb(var(--snow))",
                }}
              >
                <div
                  className={cn(
                    "w-full min-w-0 max-w-full",
                    isSchedulePage && "flex min-h-0 flex-1 flex-col overflow-hidden"
                  )}
                >
                  <div
                    className={cn(
                      "min-w-0 w-full max-w-full rounded-none border-0 bg-transparent shadow-none",
                      "lg:rounded-xl lg:border-2 lg:border-[#E5E7EB] lg:bg-white lg:p-6 lg:shadow-sm",
                      isSchedulePage &&
                        "flex min-h-0 flex-1 flex-col overflow-hidden lg:[scrollbar-gutter:stable]"
                    )}
                    aria-label="Page content"
                  >
                    <div
                      className={cn(
                        "min-w-0 w-full max-w-full",
                        isSchedulePage && "flex min-h-0 flex-1 flex-col overflow-hidden"
                      )}
                    >
                      {children}
                    </div>
                  </div>
                </div>
              </main>
            </div>

            {isLgUp && (
              <div className="w-full shrink-0">
                <AIWidgetWrapper />
              </div>
            )}
            {!isLgUp && <AIWidgetWrapper />}
            <DashboardMobileTabBar />
          </div>
        </PlaybookToastProvider>
      </CoachBProvider>
    </PortalTeamProvider>
  )
}
