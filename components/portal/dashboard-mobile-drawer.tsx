"use client"

import type { ComponentType } from "react"
import { useEffect, useLayoutEffect, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession, signOut } from "@/lib/auth/client-auth"
import { useCoachB } from "@/components/portal/coach-b-context"
import { getQuickActionsForRole } from "@/config/quickActions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, LogOut, Shield, Sparkles, X } from "lucide-react"
import { TeamSwitcher } from "@/components/portal/team-switcher"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

export function DashboardMobileDrawer({
  open,
  onOpenChange,
  teams,
  showAdminLink = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teams: Team[]
  showAdminLink?: boolean
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const coachB = useCoachB()
  const userRole = session?.user?.role
  const searchParams = useSearchParams()
  const currentTeamId = searchParams.get("teamId") || teams[0]?.id || ""
  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]
  const quickActions = getQuickActionsForRole(userRole)

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  useLayoutEffect(() => {
    if (open) setMounted(true)
    else setVisible(false)
  }, [open])

  useEffect(() => {
    if (!open) {
      const id = window.setTimeout(() => setMounted(false), 320)
      return () => clearTimeout(id)
    }
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [open])

  useEffect(() => {
    if (!mounted || !visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted, visible])

  useEffect(() => {
    close()
  }, [pathname, close])

  const roleLabel = userRole
    ? userRole.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : ""

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-[100] md:hidden" aria-hidden={!visible}>
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out",
          visible ? "opacity-100" : "opacity-0"
        )}
        aria-label="Close menu"
        onClick={close}
      />
      <aside
        className={cn(
          "absolute left-0 top-0 flex h-full max-h-[100dvh] w-[min(300px,90vw)] max-w-full flex-col overflow-hidden shadow-2xl transition-transform duration-300 ease-out",
          "pt-[env(safe-area-inset-top,0px)]",
          visible ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: "linear-gradient(180deg, #0B2A5B 0%, #0f172a 100%)",
          boxShadow: "8px 0 32px rgba(0,0,0,0.25)",
        }}
        aria-label="Navigation menu"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex min-h-[3rem] items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-base font-semibold tracking-tight text-white">Menu</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 text-white hover:bg-white/10 active:bg-white/15"
            onClick={close}
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex-shrink-0 space-y-2 border-b border-white/10 px-4 py-3">
          {roleLabel && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{roleLabel}</p>
          )}
          {currentTeam?.name && (
            <p className="truncate text-sm font-semibold text-white" title={currentTeam.name}>
              {currentTeam.name}
            </p>
          )}
          {teams.length > 1 && (
            <div
              className="rounded-xl bg-white/10 p-3 [&_select]:max-w-full [&_select]:text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">Switch team</p>
              <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-b border-white/10 px-4 py-3">
          <div className="rounded-xl bg-white/10 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-white" title={session?.user?.email}>
              {session?.user?.name || session?.user?.email || "User"}
            </p>
            <p className="truncate text-xs text-white/65">{session?.user?.email}</p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Main">
          <DrawerNavLink
            href="/dashboard"
            label="Dashboard"
            icon={LayoutDashboard}
            isActive={pathname === "/dashboard"}
            onNavigate={close}
          />
          {showAdminLink && (
            <DrawerNavLink
              href="/admin/dashboard"
              label="Admin"
              icon={Shield}
              isActive={pathname?.startsWith("/admin") ?? false}
              onNavigate={close}
            />
          )}
          {quickActions.map((action) => (
            <DrawerNavLink
              key={action.id}
              href={action.href}
              label={action.label}
              icon={action.icon}
              isActive={
                pathname === action.href || (action.href !== "/dashboard" && pathname.startsWith(action.href))
              }
              onNavigate={close}
            />
          ))}
        </nav>

        <div className="flex-shrink-0 space-y-3 border-t border-white/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              coachB?.open()
              close()
            }}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white",
              "bg-[#2563EB] shadow-lg shadow-blue-900/30 transition active:scale-[0.98] active:bg-[#1d4ed8]"
            )}
          >
            <Sparkles className="h-5 w-5" aria-hidden />
            Ask Coach B
          </button>
          <div className="flex justify-center opacity-90">
            <Image src="/images/ai-chat-icon-tmp.png" alt="" width={64} height={64} className="object-contain" />
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold",
              "bg-[#EF4444] text-white transition active:scale-[0.98] active:bg-[#DC2626]"
            )}
          >
            <LogOut className="h-5 w-5" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>
    </div>
  )
}

function DrawerNavLink({
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
        "flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors active:bg-white/10",
        isActive
          ? "bg-[#2563EB] text-white shadow-md ring-1 ring-white/20"
          : "text-white/92 hover:bg-white/12"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isActive && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white shadow-sm" aria-hidden />
      )}
    </Link>
  )
}
