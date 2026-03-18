"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, Calendar, MessageSquare, Menu } from "lucide-react"
import { useMobileDashboardNav } from "@/components/portal/mobile-dashboard-nav-provider"

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, match: (p: string) => p === "/dashboard" },
  {
    href: "/dashboard/roster",
    label: "Roster",
    icon: Users,
    match: (p: string) => p.startsWith("/dashboard/roster"),
  },
  {
    href: "/dashboard/schedule",
    label: "Schedule",
    icon: Calendar,
    match: (p: string) => p.startsWith("/dashboard/schedule"),
  },
  {
    href: "/dashboard/messages",
    label: "Messages",
    icon: MessageSquare,
    match: (p: string) => p.startsWith("/dashboard/messages"),
  },
] as const

/**
 * Phone only (< md). Tablet/desktop use header menu + sidebar (lg+).
 */
export function DashboardMobileTabBar() {
  const pathname = usePathname() ?? ""
  const { openDrawer } = useMobileDashboardNav()

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:hidden",
        "border-t border-[rgb(var(--border))] bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom,0px)]",
        "transition-opacity duration-200"
      )}
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0 px-1 pt-1">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5",
                "transition-colors active:bg-[rgb(var(--platinum))]",
                active ? "text-[rgb(var(--accent))]" : "text-[rgb(var(--muted))]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.25px]")} aria-hidden />
              <span className="max-w-full truncate text-[10px] font-semibold leading-tight">{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={openDrawer}
          className={cn(
            "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5",
            "text-[rgb(var(--muted))] transition-colors active:bg-[rgb(var(--platinum))]"
          )}
          aria-label="Open full menu"
        >
          <Menu className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-[10px] font-semibold leading-tight">More</span>
        </button>
      </div>
    </nav>
  )
}
