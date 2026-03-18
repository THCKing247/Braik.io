"use client"

import type { ComponentType } from "react"
import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession, signOut } from "@/lib/auth/client-auth"
import { useCoachB } from "@/components/portal/coach-b-context"
import { getQuickActionsForRole, isPrimaryMobileTabPath } from "@/config/quickActions"
import { cn } from "@/lib/utils"
import { LogOut, Shield, Sparkles, X } from "lucide-react"
import { TeamSwitcher } from "@/components/portal/team-switcher"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

export function DashboardMoreBottomSheet({
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
  const secondaryLinks = useMemo(
    () => quickActions.filter((a) => !isPrimaryMobileTabPath(a.href)),
    [quickActions]
  )

  const dragStartY = useRef<number | null>(null)

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
          "absolute inset-0 z-40 bg-black/40 transition-opacity duration-300",
          visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-label="Close menu"
        onClick={close}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-50 flex max-h-[80vh] min-h-[40vh] flex-col rounded-t-3xl border-t border-border bg-background shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-y-0" : "translate-y-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-sheet-title"
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-3 pb-2 active:cursor-grabbing"
          onTouchStart={(e) => {
            dragStartY.current = e.touches[0].clientY
          }}
          onTouchEnd={(e) => {
            if (dragStartY.current === null) return
            const dy = e.changedTouches[0].clientY - dragStartY.current
            dragStartY.current = null
            if (dy > 56) close()
          }}
        >
          <div className="h-1.5 w-12 rounded-full bg-muted" aria-hidden />
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 pb-3 md:px-6">
          <h2 id="more-sheet-title" className="text-lg font-semibold text-foreground">
            More
          </h2>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:mx-auto md:max-w-2xl md:w-full md:px-8"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {userRole
                ? userRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : "Team"}
            </p>
            {currentTeam?.name && (
              <p className="mt-1 truncate text-base font-semibold text-foreground" title={currentTeam.name}>
                {currentTeam.name}
              </p>
            )}
            <p className="mt-2 truncate text-sm text-muted-foreground">{session?.user?.email}</p>
            {teams.length > 1 && (
              <div className="mt-4 border-t border-border pt-4" onClick={(e) => e.stopPropagation()}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Switch team
                </p>
                <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
              </div>
            )}
          </div>

          <nav className="space-y-2 pb-4" aria-label="More navigation">
            {showAdminLink && (
              <SheetNavRow
                href="/admin/dashboard"
                label="Admin"
                icon={Shield}
                isActive={pathname?.startsWith("/admin") ?? false}
                onNavigate={close}
              />
            )}
            {secondaryLinks.map((action) => (
              <SheetNavRow
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
          </nav>

          <div className="space-y-3 border-t border-border pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                coachB?.open()
                close()
              }}
              className={cn(
                "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-md transition active:scale-[0.99]",
                "bg-[#2563EB] hover:bg-[#1d4ed8]"
              )}
            >
              <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
              Ask Coach B
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className={cn(
                "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition active:scale-[0.99]",
                "bg-[#EF4444] hover:bg-[#DC2626]"
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SheetNavRow({
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
        "flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors md:min-h-[52px] md:px-5",
        isActive
          ? "bg-[rgb(var(--accent))] text-white shadow-sm"
          : "bg-muted/50 text-foreground hover:bg-muted active:bg-muted"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-muted-foreground")} aria-hidden />
      <span>{label}</span>
    </Link>
  )
}
