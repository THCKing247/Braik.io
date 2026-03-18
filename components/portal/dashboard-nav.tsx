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

const navBarStyle = {
  backgroundColor: "#FFFFFF" as const,
  borderColor: "rgb(var(--border))",
  borderWidth: "1px" as const,
  borderTop: "none" as const,
  borderLeft: "none" as const,
  borderRight: "none" as const,
}

export function DashboardNav({ teams }: { teams: Team[] }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTeamId = searchParams.get("teamId") || teams[0]?.id || ""
  const isPlatformOwner = session?.user?.isPlatformOwner || false
  const showAdminLink = isPlatformOwner

  return (
    <>
      {/* Mobile / tablet &lt; md: single compact bar + slide-out (drawer lives in DashboardMobileNav) */}
      <nav
        className="sticky top-0 z-50 flex w-full min-w-0 max-w-full flex-col overflow-x-hidden border-b shadow-[0_1px_0_rgba(0,0,0,0.04)] md:hidden"
        style={{
          ...navBarStyle,
          paddingTop: "max(0.375rem, env(safe-area-inset-top, 0px))",
        }}
        aria-label="App navigation"
      >
        <div className="flex min-h-[44px] w-full min-w-0 max-w-full items-center gap-2 px-3 pb-2 sm:px-4">
          <DashboardMobileNav teams={teams} showAdminLink={showAdminLink} />
          <div className="min-w-0 flex-1">
            <Link
              href="/dashboard"
              className="mx-auto flex max-w-full min-w-0 justify-center active:opacity-80"
              aria-label="Braik - Return to dashboard"
            >
              <div className="flex h-8 max-h-9 w-auto max-w-[min(148px,40vw)] items-center overflow-hidden sm:h-9">
                <Image
                  src="/braik-logo.png"
                  alt="Braik"
                  width={720}
                  height={360}
                  className="h-auto w-full object-contain object-center"
                  priority
                />
              </div>
            </Link>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center [&_button]:h-10 [&_button]:w-10">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Desktop md+: original full header (unchanged structure) */}
      <nav
        className="sticky top-0 z-50 hidden w-full min-w-0 max-w-full flex-col overflow-x-hidden border-b md:flex"
        style={navBarStyle}
        aria-label="App navigation"
      >
        <div className="flex w-full min-w-0 max-w-full items-center gap-3 px-4 py-2 md:px-6">
          <div className="shrink-0">
            <Link
              href="/dashboard"
              className="flex items-center rounded transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1E293B]"
              aria-label="Braik - Return to dashboard"
            >
              <div className="flex h-12 w-[200px] items-center overflow-hidden">
                <Image
                  src="/braik-logo.png"
                  alt="Braik Logo"
                  width={720}
                  height={360}
                  className="h-auto w-full object-contain object-left"
                />
              </div>
            </Link>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-center">
            {teams.length > 1 && (
              <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
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
                  borderBottomColor: pathname?.startsWith("/admin")
                    ? "rgb(var(--accent))"
                    : "transparent",
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
        </div>
      </nav>
    </>
  )
}
