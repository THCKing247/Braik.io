"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession, signOut } from "@/lib/auth/client-auth"
import { useCoachB } from "@/components/portal/coach-b-context"
import { getQuickActionsForRole, type QuickAction } from "@/config/quickActions"
import { cn } from "@/lib/utils"
import { LayoutDashboard, LogOut, MessageSquare, Sparkles } from "lucide-react"

const SIDEBAR_WIDTH = 240

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

export function DashboardSidebar({ teams }: { teams: Team[] }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const coachB = useCoachB()
  const userRole = session?.user?.role
  const currentTeamId = searchParams.get("teamId") || teams[0]?.id
  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]
  const quickActions = getQuickActionsForRole(userRole)

  const roleLabel = userRole
    ? userRole.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : ""

  return (
    <aside
      className="flex flex-col flex-shrink-0 w-[240px] h-full min-h-0 overflow-hidden z-40"
      style={{
        background: "linear-gradient(180deg, #0B2A5B 0%, #0f172a 100%)",
        boxShadow: "4px 0 24px rgba(0,0,0,0.08)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
      }}
      aria-label="Dashboard navigation"
    >
      {/* Top: role + team (main Braik logo stays in header only) */}
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        {roleLabel && (
          <p className="text-xs font-medium text-white/70 uppercase tracking-wide">
            {roleLabel}
          </p>
        )}
        {currentTeam?.name && (
          <p className="text-sm font-semibold text-white mt-0.5 truncate" title={currentTeam.name}>
            {currentTeam.name}
          </p>
        )}
      </div>

      {/* User block */}
      <div className="flex-shrink-0 p-3 border-b border-white/10">
        <div className="rounded-lg bg-white/10 px-3 py-2">
          <p className="text-sm font-medium text-white truncate" title={session?.user?.email}>
            {session?.user?.name || session?.user?.email || "User"}
          </p>
          <p className="text-xs text-white/70 truncate">{session?.user?.email}</p>
        </div>
      </div>

      {/* Main nav: flex-1 + min-h-0 so it fills space and scrolls if needed; Coach B stays at bottom */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5" aria-label="Main navigation">
        <SidebarNavItem
          href="/dashboard"
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
            isActive={pathname === action.href || (action.href !== "/dashboard" && pathname.startsWith(action.href))}
          />
        ))}
      </nav>

      {/* Coach B section: flex-shrink-0 so it stays anchored near bottom */}
      <div className="flex-shrink-0 p-3 border-t border-white/10">
        <div
          className={cn(
            "rounded-xl p-4 transition-all duration-200 overflow-hidden",
            "bg-white/10 hover:bg-white/15 border border-white/10"
          )}
        >
          <div className="flex justify-center mb-3">
            <Image
              src="/images/ai-chat-icon-tmp.png"
              alt="Coach B clipboard mascot"
              width={140}
              height={140}
              className="object-contain"
            />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-5 w-5 text-[#93C5FD] flex-shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-white">Coach B</span>
          </div>
          <p className="text-xs text-white/80 mb-3">
            Ask about your team, schedule, or get help with tasks.
          </p>
          <button
            type="button"
            onClick={() => coachB?.open()}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-lg py-2.5 px-3",
              "text-sm font-medium text-white bg-[#2563EB] hover:bg-[#3B82F6]",
              "focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#0B2A5B]",
              "transition-colors shadow-sm"
            )}
            aria-label="Ask Coach B"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Ask Coach B
          </button>
        </div>
      </div>

      {/* Footer: sign out + branding */}
      <div className="flex-shrink-0 p-3 border-t border-white/10 space-y-2">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
            "text-white/90 hover:bg-white/15 hover:text-white transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0B2A5B]"
          )}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
        <p className="text-xs text-white/50 text-center">Braik</p>
      </div>
    </aside>
  )
}

function SidebarNavItem({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string
  label: string
  icon: QuickAction["icon"]
  isActive: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0B2A5B]",
        isActive
          ? "bg-[#2563EB] text-white shadow-md border border-white/20"
          : "text-white/90 hover:bg-white/15 hover:text-white"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  )
}

export const DASHBOARD_SIDEBAR_WIDTH = SIDEBAR_WIDTH
