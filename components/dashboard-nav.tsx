"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { TeamSwitcher } from "@/components/team-switcher"

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
  const userRole = session?.user?.role
  const isPlatformOwner = session?.user?.isPlatformOwner || false

  // Top navigation: Dashboard, Invoice, Settings, and Admin
  // Roster, Schedule, Messages, Documents, and Inventory are in quick actions sidebar
  // Platform Owner is a flag, not a role - Platform Owners may also have team roles (e.g., HEAD_COACH)
  const topNavItems: Array<{
    href: string
    label: string
    roles?: string[]
    isPlatformOwnerOnly?: boolean
  }> = [
    { href: "/dashboard", label: "Dashboard", roles: ["HEAD_COACH", "ASSISTANT_COACH", "PLAYER", "PARENT"] },
    { href: "/dashboard/invoice", label: "Invoice", roles: ["HEAD_COACH", "PLAYER", "PARENT"] },
    { href: "/dashboard/settings", label: "Settings", roles: ["HEAD_COACH"] },
    { href: "/admin/dashboard", label: "Admin", isPlatformOwnerOnly: true },
  ]

  // Filter nav items based on user role and Platform Owner flag
  // Platform Owners see all items their team role allows, plus Admin
  const navItems = topNavItems.filter((item) => {
    // Admin is only for Platform Owners
    if (item.isPlatformOwnerOnly) {
      return isPlatformOwner
    }
    // Regular role-based filtering
    return userRole && item.roles?.includes(userRole)
  })

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
      <div className="w-full px-4">
        <div className="flex items-center py-1">
          {/* Logo - Far Left */}
          <div className="flex-shrink-0">
            <Link 
              href="/dashboard" 
              className="flex items-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1E293B] rounded transition-all"
              aria-label="Braik - Return to dashboard"
            >
              <div className="h-12 w-[200px] overflow-hidden flex items-center">
                <Image 
                  src="/braik-logo.png" 
                  alt="Braik Logo" 
                  width={720} 
                  height={360} 
                  className="w-full h-auto object-contain object-left"
                />
              </div>
            </Link>
          </div>
          
          {/* Navigation Links - Centered */}
          <div className="flex-1 flex justify-center items-center gap-6">
            {teams.length > 1 && (
              <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
            )}
            <div className="hidden md:flex items-center gap-4 flex-wrap">
              {navItems.map((item) => {
                // Check if current path matches (exact match or starts with for nested routes)
                const isActive = pathname === item.href || 
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-sm font-medium transition-colors px-3 py-2 rounded-md",
                      isActive
                        ? "font-semibold border-b-2"
                        : "hover:bg-[rgb(var(--platinum))]"
                    )}
                    style={{
                      color: isActive ? "rgb(var(--text))" : "rgb(var(--text))",
                      borderBottomColor: isActive ? "rgb(var(--accent))" : "transparent"
                    }}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
          
          {/* User Controls - Far Right */}
          <div className="flex-shrink-0 flex items-center gap-4">
            <ThemeToggle />
            {userRole && (
              <span 
                className="text-xs px-2 py-1 border rounded"
                style={{
                  color: "rgb(var(--text2))",
                  backgroundColor: "#FFFFFF",
                  borderColor: "rgb(var(--border))"
                }}
                title={isPlatformOwner ? "Platform Owner" : undefined}
              >
                {userRole.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                {isPlatformOwner && (
                  <span className="ml-1" style={{ color: "rgb(var(--accent))" }} title="Platform Owner">⚙️</span>
                )}
              </span>
            )}
            <span className="text-sm hidden sm:inline" style={{ color: "rgb(var(--text))" }}>{session?.user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })} style={{ color: "rgb(var(--text))" }}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}

