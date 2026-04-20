"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Calendar, MessageSquare, Menu } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useMobileDashboardNav } from "@/components/portal/mobile-dashboard-nav-provider"
import { getQuickActionsForRole, isPrimaryMobileTabPath } from "@/config/quickActions"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import { usePortalTeam } from "@/components/portal/portal-team-context"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { useMessagingUnreadOptional } from "@/components/portal/messaging-unread-context"
import { usePortalShellKind } from "@/components/portal/portal-shell-context"
import {
  portalPrefixedDashboardHref,
  stripDashboardPortalPrefix,
  teamScopedDashboardHref,
} from "@/lib/portal/dashboard-path"

type TabSpec = {
  legacyHref: string
  label: string
  icon: LucideIcon
  match: (canonicalPath: string) => boolean
}

const defaultTabs: TabSpec[] = [
  {
    legacyHref: "/dashboard",
    label: "Home",
    icon: LayoutDashboard,
    match: (canonicalPath: string) => canonicalPath === "/dashboard",
  },
  {
    legacyHref: "/dashboard/roster",
    label: "Roster",
    icon: Users,
    match: (canonicalPath: string) => canonicalPath.startsWith("/dashboard/roster"),
  },
  {
    legacyHref: "/dashboard/calendar",
    label: "Calendar",
    icon: Calendar,
    match: (canonicalPath: string) => canonicalPath.startsWith("/dashboard/calendar"),
  },
  {
    legacyHref: "/dashboard/messages",
    label: "Messages",
    icon: MessageSquare,
    match: (canonicalPath: string) => canonicalPath.startsWith("/dashboard/messages"),
  },
]

function pathMatchesMoreArea(
  pathname: string,
  role: string | undefined,
  videoClipsNavVisible?: boolean,
  hrefTransform?: (href: string) => string
): boolean {
  const strippedPath = stripDashboardPortalPrefix(pathname.split("?")[0] ?? pathname)
  const secondary = getQuickActionsForRole(role, {
    videoClipsNavVisible,
    hrefTransform,
  }).filter((a) => !isPrimaryMobileTabPath(a.href))
  return secondary.some((a) => {
    const target = stripDashboardPortalPrefix(a.href.split("?")[0] ?? a.href)
    return (
      strippedPath === target ||
      (target !== "/dashboard" && (strippedPath.startsWith(`${target}/`) || strippedPath.startsWith(target)))
    )
  })
}

/** Bottom nav + More sheet for all viewports below lg. */
export function DashboardMobileTabBar() {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const portal = usePortalTeam()
  const identity = useDashboardShellIdentity()
  const portalKind = usePortalShellKind()
  const portalTeam = usePortalTeam()
  const bootstrap = useAppBootstrapOptional()
  const messagingUnread = useMessagingUnreadOptional()
  const shellUnread = bootstrap?.effectiveUnreadNotifications ?? 0
  const messagesTabBadgeCount = shellUnread + (messagingUnread?.effectiveThreadUnread ?? 0)
  const videoClipsNavVisible = bootstrap?.payload?.videoClips?.navVisible
  const { openMoreSheet, moreSheetOpen } = useMobileDashboardNav()
  const contextTeamId =
    searchParams.get("teamId") || portal?.currentTeamId || portal?.teamIds?.[0] || ""

  const canonicalPath = stripDashboardPortalPrefix(pathname)

  const hrefTransform = useCallback(
    (href: string) => {
      if (!href.startsWith("/dashboard")) return href
      const rawRest = href.slice("/dashboard".length)
      const suffix = rawRest === "" ? "/" : rawRest.startsWith("/") ? rawRest : `/${rawRest}`
      return teamScopedDashboardHref(portalKind, suffix, portalTeam?.currentTeamRouteIds ?? null)
    },
    [portalKind, portalTeam?.currentTeamRouteIds]
  )

  const baseHome = portalPrefixedDashboardHref(portalKind, "/")
  const coachLike =
    identity.roleUpper === "HEAD_COACH" || identity.roleUpper === "ASSISTANT_COACH"
  const homeDashboardHref =
    coachLike && portalTeam?.currentTeamRouteIds
      ? teamScopedDashboardHref(portalKind, "/", portalTeam.currentTeamRouteIds)
      : coachLike && contextTeamId
        ? `${baseHome}?teamId=${encodeURIComponent(contextTeamId)}`
        : baseHome

  const tabs = useMemo(() => {
    if (portalKind === "recruiter") {
      const homeHr = portalPrefixedDashboardHref("recruiter", "/")
      const msgHr = portalPrefixedDashboardHref("recruiter", "/messages")
      return [
        {
          legacyHref: homeHr,
          label: "Home",
          icon: LayoutDashboard,
          match: (canonical: string) =>
            canonical === "/dashboard/recruiting" ||
            pathname.startsWith("/dashboard/recruiter") ||
            canonical.startsWith("/dashboard/recruiting"),
        },
        {
          legacyHref: msgHr,
          label: "Messages",
          icon: MessageSquare,
          match: (canonical: string) => canonical.startsWith("/dashboard/messages"),
        },
      ] satisfies TabSpec[]
    }
    return defaultTabs
  }, [pathname, portalKind])

  const moreRouteActive = useMemo(
    () =>
      portalKind === "recruiter"
        ? stripDashboardPortalPrefix(pathname).startsWith("/dashboard/support") ||
          stripDashboardPortalPrefix(pathname).startsWith("/dashboard/profile")
        : pathMatchesMoreArea(pathname, identity.roleUpper, videoClipsNavVisible, hrefTransform),
    [pathname, identity.roleUpper, videoClipsNavVisible, hrefTransform, portalKind]
  )

  /** Immersive play editor: full-bleed field, no tab bar */
  if (canonicalPath.startsWith("/dashboard/playbooks/play/")) {
    return null
  }

  /** Recruiter workspace: fewer primary tabs — layout still uses 5 columns with spacer or stretch */
  const gridColsClass = portalKind === "recruiter" ? "grid-cols-3" : "grid-cols-5"

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-border bg-background/95 pb-[max(0px,env(safe-area-inset-bottom,0px))] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md"
      )}
      aria-label="Primary"
    >
      <div
        className={cn(
          "mx-auto grid h-[68px] min-h-[68px] max-w-[min(100%,var(--mobile-shell-max-width))] items-stretch px-1 pt-1 sm:px-3 md:px-4",
          gridColsClass
        )}
      >
        {tabs.map(({ legacyHref, label, icon: Icon, match }) => {
          const active = match(canonicalPath)
          const resolvedHref =
            portalKind === "recruiter"
              ? legacyHref
              : legacyHref === "/dashboard"
                ? homeDashboardHref
                : hrefTransform(legacyHref)
          const showMsgBadge = label === "Messages" && messagesTabBadgeCount > 0

          return (
            <Link
              key={`${legacyHref}-${label}`}
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
                {showMsgBadge ? (
                  <span
                    className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold text-white"
                    aria-label={`${Math.min(messagesTabBadgeCount, 99)} unread messages or notifications`}
                  >
                    {messagesTabBadgeCount > 9 ? "9+" : messagesTabBadgeCount}
                  </span>
                ) : null}
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
