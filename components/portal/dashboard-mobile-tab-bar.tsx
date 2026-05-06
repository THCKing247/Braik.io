"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Calendar, MessageSquare, Menu } from "lucide-react"
import { useMobileDashboardNav } from "@/components/portal/mobile-dashboard-nav-provider"
import { getQuickActionsForRole, isPrimaryMobileTabPath } from "@/config/quickActions"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import { usePortalTeam } from "@/components/portal/portal-team-context"
import { useAppBootstrapCoreOptional } from "@/components/portal/app-bootstrap-context"
import { DashboardNotificationUnreadBadge } from "@/components/portal/dashboard-notification-unread-badge"

const tabs = [
  {
    href: "/dashboard",
    label: "Home",
    icon: LayoutDashboard,
    match: (p: string) => p === "/dashboard",
  },
  {
    href: "/dashboard/roster",
    label: "Roster",
    icon: Users,
    match: (p: string) => p.startsWith("/dashboard/roster"),
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: Calendar,
    match: (p: string) => p.startsWith("/dashboard/calendar"),
  },
  {
    href: "/dashboard/messages",
    label: "Messages",
    icon: MessageSquare,
    match: (p: string) => p.startsWith("/dashboard/messages"),
  },
] as const

function pathMatchesMoreArea(pathname: string, role: string | undefined, videoClipsNavVisible?: boolean): boolean {
  const secondary = getQuickActionsForRole(role, { videoClipsNavVisible }).filter(
    (a) => !isPrimaryMobileTabPath(a.href)
  )
  return secondary.some(
    (a) => pathname === a.href || (a.href !== "/dashboard" && pathname.startsWith(a.href))
  )
}

/** Bottom nav + More sheet for all viewports below lg. */
export function DashboardMobileTabBar() {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const portal = usePortalTeam()
  const identity = useDashboardShellIdentity()
  const bootstrapCore = useAppBootstrapCoreOptional()
  const videoClipsNavVisible = bootstrapCore?.payload?.videoClips?.navVisible
  const { openMoreSheet, moreSheetOpen } = useMobileDashboardNav()
  const contextTeamId =
    searchParams.get("teamId") || portal?.currentTeamId || portal?.teamIds?.[0] || ""
  const homeDashboardHref =
    identity.roleUpper === "HEAD_COACH" && contextTeamId
      ? `/dashboard?teamId=${encodeURIComponent(contextTeamId)}`
      : "/dashboard"
  const moreRouteActive = useMemo(
    () => pathMatchesMoreArea(pathname, identity.roleUpper, videoClipsNavVisible),
    [pathname, identity.roleUpper, videoClipsNavVisible]
  )

  /** Immersive play editor: full-bleed field, no tab bar */
  if (pathname.startsWith("/dashboard/playbooks/play/")) {
    return null
  }

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-border bg-background/95 pb-[max(0px,env(safe-area-inset-bottom,0px))] shadow-[0_-2px_12px_rgba(0,0,0,0.04)] backdrop-blur-sm"
      )}
      aria-label="Primary"
    >
      <div className="mx-auto grid h-[68px] min-h-[68px] max-w-[min(100%,var(--mobile-shell-max-width))] grid-cols-5 items-stretch px-1 pt-1 sm:px-3 md:px-4">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          const resolvedHref = href === "/dashboard" ? homeDashboardHref : href
          const showMsgBadge = href === "/dashboard/messages"
          return (
            <Link
              key={href}
              href={resolvedHref}
              prefetch={false}
              className={cn(
                "relative flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1",
                "transition-colors active:bg-muted/80",
                active ? "text-[rgb(var(--accent))]" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.25px]")} aria-hidden />
                {showMsgBadge ? <DashboardNotificationUnreadBadge variant="mobile-tab" /> : null}
              </span>
              <span className="max-w-full truncate text-[10px] font-semibold leading-tight sm:text-[11px]">
                {label}
              </span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={openMoreSheet}
          className={cn(
            "flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1",
            "transition-colors active:bg-muted/80",
            moreSheetOpen || moreRouteActive ? "text-[rgb(var(--accent))]" : "text-muted-foreground"
          )}
          aria-label="Open More menu"
          aria-expanded={moreSheetOpen}
        >
          <Menu className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-[10px] font-semibold leading-tight sm:text-[11px]">More</span>
        </button>
      </div>
    </nav>
  )
}
