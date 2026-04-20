"use client"

import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { useAdPortalDepartmentLink } from "@/components/portal/ad-portal-link-context"
import { usePortalShellOptional } from "@/components/portal/portal-shell-context"
import { cn } from "@/lib/utils"
import { TeamSwitcher } from "@/components/portal/team-switcher"
import { prefetchPropForDashboardScheduleHref } from "@/lib/navigation/dashboard-schedule-prefetch"
import { portalPrefixedDashboardHref } from "@/lib/portal/dashboard-path"
import {
  buildDashboardTeamPath,
  CANONICAL_DASHBOARD_TEAM_PATH_RE,
} from "@/lib/navigation/organization-routes"

interface Team {
  id: string
  name: string
  shortOrgId?: string | null
  shortTeamId?: string | null
  organization: {
    name: string
  }
  sport: string
  seasonName: string
}

const navBarStyle = {
  backgroundColor: "#FFFFFF" as const,
  borderColor: "rgb(var(--border))",
  borderWidth: "1px" as const,
  borderTop: "none" as const,
  borderLeft: "none" as const,
  borderRight: "none" as const,
}

/**
 * &lt; lg: simple bar — centered logo. Overflow nav is bottom "More" sheet.
 * lg+: fixed desktop header (Edge-style): logo, team switcher, actions + avatar.
 */
const departmentNavLinkClass = cn(
  "inline-flex min-h-[44px] items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
  "text-gray-700 hover:bg-gray-100"
)

function userInitials(displayName: string | null, email: string): string {
  const raw = (displayName || email || "?").trim()
  if (!raw) return "?"
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    if (a && b) return `${a}${b}`.toUpperCase()
  }
  return raw.slice(0, 2).toUpperCase()
}

