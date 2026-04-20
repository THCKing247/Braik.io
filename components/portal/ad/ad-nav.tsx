"use client"

import Link from "next/link"
import { prefetchPropForDashboardScheduleHref } from "@/lib/navigation/dashboard-schedule-prefetch"
import Image from "next/image"
import { signOut } from "@/lib/auth/client-auth"
import { Button } from "@/components/ui/button"
import { useAdAppBootstrapOptional } from "@/components/portal/ad-app-bootstrap-context"
import type { AdPortalTabVisibility } from "@/lib/enforcement/football-ad-access"
import { AppLoader } from "@/components/ui/app-loader"

const fullOwnerNav: {
  href: string
  label: string
  key: "showOverview" | "showTeams" | "showCoaches" | "showSettings"
}[] = [
  { href: "/dashboard/ad", label: "Overview", key: "showOverview" },
  { href: "/dashboard/ad/teams", label: "Teams", key: "showTeams" },
  { href: "/dashboard/ad/coaches", label: "Coaches", key: "showCoaches" },
  { href: "/dashboard/ad/settings", label: "Settings", key: "showSettings" },
]

const defaultTabVisibility: AdPortalTabVisibility = {
  showOverview: true,
  showTeams: true,
  showCoaches: true,
  showSettings: true,
  homeHref: "/dashboard/ad",
}

/** Top bar placeholder while AD bootstrap is in flight (shell no longer blocks page mount). */
export function AdNavShellSkeleton() {
  return (
    <nav
      className="sticky top-0 z-50 border-b bg-white"
      style={{ borderColor: "rgb(var(--border))" }}
      aria-busy
      aria-label="Loading navigation"
    >
      <div className="mx-auto px-4">
        <div className="flex min-h-20 items-center justify-between py-2">
          <AppLoader label="Loading navigation" size="md" />
        </div>
      </div>
    </nav>
  )
}

export function AdNav({
  userEmail: userEmailProp,
  tabVisibility: tabVisibilityProp,
}: {
  userEmail?: string | null
  tabVisibility?: AdPortalTabVisibility
}) {
  const ad = useAdAppBootstrapOptional()
  const tabVisibility =
    ad?.payload?.flags.tabVisibility ?? tabVisibilityProp ?? defaultTabVisibility
  const userEmail = ad?.payload?.user.email ?? userEmailProp
  const navItems = fullOwnerNav.filter((item) => Boolean(tabVisibility[item.key]))
  const homeHref = tabVisibility.homeHref

  return (
    <nav
      className="sticky top-0 z-50 border-b bg-white"
      style={{ borderColor: "rgb(var(--border))" }}
    >
      <div className="mx-auto px-4">
        <div className="flex min-h-20 items-center justify-between py-2">
          <div className="flex items-center gap-8">
            <Link
              href={homeHref}
              prefetch={prefetchPropForDashboardScheduleHref(homeHref)}
              className="flex items-center gap-2"
            >
              <Image
                src="/braik-logo.webp"
                alt="Braik"
                width={480}
                height={320}
                className="h-[4.5rem] w-auto object-contain"
                sizes="180px"
              />
              <span className="text-sm font-semibold text-[#6B7280] hidden sm:inline">Athletic Director</span>
            </Link>
            <div className="hidden md:flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={prefetchPropForDashboardScheduleHref(item.href)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-[#495057] hover:bg-[#F3F4F6] hover:text-[#212529]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userEmail && (
              <span className="text-sm text-[#6B7280] truncate max-w-[180px]">{userEmail}</span>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
