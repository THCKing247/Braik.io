"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { CoachBProvider } from "@/components/portal/coach-b-context"
import { PlaybookToastProvider } from "@/components/portal/playbook-toast"
import { DashboardSidebarByPortal } from "@/components/portal/dashboard-sidebar-by-portal"
import { DashboardMobileTabBar } from "@/components/portal/dashboard-mobile-tab-bar"
import { MobilePortalShell } from "@/components/mobile/mobile-portal-shell"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { CalendarEventsInvalidateBridge } from "@/components/calendar/calendar-events-invalidate-bridge"
import { DashboardEngagementHints } from "@/components/portal/dashboard-engagement-hints"
import { BiometricEnablePrompt } from "@/components/native/biometric-enable-prompt"
import { useMinWidthLg } from "@/lib/hooks/use-min-width-lg"
import { ScrollFadeContainer } from "@/components/ui/scroll-fade-container"
import { cn } from "@/lib/utils"
import { stripDashboardPortalPrefix } from "@/lib/portal/dashboard-path"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

/** Mount coach hints only when the strip nears the viewport — avoids /api/engagement/hints on first paint. */
function DeferredDashboardEngagementHints({ currentTeamId }: { currentTeamId: string }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { root: null, rootMargin: "160px 0px", threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={sentinelRef} className="min-h-px w-full max-w-full">
      {visible ? <DashboardEngagementHints currentTeamId={currentTeamId} /> : null}
    </div>
  )
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
  const pathForLayout = stripDashboardPortalPrefix(pathname ?? "")
  const isSchedulePage =
    (pathForLayout.includes("/dashboard/schedule") ?? false) || (pathForLayout.includes("/dashboard/calendar") ?? false)
  const isPlayEditorRoute = pathForLayout.startsWith("/dashboard/playbooks/play/")
  const useMobilePortalShell = !isPlayEditorRoute && !isSchedulePage

  // RSC passes a new `teams` array every navigation; keep referential stability when id+name are unchanged
  // so the sidebar subtree skips useless updates during soft route changes.
  const shellTeamsRef = useRef<{ sig: string; teams: Team[] } | null>(null)
  const teamsSig = teams.map((t) => `${t.id}\0${t.name}`).join("\n")
  if (!shellTeamsRef.current || shellTeamsRef.current.sig !== teamsSig) {
    shellTeamsRef.current = {
      sig: teamsSig,
      teams,
    }
  }
  const shellTeams = shellTeamsRef.current.teams

  const resolvedCurrentTeamId = currentTeamId ?? shellTeams[0]?.id ?? ""
  const isDashboardHome = pathForLayout === "/dashboard"

  return (
    <CoachBProvider isDesktop={isLgUp}>
      <PlaybookToastProvider>
        <BiometricEnablePrompt />
        <div
          className={cn(
            "flex w-full min-w-0 flex-col",
            "lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:pt-[5rem]",
            className
          )}
        >
          <div className="flex w-full min-w-0 flex-col lg:flex-1 lg:min-h-0 lg:flex-row lg:overflow-hidden">
            <aside
              className={cn(
                "z-40 hidden w-full shrink-0 flex-col overflow-hidden border-border lg:fixed lg:left-0 lg:top-[5rem] lg:z-40 lg:flex",
                "lg:h-[calc(100dvh-5rem)] lg:w-60 lg:overflow-hidden lg:border-b-0 lg:border-r lg:border-slate-800/60",
                "lg:bg-[#0f172a]"
              )}
              aria-label="Dashboard navigation"
            >
              <DashboardSidebarByPortal teams={shellTeams} />
            </aside>

            <main
              className={cn(
                "min-w-0 w-full max-w-full flex-1 overflow-x-hidden",
                "lg:ml-60 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden lg:overflow-x-hidden lg:bg-[#f9fafb]",
                isPlayEditorRoute
                  ? "max-lg:p-0 max-lg:pt-0 lg:p-0"
                  : isSchedulePage
                    ? "px-4 pt-4 md:p-6 md:pt-5 lg:p-6 xl:p-8"
                    : "px-0 pt-4 pb-0 md:p-6 md:pt-5 lg:p-6 xl:p-8",
                !isPlayEditorRoute && "lg:pb-6",
                isSchedulePage
                  ? "max-lg:pb-[max(7.5rem,calc(5.5rem+env(safe-area-inset-bottom,0px)))] md:max-lg:pb-[max(8.5rem,calc(6rem+env(safe-area-inset-bottom,0px)))]"
                  : isPlayEditorRoute
                    ? "max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
                    : "max-lg:pb-[var(--mobile-main-pad-bottom)]",
                isSchedulePage &&
                  "flex min-h-[calc(100dvh-9rem)] flex-col overflow-hidden lg:min-h-0 lg:flex-1",
                "bg-[rgb(var(--snow))] lg:bg-[#f9fafb]"
              )}
            >
              <ScrollFadeContainer
                variant="muted"
                fadeHeight="h-8"
                className="w-full min-h-0 flex-1 lg:flex lg:min-h-0 lg:flex-col"
                scrollClassName={cn(
                  "w-full min-h-0 flex-1 max-lg:overflow-x-hidden max-lg:overflow-y-visible",
                  "lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden"
                )}
              >
                <div
                  className={cn(
                    "w-full min-w-0 max-w-full lg:flex-1 lg:min-h-0",
                    isSchedulePage && "flex min-h-0 flex-1 flex-col overflow-hidden"
                  )}
                >
                  <div
                    className={cn(
                      "min-w-0 w-full max-w-full rounded-none border-0 bg-transparent shadow-none",
                      !isDashboardHome && "lg:rounded-xl lg:border lg:border-gray-200 lg:bg-white lg:p-6 lg:shadow-sm",
                      isDashboardHome && "lg:p-0",
                      isPlayEditorRoute && "max-lg:!rounded-none max-lg:!border-0 lg:!rounded-none lg:!border-0 lg:!bg-transparent lg:!p-0 lg:!shadow-none",
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
                      {/* Hints only on home dashboard — avoids mounting /api fetch wiring on every route */}
                      {isDashboardHome && resolvedCurrentTeamId ? (
                        <DeferredDashboardEngagementHints currentTeamId={resolvedCurrentTeamId} />
                      ) : null}
                      {useMobilePortalShell ? <MobilePortalShell>{children}</MobilePortalShell> : children}
                    </div>
                  </div>
                </div>
              </ScrollFadeContainer>
            </main>
          </div>

          <AIWidgetWrapper />
          <CalendarEventsInvalidateBridge />
          <DashboardMobileTabBar />
        </div>
      </PlaybookToastProvider>
    </CoachBProvider>
  )
}