export function DashboardNav({ teams }: { teams: Team[] }) {
  const identity = useDashboardShellIdentity()
  const portalCtx = usePortalShellOptional()
  const portalKind = portalCtx?.portalKind ?? "coach"
  const { departmentHref: adDepartmentHref } = useAdPortalDepartmentLink()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const path = pathname ?? ""
  const teamFromPath = (() => {
    const match = path.match(/^\/dashboard\/org\/[^/]+\/team\/([^/]+)/)
    return match?.[1] ?? null
  })()
  const currentTeamId =
    teams.find((t) => t.shortTeamId === teamFromPath)?.id || searchParams.get("teamId") || teams[0]?.id || ""
  const showAdminLink = identity.isPlatformOwner
  const userRole = identity.roleUpper

  const onAdPortalShell = path.startsWith("/dashboard/ad")
  const inTeamPortal =
    Boolean(searchParams.get("teamId")) ||
    CANONICAL_DASHBOARD_TEAM_PATH_RE.test(path) ||
    (path.startsWith("/dashboard/") &&
      !path.startsWith("/dashboard/ad") &&
      !path.startsWith("/dashboard/director"))
  const showDepartmentNavLink =
    Boolean(adDepartmentHref) &&
    userRole === "HEAD_COACH" &&
    portalKind === "coach" &&
    !onAdPortalShell &&
    inTeamPortal

  const baseHome = portalPrefixedDashboardHref(portalKind, "/")
  const currentTeam = teams.find((team) => team.id === currentTeamId) || teams[0]
  const dashboardHomeHref =
    userRole === "HEAD_COACH" && currentTeam?.shortOrgId && currentTeam?.shortTeamId
      ? buildDashboardTeamPath({
          shortOrgId: currentTeam.shortOrgId,
          shortTeamId: currentTeam.shortTeamId,
        })
      : userRole === "HEAD_COACH" && teams.length > 0 && (currentTeamId || teams[0]?.id)
        ? `${baseHome}?teamId=${encodeURIComponent(currentTeamId || teams[0].id)}`
        : baseHome

  const initials = userInitials(identity.displayName, identity.email)

  return (
    <>
      <nav
        className="sticky top-0 z-50 flex w-full min-w-0 max-w-full flex-col overflow-x-hidden border-b border-gray-200/80 bg-white shadow-sm lg:hidden"
        style={{
          ...navBarStyle,
          paddingTop: "max(0.375rem, env(safe-area-inset-top, 0px))",
        }}
        aria-label="App navigation"
      >
        <div className="grid min-h-20 w-full grid-cols-3 items-center gap-2 px-3 py-2 sm:min-h-[5.5rem] sm:px-5 md:px-6">
          <div className="min-w-0 justify-self-start">
            {teams.length > 1 ? (
              <div className="max-w-[28vw] truncate text-xs font-semibold text-foreground sm:max-w-[140px] sm:text-sm">
                <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
              </div>
            ) : currentTeamId && teams[0]?.name ? (
              <span
                className="block max-w-[28vw] truncate text-xs font-semibold text-muted-foreground sm:max-w-[160px] sm:text-sm"
                title={teams[0].name}
              >
                {teams[0].name}
              </span>
            ) : (
              <span className="w-10" aria-hidden />
            )}
          </div>
          <div className="flex min-w-0 justify-center">
            <Link
              href={dashboardHomeHref}
              prefetch={prefetchPropForDashboardScheduleHref(dashboardHomeHref)}
              className="flex max-w-[min(300px,42vw)] min-w-0 items-center justify-center active:opacity-80"
              aria-label="Braik - Home"
            >
              <Image
                src="/braik-logo.webp"
                alt="Braik"
                width={720}
                height={360}
                className="h-[4.5rem] w-auto object-contain object-center"
                priority
              />
            </Link>
          </div>
          <div className="flex items-center justify-end gap-2">
            {showDepartmentNavLink && adDepartmentHref && (
              <Link
                href={adDepartmentHref}
                prefetch={false}
                className={cn(departmentNavLinkClass, "px-2 text-xs font-semibold sm:text-sm")}
                title="Return to organization portal"
                aria-label="Return to organization portal"
              >
                Organization
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Zero-height wrapper so fixed bar does not consume flex layout space (scroll shell stays correct). */}
      <div className="relative hidden lg:block lg:h-0 lg:overflow-visible">
        <nav
          className={cn(
            "fixed left-0 right-0 top-0 z-[60] flex h-20 w-full min-w-0 max-w-full flex-col overflow-x-hidden",
            "border-b border-gray-200 bg-[#fafafa] shadow-sm"
          )}
          aria-label="App navigation"
        >
          <div className="flex h-full w-full min-w-0 max-w-full items-center justify-between gap-4 px-6">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Link
                href={dashboardHomeHref}
                prefetch={prefetchPropForDashboardScheduleHref(dashboardHomeHref)}
                className="flex shrink-0 items-center rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2"
                aria-label="Braik - Return to dashboard"
              >
                <Image
                  src="/braik-logo.webp"
                  alt="Braik Logo"
                  width={720}
                  height={360}
                  className="h-[4.5rem] w-auto max-w-[min(240px,calc(100vw-28rem))] object-contain object-left"
                  priority
                />
              </Link>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center px-2">
              {teams.length > 1 && (
                <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
              )}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
              {showDepartmentNavLink && adDepartmentHref && (
                <Link
                  href={adDepartmentHref}
                  prefetch={false}
                  className={departmentNavLinkClass}
                  title="Return to organization portal"
                  aria-label="Return to organization portal"
                >
                  Organization
                </Link>
              )}
              {showAdminLink && (
                <Link
                  href="/admin/overview"
                  prefetch={false}
                  className={cn(
                    "inline-flex min-h-[40px] items-center rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                    pathname?.startsWith("/admin")
                      ? "bg-blue-600 font-semibold text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  Admin
                </Link>
              )}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white shadow-sm ring-2 ring-white"
                title={identity.displayName || identity.email || "User"}
                aria-label={identity.displayName || identity.email || "User account"}
              >
                {initials}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </>
  )
}
