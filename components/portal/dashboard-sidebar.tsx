"use client"

import { memo, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { signOut } from "@/lib/auth/client-auth"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import { useCoachB } from "@/components/portal/coach-b-context"
import { getQuickActionsForRole, type QuickAction } from "@/config/quickActions"
import { cn } from "@/lib/utils"
import { canUseCoachB, type Role } from "@/lib/auth/roles"
import { useCoachBRotatingCopy } from "@/lib/hooks/use-coach-b-rotating-copy"
import { LayoutDashboard, LogOut, MessageSquare, Sparkles } from "lucide-react"

const SIDEBAR_WIDTH = 240

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/90">{children}</p>
      <span
        className="mt-1.5 block h-0.5 w-6 rounded-full bg-orange-500/75"
        aria-hidden
      />
    </div>
  )
}

export function DashboardSidebar({ teams }: { teams: Team[] }) {
  const identity = useDashboardShellIdentity()
  const shell = useAppBootstrapOptional()
  const shellUnread = shell?.effectiveUnreadNotifications ?? 0
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const coachB = useCoachB()
  const userRole = identity.roleUpper || undefined
  const currentTeamId = searchParams.get("teamId") || teams[0]?.id
  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]
  const dashboardHomeHref =
    userRole === "HEAD_COACH" && teams.length > 0 && (currentTeamId || teams[0]?.id)
      ? `/dashboard?teamId=${encodeURIComponent(currentTeamId || teams[0].id)}`
      : "/dashboard"
  const videoNav = shell?.payload?.videoClips?.navVisible
  const quickActions = useMemo(
    () => getQuickActionsForRole(userRole, { videoClipsNavVisible: videoNav }),
    [userRole, videoNav]
  )
  const showCoachB = userRole && canUseCoachB(userRole as Role)
  const coachCopy = useCoachBRotatingCopy()

  const roleLabel = userRole
    ? userRole.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : ""

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0f172a]">
      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain touch-scroll">
        <div className="flex-shrink-0 border-b border-orange-500/30 px-4 py-6">
          <Link
            href={dashboardHomeHref}
            className="inline-flex rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
            aria-label="Braik - Home"
          >
            <Image
              src="/braik-logo.webp"
              alt="Braik"
              width={720}
              height={360}
              className="h-[4.5rem] w-auto object-contain object-left"
              priority
            />
          </Link>
        </div>

        <div className="relative flex-shrink-0 border-b border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-transparent to-transparent px-4 pb-4 pt-5">
          <SidebarSectionLabel>Team</SidebarSectionLabel>
          {roleLabel && (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{roleLabel}</p>
          )}
          {currentTeam?.name && (
            <p
              className="mt-1 truncate text-sm font-semibold text-slate-100"
              title={currentTeam.name}
            >
              {currentTeam.name}
            </p>
          )}
        </div>

        <div className="border-b border-slate-700/50 px-4 py-4">
          <SidebarSectionLabel>Main</SidebarSectionLabel>
          <nav className="flex flex-col gap-2" aria-label="Primary">
            <SidebarNavItem
              href={dashboardHomeHref}
              label="Dashboard"
              icon={LayoutDashboard}
              isActive={pathname === "/dashboard"}
            />
          </nav>
        </div>

        {quickActions.length > 0 ? (
          <div className="px-4 py-4">
            <SidebarSectionLabel>Tools</SidebarSectionLabel>
            <nav className="flex flex-col gap-2" aria-label="Tools">
              {quickActions.map((action) => (
                <SidebarNavItem
                  key={action.id}
                  href={action.href}
                  label={action.label}
                  icon={action.icon}
                  badgeCount={
                    action.id === "messages" && shellUnread > 0 ? Math.min(shellUnread, 99) : undefined
                  }
                  isActive={
                    pathname === action.href ||
                    (action.href !== "/dashboard" && pathname.startsWith(action.href))
                  }
                />
              ))}
            </nav>
          </div>
        ) : null}

        {showCoachB && (
          <div className="border-t border-orange-500/10 p-3">
            <div
              className={cn(
                "overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 transition-all duration-150",
                "hover:border-orange-500/25 hover:bg-slate-800/60"
              )}
            >
              <div className="mb-2 flex justify-center">
                <Image
                  src="/images/ai-chat-icon-tmp.webp"
                  alt="Coach B clipboard mascot"
                  width={96}
                  height={96}
                  className="h-[88px] w-[88px] object-contain"
                />
              </div>
              <div className="mb-1.5 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 flex-shrink-0 text-orange-400/90" aria-hidden />
                <span className="text-sm font-semibold text-slate-100">Coach B</span>
              </div>
              <p className="mb-2 text-xs text-slate-400" key={coachCopy.tick}>
                {coachCopy.subtitle}
              </p>
              <p className="mb-2 text-[11px] leading-snug text-slate-500">{coachCopy.insight}</p>
              <button
                type="button"
                onClick={() => coachB?.open()}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5",
                  "text-sm font-medium text-white shadow-sm transition-all duration-150",
                  "bg-blue-600 hover:bg-blue-500",
                  "focus:outline-none focus:ring-2 focus:ring-orange-400/45 focus:ring-offset-2 focus:ring-offset-[#0f172a]"
                )}
                aria-label="Ask Coach B"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Ask Coach B
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto shrink-0 space-y-2 border-t border-orange-500/10 p-4">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md border border-slate-600 px-3 py-2.5",
            "text-sm font-medium text-slate-200 transition-all duration-150",
            "hover:border-orange-500/35 hover:bg-orange-500/5 hover:text-white",
            "focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:ring-offset-2 focus:ring-offset-[#0f172a]"
          )}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
        <p className="text-center text-xs text-slate-600">Braik</p>
      </div>
    </div>
  )
}

const SidebarNavItem = memo(function SidebarNavItem({
  href,
  label,
  icon: Icon,
  isActive,
  badgeCount,
}: {
  href: string
  label: string
  icon: QuickAction["icon"]
  isActive: boolean
  badgeCount?: number
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[44px] items-center gap-3 rounded-md border-l-4 py-2.5 pr-4 text-sm font-medium transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-orange-500/35 focus:ring-offset-2 focus:ring-offset-[#0f172a]",
        isActive
          ? cn(
              "relative overflow-hidden border-orange-500 bg-blue-950/70 pl-3 text-white",
              "animate-sidebar-active-pulse motion-reduce:animate-none"
            )
          : "border-transparent pl-4 text-slate-400 hover:border-orange-500/35 hover:bg-orange-500/10 hover:text-orange-400"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 rounded-md bg-gradient-to-r from-[rgba(249,115,22,0.05)] to-transparent"
        />
      ) : null}
      <Icon
        className={cn(
          "relative z-[1] h-5 w-5 flex-shrink-0 transition-colors duration-150",
          isActive
            ? "text-orange-400 drop-shadow-[0_0_4px_rgba(249,115,22,0.12)]"
            : "text-slate-500 group-hover:text-orange-400"
        )}
        aria-hidden
      />
      <span className="relative z-[1] min-w-0 flex-1 truncate">{label}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span
          className={cn(
            "relative z-[1] ml-1 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
            isActive ? "bg-orange-600" : "bg-amber-500"
          )}
          aria-label={`${badgeCount} unread`}
        >
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </Link>
  )
})

export const DASHBOARD_SIDEBAR_WIDTH = SIDEBAR_WIDTH
