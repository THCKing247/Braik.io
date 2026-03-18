"use client"

import type { ComponentType } from "react"
import { useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession, signOut } from "@/lib/auth/client-auth"
import { useCoachB } from "@/components/portal/coach-b-context"
import { getQuickActionsForRole, isPrimaryMobileTabPath } from "@/config/quickActions"
import { useMinWidthMd } from "@/lib/hooks/use-min-width-md"
import { useMinWidthLg } from "@/lib/hooks/use-min-width-lg"
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
  const quickActions = useMemo(() => getQuickActionsForRole(userRole), [userRole])
  const isMd = useMinWidthMd()
  const isLg = useMinWidthLg()
  const isTablet = isMd && !isLg

  const phoneSheetLinks = useMemo(
    () => quickActions.filter((a) => !isPrimaryMobileTabPath(a.href)),
    [quickActions]
  )

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
    <div
      className={cn(
        "fixed inset-0 z-[100] lg:hidden",
        visible ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-label="Close menu"
        onClick={close}
      />
      <aside
        className={cn(
          "absolute left-0 top-0 flex h-full max-h-[100dvh] w-[85%] max-w-[320px] flex-col overflow-hidden rounded-r-2xl shadow-xl transition-transform duration-300 ease-out",
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
        <div className="flex min-h-[52px] shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-semibold tracking-tight text-white">Menu</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 text-white hover:bg-white/15"
            onClick={close}
            aria-label="Close menu"
          >
            <X className="h-6 w-6" aria-hidden />
          </Button>
        </div>

        <div className="shrink-0 space-y-3 border-b border-white/10 p-4">
          <div className="rounded-xl bg-white/10 px-3 py-3">
            {roleLabel && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{roleLabel}</p>
            )}
            {currentTeam?.name && (
              <p className="mt-0.5 truncate text-sm font-semibold text-white" title={currentTeam.name}>
                {currentTeam.name}
              </p>
            )}
            <p className="mt-2 truncate text-sm text-white/90" title={session?.user?.email}>
              {session?.user?.name || session?.user?.email || "Account"}
            </p>
            <p className="truncate text-xs text-white/70">{session?.user?.email}</p>
          </div>
          {teams.length > 1 && (
            <div
              className="rounded-xl bg-white/10 p-3 [&_select]:max-w-full [&_select]:text-sm [&_select]:text-[#0f172a]"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                Switch team
              </p>
              <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
            </div>
          )}
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 touch-scroll"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {isTablet && (
            <div className="mb-6 space-y-1">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
                Main
              </p>
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
                    pathname === action.href ||
                    (action.href !== "/dashboard" && pathname.startsWith(action.href))
                  }
                  onNavigate={close}
                />
              ))}
            </div>
          )}

          {!isTablet && (
            <div className="space-y-1">
              {showAdminLink && (
                <>
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
                    Account
                  </p>
                  <DrawerNavLink
                    href="/admin/dashboard"
                    label="Admin"
                    icon={Shield}
                    isActive={pathname?.startsWith("/admin") ?? false}
                    onNavigate={close}
                  />
                </>
              )}
              <p className={cn("mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-white/55", showAdminLink && "mt-4")}>
                More
              </p>
              {phoneSheetLinks.map((action) => (
                <DrawerNavLink
                  key={action.id}
                  href={action.href}
                  label={action.label}
                  icon={action.icon}
                  isActive={
                    pathname === action.href ||
                    (action.href !== "/dashboard" && pathname.startsWith(action.href))
                  }
                  onNavigate={close}
                />
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-white/10 bg-[#0a2249]/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              coachB?.open()
              close()
            }}
            className={cn(
              "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white",
              "bg-[#2563EB] shadow-md transition active:bg-[#1d4ed8]"
            )}
          >
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
            Ask Coach B
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className={cn(
              "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white",
              "bg-[#EF4444] transition active:bg-[#DC2626]"
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
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
        "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
        isActive
          ? "bg-[#2563EB] text-white shadow-md ring-1 ring-white/25"
          : "text-white/[0.92] hover:bg-white/12 active:bg-white/15"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
    </Link>
  )
}
