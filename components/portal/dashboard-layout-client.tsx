"use client"

import { usePathname } from "next/navigation"
import { CoachBProvider } from "@/components/portal/coach-b-context"
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
  children,
  className,
}: {
  teams: Team[]
  children: React.ReactNode
  className?: string
}) {
  const isMobileDevice = useIsMobileDevice()
  const isDesktop = !isMobileDevice
  const pathname = usePathname()
  const isSchedulePage = pathname?.includes("/dashboard/schedule") ?? false

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
                "min-h-0 flex flex-col px-4 py-6",
                isSchedulePage ? "flex-1" : "h-full"
              )}
            >
              <div
                className={cn(
                  "min-w-0 rounded-lg border-2 border-[#E5E7EB] bg-white shadow-sm",
                  isSchedulePage
                    ? "flex-1 min-h-0 overflow-hidden flex flex-col [scrollbar-gutter:stable]"
                    : "flex-1 min-h-[420px] max-h-[800px] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                )}
                aria-label="Page content"
              >
                <div className={cn("p-4", isSchedulePage && "flex-1 min-h-0 flex flex-col")}>
                  {children}
                </div>
              </div>
            </div>
          </main>
        </div>
        <AIWidgetWrapper />
      </div>
    </CoachBProvider>
  )
}
