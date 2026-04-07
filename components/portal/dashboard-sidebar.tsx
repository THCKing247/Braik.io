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

const SIDEBAR_WIDTH = 256

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* Scrollable: role, user, nav, Coach B — sign out stays pinned below */}
      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain touch-scroll">
        <div className="flex-shrink-0 border-b border-white/10 p-4">
          {roleLabel && (
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">
              {roleLabel}
            </p>
          )}
          {currentTeam?.name && (
            <p
              className="mt-0.5 truncate text-sm font-semibold text-white"
              title={currentTeam.name}
            >
              {currentTeam.name}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 border-b border-white/10 p-3">
          <div className="rounded-lg bg-white/10 px-3 py-2">
            <p
              className="truncate text-sm font-medium text-white"
              title={identity.email}
            >
              {identity.displayName || identity.email || "User"}
            </p>
            <p className="truncate text-xs text-white/70">{identity.email}</p>
          </div>
        </div>

        <nav className="space-y-1.5 p-3" aria-label="Main navigation">
          <SidebarNavItem
            href={dashboardHomeHref}
            label="Dashboard"
            icon={LayoutDashboard}
            isActive={pathname === "/dashboard"}
          />
          {quickActions.map((action) => (
            <SidebarNavItem
              key={action.id}
              href={action.href}
              label={action.label}
              icon={action.icon}
              badgeCount={action.id === "messages" && shellUnread > 0 ? Math.min(shellUnread, 99) : undefined}
              isActive={
                pathname === action.href ||
                (action.href !== "/dashboard" && pathname.startsWith(action.href))
              }
            />
          ))}
        </nav>

        {showCoachB && (
          <div className="border-t border-white/10 p-2 lg:p-3">
            <div
              className={cn(
                "overflow-hidden rounded-xl border border-white/10 bg-white/10 p-3 transition-all duration-200 lg:p-4",
                "hover:bg-white/15"
              )}
            >
              <div className="mb-2 flex justify-center lg:mb-3">
                <Image
                  src="/images/ai-chat-icon-tmp.webp"
                  alt="Coach B clipboard mascot"
                  width={96}
                  height={96}
                  className="object-contain lg:h-[110px] lg:w-[110px]"
                />
              </div>
              <div className="mb-1.5 flex items-center gap-2 lg:mb-2">
                <MessageSquare className="h-5 w-5 flex-shrink-0 text-[#93C5FD]" aria-hidden />
                <span className="text-sm font-semibold text-white">Coach B</span>
              </div>
              <p className="mb-2 text-xs text-white/80 lg:mb-3" key={coachCopy.tick}>
                {coachCopy.subtitle}
              </p>
              <p className="mb-2 text-[11px] leading-snug text-white/65 lg:mb-3">{coachCopy.insight}</p>
              <button
                type="button"
                onClick={() => coachB?.open()}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5",
                  "text-sm font-medium text-white shadow-sm transition-colors",
                  "bg-[#2563EB] hover:bg-[#3B82F6]",
                  "focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#0B2A5B]"
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

      <div className="mt-auto shrink-0 space-y-2 border-t border-white/10 p-4">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
            "bg-[#EF4444] text-white shadow-md transition-colors hover:bg-[#DC2626]",
            "focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30 focus:ring-offset-2 focus:ring-offset-[#0B2A5B]"
          )}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
        <p className="text-center text-xs text-white/50">Braik</p>
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
        "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0B2A5B]",
        isActive
          ? "border border-white/25 bg-[#2563EB] text-white shadow-md"
          : "text-white/[0.88] hover:bg-white/15 hover:text-white"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span
          className="ml-1 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white"
          aria-label={`${badgeCount} unread`}
        >
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </Link>
  )
})

export const DASHBOARD_SIDEBAR_WIDTH = SIDEBAR_WIDTH
