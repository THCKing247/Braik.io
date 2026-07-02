"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Home, Calendar, MessageSquare, Shield, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { braikPlayerChrome } from "@/components/portal/player-portal/braik-player-visual-tokens"
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { playerFilmHubRoot } from "@/lib/player-portal/player-development-routes"

export function PlayerPortalChrome({
  children,
  teamStatus,
}: {
  children: React.ReactNode
  teamStatus?: string | null
}) {
  const { accountSegment } = usePlayerPortal()
  const base = `/player/${encodeURIComponent(accountSegment)}`
  const pathname = usePathname() ?? ""

  const items = [
    {
      href: base,
      label: "Feed",
      icon: Home,
      match: (p: string) => p === base || p === `${base}/`,
      unread: false,
    },
    {
      href: `${base}/calendar`,
      label: "Schedule",
      icon: Calendar,
      match: (p: string) => p.startsWith(`${base}/calendar`),
      unread: false,
    },
    {
      href: `${base}/messages`,
      label: "Chats",
      icon: MessageSquare,
      match: (p: string) => p.startsWith(`${base}/messages`),
      unread: true,
    },
    {
      href: playerFilmHubRoot(accountSegment),
      label: "Team",
      icon: Shield,
      match: (p: string) =>
        p.startsWith(`${base}/prep`) ||
        p.startsWith(`${base}/film-room`) ||
        p.startsWith(`${base}/study-guides`) ||
        p.startsWith(`${base}/playbooks`),
      unread: false,
    },
    {
      href: `${base}/profile`,
      label: "Profile",
      icon: UserRound,
      match: (p: string) => p.startsWith(`${base}/profile`),
      unread: false,
    },
  ]

  return (
    <div className={cn("flex min-h-[100dvh] flex-col", braikPlayerChrome.shell)}>
      {/* ambient bloom backgrounds */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: braikPlayerChrome.bloomWarm }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: braikPlayerChrome.bloomCool }}
        aria-hidden
      />

      <header
        className={cn(
          "relative z-20 shrink-0 border-b px-4 py-2.5 backdrop-blur-sm",
          braikPlayerTheme.header
        )}
      >
        <PlayerPortalHeaderInner />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-28 pt-4">
        <SuspensionBanner teamStatus={teamStatus} />
        {children}
      </main>

      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 flex items-center border-t px-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-[18px]",
          braikPlayerTheme.nav
        )}
        aria-label="Player portal primary navigation"
      >
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-1">
          {items.map(({ href, label, icon: Icon, match, unread }) => {
            const active = match(pathname)
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-0.5 font-body text-[9.5px] font-bold uppercase tracking-[0.08em] transition-colors",
                  active ? "text-[#FF7A33]" : "text-[#92A5CC]"
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-11 items-center justify-center rounded-xl transition-all duration-[180ms]",
                    active
                      ? "bg-gradient-to-br from-[#FF7A33] to-[#FF3D1F] shadow-[0_8px_20px_-6px_rgba(255,90,30,0.7)]"
                      : ""
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-[#160A02]" : "text-[#92A5CC]"
                    )}
                    aria-hidden
                  />
                  {unread && !active && (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-[#060D22] bg-[#FF3D1F]"
                      aria-hidden
                    />
                  )}
                </span>
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function PlayerPortalHeaderInner() {
  const { teamName, sport, userName } = usePlayerPortal()

  const initials = (userName ?? "")
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "BA"

  const teamInitial = teamName?.trim().charAt(0).toUpperCase() ?? "B"

  return (
    <div className="mx-auto flex max-w-3xl items-center gap-3">
      {/* crest */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#FF7A33] to-[#FF3D1F] font-black text-[17px] text-[#160A02]"
        style={{ boxShadow: "0 6px 18px -6px rgba(255,90,30,0.7)" }}
        aria-hidden
      >
        {teamInitial}
      </div>

      {/* wordmark */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-[16px] uppercase tracking-[0.04em] text-[#EEF3FF]">
          {teamName}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#92A5CC]">
          {sport?.trim() || "Football"}
        </p>
      </div>

      {/* notification bell */}
      <button
        type="button"
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[rgba(125,155,255,0.14)] bg-white/[0.04] text-[#EEF3FF] transition hover:bg-white/[0.08]"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        <span
          className="absolute right-[8px] top-[7px] h-[9px] w-[9px] rounded-full border-2 border-[#060D22] bg-[#FF3D1F]"
          aria-hidden
        />
      </button>

      {/* user avatar */}
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-[rgba(125,155,255,0.14)] bg-gradient-to-br from-[#2C4E9E] to-[#152B63] text-[12px] font-black text-[#EEF3FF]">
        {initials}
      </div>
    </div>
  )
}
