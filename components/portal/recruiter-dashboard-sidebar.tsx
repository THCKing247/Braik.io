"use client"

import { memo } from "react"
import Link from "next/link"
import Image from "next/image"
import { signOut } from "@/lib/auth/client-auth"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"
import { prefetchPropForDashboardScheduleHref } from "@/lib/navigation/dashboard-schedule-prefetch"
import { ScrollFadeContainer } from "@/components/ui/scroll-fade-container"
import { cn } from "@/lib/utils"
import { portalPrefixedDashboardHref, stripDashboardPortalPrefix } from "@/lib/portal/dashboard-path"
import { ExternalLink, LayoutDashboard, LifeBuoy, MessageSquare, User } from "lucide-react"
import { usePathname } from "next/navigation"

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/90">{children}</p>
      <span className="mt-1.5 block h-0.5 w-6 rounded-full bg-orange-500/75" aria-hidden />
    </div>
  )
}

const SidebarNavItem = memo(function SidebarNavItem({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string
  label: string
  icon: typeof LayoutDashboard
  isActive: boolean
}) {
  return (
    <Link
      href={href}
      prefetch={prefetchPropForDashboardScheduleHref(href)}
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
          isActive ? "text-orange-400 drop-shadow-[0_0_4px_rgba(249,115,22,0.12)]" : "text-slate-500 group-hover:text-orange-400"
        )}
        aria-hidden
      />
      <span className="relative z-[1] min-w-0 flex-1 truncate">{label}</span>
    </Link>
  )
})

/**
 * Authenticated recruiter workspace — isolated from coach/player shell chrome.
 */
export function RecruiterDashboardSidebar() {
  const identity = useDashboardShellIdentity()
  const pathname = usePathname() ?? ""

  const homeHref = portalPrefixedDashboardHref("recruiter", "/")
  const messagesHref = portalPrefixedDashboardHref("recruiter", "/messages")
  const supportHref = portalPrefixedDashboardHref("recruiter", "/support")
  const profileHref = portalPrefixedDashboardHref("recruiter", "/profile")

  const stripped = stripDashboardPortalPrefix(pathname.split("?")[0] ?? pathname)
  const normalizedPath = pathname.replace(/\/$/, "") || pathname

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#0f172a]">
      <ScrollFadeContainer
        variant="dark"
        fadeHeight="h-8"
        className="flex min-h-0 flex-1 flex-col"
        scrollClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-scroll"
      >
        <div className="relative flex-shrink-0 border-b border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-transparent to-transparent px-4 pb-4 pt-6">
          <SidebarSectionLabel>Recruiting</SidebarSectionLabel>
          <p className="mt-1 truncate text-sm font-semibold text-slate-100">Recruiter Portal</p>
          {identity.displayName ? (
            <p className="mt-1 truncate text-xs text-slate-400">{identity.displayName}</p>
          ) : null}
        </div>

        <div className="border-b border-slate-700/50 px-4 py-4">
          <SidebarSectionLabel>Main</SidebarSectionLabel>
          <nav className="flex flex-col gap-2" aria-label="Primary">
            <SidebarNavItem
              href={homeHref}
              label="Dashboard"
              icon={LayoutDashboard}
              isActive={
                stripped === "/dashboard/recruiting" ||
                pathname.startsWith("/dashboard/recruiter") ||
                normalizedPath === "/dashboard/recruiting"
              }
            />
            <SidebarNavItem
              href={messagesHref}
              label="Messages"
              icon={MessageSquare}
              isActive={normalizedPath.startsWith(messagesHref)}
            />
            <SidebarNavItem
              href={profileHref}
              label="Profile"
              icon={User}
              isActive={normalizedPath.startsWith(profileHref)}
            />
            <SidebarNavItem
              href={supportHref}
              label="Support"
              icon={LifeBuoy}
              isActive={normalizedPath.startsWith(supportHref)}
            />
          </nav>
        </div>

        <div className="border-b border-slate-700/50 px-4 py-4">
          <SidebarSectionLabel>Public</SidebarSectionLabel>
          <Link
            href="/recruiting"
            prefetch={false}
            className="flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white"
          >
            <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            Browse athletes
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-end px-4 pb-4 pt-6">
          <div className="flex justify-center opacity-90">
            <Image
              src="/braik-logo.webp"
              alt=""
              width={320}
              height={160}
              className="h-10 w-auto object-contain opacity-80"
            />
          </div>
        </div>
      </ScrollFadeContainer>

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
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
