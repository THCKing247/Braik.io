"use client"

import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { useAdPortalDepartmentLink } from "@/components/portal/ad-portal-link-context"
import { cn } from "@/lib/utils"
import { TeamSwitcher } from "@/components/portal/team-switcher"

interface Team {
  id: string
  name: string
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
 * lg+: desktop header with team switcher and Admin.
 */
const departmentNavLinkClass = cn(
  "inline-flex min-h-[44px] items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
  "hover:bg-[rgb(var(--platinum))]"
)

export function DashboardNav({ teams }: { teams: Team[] }) {
  const identity = useDashboardShellIdentity()
  const { departmentHref: adDepartmentHref } = useAdPortalDepartmentLink()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTeamId = searchParams.get("teamId") || teams[0]?.id || ""
  const showAdminLink = identity.isPlatformOwner
  const userRole = identity.roleUpper

  const path = pathname ?? ""
  const onAdPortalShell = path.startsWith("/dashboard/ad")
  const inTeamPortal =
    Boolean(searchParams.get("teamId")) ||
    (path.startsWith("/dashboard/") &&
      !path.startsWith("/dashboard/ad") &&
      !path.startsWith("/dashboard/director"))
  const showDepartmentNavLink =
    Boolean(adDepartmentHref) && userRole === "HEAD_COACH" && !onAdPortalShell && inTeamPortal

  const dashboardHomeHref =
    userRole === "HEAD_COACH" && teams.length > 0 && (currentTeamId || teams[0]?.id)
      ? `/dashboard?teamId=${encodeURIComponent(currentTeamId || teams[0].id)}`
      : "/dashboard"

  return (
    <>
      <nav
        className="sticky top-0 z-50 flex w-full min-w-0 max-w-full flex-col overflow-x-hidden border-b shadow-[0_1px_0_rgba(0,0,0,0.04)] lg:hidden"
        style={{
          ...navBarStyle,
          paddingTop: "max(0.375rem, env(safe-area-inset-top, 0px))",
        }}
        aria-label="App navigation"
      >
        <div className="grid min-h-[52px] w-full grid-cols-3 items-center gap-2 px-3 py-2 sm:px-5 md:px-6">
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
              href="/dashboard"
              prefetch={false}
              className="flex max-w-[min(200px,42vw)] min-w-0 justify-center active:opacity-80"
              aria-label="Braik - Home"
            >
              <div className="flex h-9 items-center overflow-hidden sm:h-10 md:h-11">
                <Image
                  src="/braik-logo.png"
                  alt="Braik"
                  width={720}
                  height={360}
                  className="h-auto w-full max-h-9 object-contain object-center sm:max-h-10 md:max-h-11"
                  priority
                />
              </div>
            </Link>
          </div>
          <div className="flex items-center justify-end gap-1">
            {showDepartmentNavLink && adDepartmentHref && (
              <Link
                href={adDepartmentHref}
                prefetch={false}
                className={cn(departmentNavLinkClass, "px-2 text-xs font-semibold sm:text-sm")}
                style={{ color: "rgb(var(--text))" }}
                title="Return to Athletic Department portal"
                aria-label="Return to Athletic Department portal"
              >
                Department
              </Link>
            )}
          </div>
        </div>
      </nav>

      <nav
        className="sticky top-0 z-50 hidden w-full min-w-0 max-w-full flex-col overflow-x-hidden border-b lg:flex"
        style={navBarStyle}
        aria-label="App navigation"
      >
        <div className="flex w-full min-w-0 max-w-full items-center gap-3 px-4 py-2.5 md:px-6">
          <div className="min-w-0 shrink-0">
            <Link
              href={dashboardHomeHref}
              prefetch={false}
              className="flex items-center rounded transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1E293B]"
              aria-label="Braik - Return to dashboard"
            >
              <div className="flex h-10 max-w-[min(200px,calc(100vw-22rem))] items-center overflow-hidden md:h-11 lg:h-12">
                <Image
                  src="/braik-logo.png"
                  alt="Braik Logo"
                  width={720}
                  height={360}
                  className="h-auto w-full max-h-10 object-contain object-left md:max-h-11 lg:max-h-12"
                />
              </div>
            </Link>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-center px-2">
            {teams.length > 1 && (
              <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {showDepartmentNavLink && adDepartmentHref && (
              <Link
                href={adDepartmentHref}
                prefetch={false}
                className={departmentNavLinkClass}
                style={{ color: "rgb(var(--text))" }}
                title="Return to Athletic Department portal"
                aria-label="Return to Athletic Department portal"
              >
                Department
              </Link>
            )}
            {showAdminLink && (
              <Link
                href="/admin/dashboard"
                prefetch={false}
                className={cn(
                  "inline-flex min-h-[44px] items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname?.startsWith("/admin")
                    ? "border-b-2 font-semibold"
                    : "hover:bg-[rgb(var(--platinum))]"
                )}
                style={{
                  color: "rgb(var(--text))",
                  borderBottomColor: pathname?.startsWith("/admin")
                    ? "rgb(var(--accent))"
                    : "transparent",
                }}
              >
                Admin
              </Link>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
