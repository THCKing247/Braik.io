"use client"

import { usePathname } from "next/navigation"
import { CoachBProvider } from "@/components/portal/coach-b-context"
import { PlaybookToastProvider } from "@/components/portal/playbook-toast"
import { PortalTeamProvider } from "@/components/portal/portal-team-context"
import { DashboardSidebar } from "@/components/portal/dashboard-sidebar"
import { DashboardMobileTabBar } from "@/components/portal/dashboard-mobile-tab-bar"
import { MobilePortalShell } from "@/components/mobile/mobile-portal-shell"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { DashboardEngagementHints } from "@/components/portal/dashboard-engagement-hints"
import { BiometricEnablePrompt } from "@/components/native/biometric-enable-prompt"
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
  const isSchedulePage =
    (pathname?.includes("/dashboard/schedule") ?? false) || (pathname?.includes("/dashboard/calendar") ?? false)
  const isPlayEditorRoute = pathname?.startsWith("/dashboard/playbooks/play/") ?? false
  const useMobilePortalShell = !isPlayEditorRoute && !isSchedulePage
  /** Pre-portal gateway: not part of the team HC portal shell (no sidebar, no portal card, no mobile tab bar). */
  const isDirectorGateway = pathname === "/dashboard/director"
  const teamIds = teams.map((t) => t.id)
  const resolvedCurrentTeamId = currentTeamId ?? teams[0]?.id ?? ""

  return (
    <PortalTeamProvider teamIds={teamIds} currentTeamId={resolvedCurrentTeamId}>
      <CoachBProvider isDesktop={isLgUp}>
        <PlaybookToastProvider>
          <BiometricEnablePrompt />
          <div className={cn("flex w-full min-w-0 flex-col", className)}>
            {isDirectorGateway ? (
              <>
                <main
                  className="min-w-0 w-full max-w-full flex-1 overflow-x-hidden px-0 pt-4 pb-0 md:p-6 md:pt-5 lg:pb-6 max-lg:pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                  style={{
                    backgroundColor: "rgb(var(--snow))",
                  }}
                  aria-label="Football program gateway"
                >
                  <div className="w-full min-w-0 max-w-full">{children}</div>
                </main>
                <AIWidgetWrapper />
              </>
            ) : (
              <>
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
                      "min-w-0 w-full max-w-full flex-1 overflow-x-hidden",
                      isPlayEditorRoute
                        ? "max-lg:p-0 max-lg:pt-0"
                        : isSchedulePage
                          ? "px-4 pt-4 md:p-6 md:pt-5"
                          : "px-0 pt-4 pb-0 md:p-6 md:pt-5",
                      "lg:pb-6",
                      /* Reserve space for 64px tab bar + safe area (80px min) */
                      isSchedulePage
                        ? "max-lg:pb-[max(7.5rem,calc(5.5rem+env(safe-area-inset-bottom,0px)))] md:max-lg:pb-[max(8.5rem,calc(6rem+env(safe-area-inset-bottom,0px)))]"
                        : isPlayEditorRoute
                          ? "max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
                          : "max-lg:pb-[var(--mobile-main-pad-bottom)]",
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
                          "lg:rounded-xl lg:border lg:border-[#E5E7EB] lg:bg-white lg:p-6 lg:shadow-sm",
                          isPlayEditorRoute && "max-lg:!rounded-none max-lg:!border-0",
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
                          {resolvedCurrentTeamId ? (
                            <DashboardEngagementHints currentTeamId={resolvedCurrentTeamId} />
                          ) : null}
                          {useMobilePortalShell ? <MobilePortalShell>{children}</MobilePortalShell> : children}
                        </div>
                      </div>
                    </div>
                  </main>
                </div>

                <AIWidgetWrapper />
                <DashboardMobileTabBar />
              </>
            )}
          </div>
        </PlaybookToastProvider>
      </CoachBProvider>
    </PortalTeamProvider>
  )
}
