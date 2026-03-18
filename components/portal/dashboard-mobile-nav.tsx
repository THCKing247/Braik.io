"use client"

import { useMobileDashboardNav } from "@/components/portal/mobile-dashboard-nav-provider"
import { cn } from "@/lib/utils"
import { Menu } from "lucide-react"

export function DashboardMobileNav({
  teams: _teams,
  showAdminLink: _showAdminLink,
}: {
  teams: unknown[]
  showAdminLink?: boolean
}) {
  const { openDrawer } = useMobileDashboardNav()

  return (
    <button
      type="button"
      onClick={openDrawer}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition active:scale-[0.97]",
        "border-[rgb(var(--border))] bg-white shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2"
      )}
      aria-label="Open navigation menu"
    >
      <Menu className="h-6 w-6" style={{ color: "rgb(var(--text))" }} aria-hidden />
    </button>
  )
}
