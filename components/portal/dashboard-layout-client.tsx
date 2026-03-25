"use client"

import { usePathname } from "next/navigation"
import { useRef } from "react"
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

  // RSC passes a new `teams` array every navigation; keep referential stability when id+name are unchanged
  // so PortalTeamProvider and the sidebar subtree skip useless context updates during soft route changes.
  const shellTeamsRef = useRef<{ sig: string; teams: Team[]; teamIds: string[] } | null>(null)
  const teamsSig = teams.map((t) => `${t.id}\0${t.name}`).join("\n")
  if (!shellTeamsRef.current || shellTeamsRef.current.sig !== teamsSig) {
    shellTeamsRef.current = {
      sig: teamsSig,
      teams,
      teamIds: teams.map((t) => t.id),
    }
  }
  const shellTeams = shellTeamsRef.current.teams
  const shellTeamIds = shellTeamsRef.current.teamIds

  const resolvedCurrentTeamId = currentTeamId ?? shellTeams[0]?.id ?? ""
  const isDashboardHome = pathname === "/dashboard"

  return (
    <PortalTeamProvider teamIds={shellTeamIds} currentTeamId={resolvedCurrentTeamId}>
      <CoachBProvider isDesktop={isLgUp}>
        <PlaybookToastProvider>
          <BiometricEnablePrompt />
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
                <DashboardSidebar teams={shellTeams} />
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
                      {/* Hints only on home dashboard — avoids mounting /api fetch wiring on every route */}
                      {isDashboardHome && resolvedCurrentTeamId ? (
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
          </div>
        </PlaybookToastProvider>
      </CoachBProvider>
    </PortalTeamProvider>
  )
}
