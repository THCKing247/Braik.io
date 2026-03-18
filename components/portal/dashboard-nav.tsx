"use client"

import { useSession, signOut } from "@/lib/auth/client-auth"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { cn } from "@/lib/utils"
import { TeamSwitcher } from "@/components/portal/team-switcher"
import { DashboardMobileNav } from "@/components/portal/dashboard-mobile-nav"

interface Team {
  id: string
  name: string
  organization: {
    name: string
  }
  sport: string
  seasonName: string
}

export function DashboardNav({ teams }: { teams: Team[] }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTeamId = searchParams.get("teamId") || teams[0]?.id || ""
  const isPlatformOwner = session?.user?.isPlatformOwner || false

  // Dashboard, Invoice, and Settings live in the left sidebar; only Admin remains in top nav for Platform Owners
  const showAdminLink = isPlatformOwner

  return (
    <nav 
      className="border-b sticky top-0 z-50"
      style={{ 
        backgroundColor: "#FFFFFF",
        borderColor: "rgb(var(--border))",
        borderWidth: "1px",
        borderTop: "none",
        borderLeft: "none",
        borderRight: "none"
      }}
    >
      <div className="w-full min-w-0 px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2 py-1.5 md:gap-3 md:py-2">
          <DashboardMobileNav teams={teams} showAdminLink={showAdminLink} />

          {/* Logo */}
          <div className="min-w-0 flex-1 md:flex-initial">
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center rounded transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1E293B]"
              aria-label="Braik - Return to dashboard"
            >
              <div className="flex h-9 max-w-[140px] items-center overflow-hidden md:h-12 md:max-w-none md:w-[200px]">
                <Image
                  src="/braik-logo.png"
                  alt="Braik Logo"
                  width={720}
                  height={360}
                  className="h-auto w-full max-w-[200px] object-contain object-left md:max-w-none"
                />
              </div>
            </Link>
          </div>

          {/* Center: team switcher (desktop / tablet md+) */}
          <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
            {teams.length > 1 && (
              <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
            )}
          </div>

          {/* User controls — full bar on md+ */}
          <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex md:gap-3">
            {showAdminLink && (
              <Link
                href="/admin/dashboard"
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname?.startsWith("/admin")
                    ? "border-b-2 font-semibold"
                    : "hover:bg-[rgb(var(--platinum))]"
                )}
                style={{
                  color: "rgb(var(--text))",
                  borderBottomColor: pathname?.startsWith("/admin") ? "rgb(var(--accent))" : "transparent",
                }}
              >
                Admin
              </Link>
            )}
            <ThemeToggle />
            <Button variant="destructive" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign Out
            </Button>
          </div>

          {/* Mobile: theme only (menu + sign out live in drawer) */}
          <div className="ml-auto flex shrink-0 items-center md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  )
}

