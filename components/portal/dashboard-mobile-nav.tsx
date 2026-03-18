"use client"

import type { ComponentType } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession, signOut } from "@/lib/auth/client-auth"
import { useCoachB } from "@/components/portal/coach-b-context"
import { getQuickActionsForRole } from "@/config/quickActions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, LogOut, Menu, Shield, Sparkles, X } from "lucide-react"
import { TeamSwitcher } from "@/components/portal/team-switcher"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

export function DashboardMobileNav({
  teams,
  showAdminLink = false,
}: {
  teams: Team[]
  showAdminLink?: boolean
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const coachB = useCoachB()
  const userRole = session?.user?.role
  const searchParams = useSearchParams()
  const currentTeamId = searchParams.get("teamId") || teams[0]?.id || ""
  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]
  const quickActions = getQuickActionsForRole(userRole)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const roleLabel = userRole
    ? userRole.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : ""

  return (
    <div className="flex shrink-0 items-center">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 border-[rgb(var(--border))] bg-white"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" style={{ color: "rgb(var(--text))" }} />
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px]"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 z-[101] flex h-full w-[min(288px,88vw)] max-w-full flex-col overflow-hidden shadow-xl"
            style={{
              background: "linear-gradient(180deg, #0B2A5B 0%, #0f172a 100%)",
              boxShadow: "4px 0 24px rgba(0,0,0,0.15)",
            }}
            aria-label="Mobile navigation"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
              <span className="text-sm font-semibold text-white">Braik</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white hover:bg-white/10"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-shrink-0 space-y-2 border-b border-white/10 p-3">
              {roleLabel && (
                <p className="text-xs font-medium uppercase tracking-wide text-white/70">{roleLabel}</p>
              )}
              {currentTeam?.name && (
                <p className="truncate text-sm font-semibold text-white" title={currentTeam.name}>
                  {currentTeam.name}
                </p>
              )}
              {teams.length > 1 && (
                <div
                  className="rounded-lg bg-white/10 p-2 [&_select]:max-w-full [&_select]:text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-1 text-[10px] font-medium uppercase text-white/60">Team</p>
                  <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
                </div>
              )}
            </div>

            <div className="flex-shrink-0 border-b border-white/10 p-3">
              <div className="rounded-lg bg-white/10 px-3 py-2">
                <p className="truncate text-sm font-medium text-white" title={session?.user?.email}>
                  {session?.user?.name || session?.user?.email || "User"}
                </p>
                <p className="truncate text-xs text-white/70">{session?.user?.email}</p>
              </div>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main">
              <MobileNavLink
                href="/dashboard"
                label="Dashboard"
                icon={LayoutDashboard}
                isActive={pathname === "/dashboard"}
                onNavigate={() => setOpen(false)}
              />
              {showAdminLink && (
                <MobileNavLink
                  href="/admin/dashboard"
                  label="Admin"
                  icon={Shield}
                  isActive={pathname?.startsWith("/admin") ?? false}
                  onNavigate={() => setOpen(false)}
                />
              )}
              {quickActions.map((action) => (
                <MobileNavLink
                  key={action.id}
                  href={action.href}
                  label={action.label}
                  icon={action.icon}
                  isActive={
                    pathname === action.href ||
                    (action.href !== "/dashboard" && pathname.startsWith(action.href))
                  }
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </nav>

            <div className="flex-shrink-0 border-t border-white/10 p-3">
              <button
                type="button"
                onClick={() => {
                  coachB?.open()
                  setOpen(false)
                }}
                className={cn(
                  "mb-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 px-3",
                  "text-sm font-medium text-white bg-[#2563EB] hover:bg-[#3B82F6]",
                  "focus:outline-none focus:ring-2 focus:ring-white/40"
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Ask Coach B
              </button>
              <div className="mb-3 flex justify-center">
                <Image
                  src="/images/ai-chat-icon-tmp.png"
                  alt=""
                  width={72}
                  height={72}
                  className="object-contain opacity-90"
                />
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                  "bg-[#EF4444] text-white hover:bg-[#DC2626]"
                )}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  isActive,
  onNavigate,
}: {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  isActive: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        isActive
          ? "bg-[#2563EB] text-white shadow-md"
          : "text-white/90 hover:bg-white/15"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  )
}
