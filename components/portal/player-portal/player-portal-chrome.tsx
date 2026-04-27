"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Home, LogOut, MessageSquare, Shield, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { signOut } from "@/lib/auth/client-auth"
import { braikPlayerChrome } from "@/components/portal/player-portal/braik-player-visual-tokens"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { playerFilmHubRoot } from "@/lib/player-portal/player-development-routes"
import { braikLogo } from "@/lib/marketing/landing-images"

function navLinkClass(active: boolean) {
  return cn(
    "flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors min-w-[3.5rem]",
    active
      ? "bg-white text-orange-900 shadow-lg shadow-orange-500/25 ring-1 ring-white/70 [&_svg]:text-orange-600"
      : "text-white/85 hover:bg-white/10 [&_svg]:text-white"
  )
}

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

  /** First tab = primary feed screen (`/player/:id`). */
  const items = [
    {
      href: base,
      label: "Feed",
      icon: Home,
      match: (p: string) => p === base || p === `${base}/`,
    },
    { href: `${base}/calendar`, label: "Calendar", icon: Calendar, match: (p: string) => p.startsWith(`${base}/calendar`) },
    { href: `${base}/messages`, label: "Messages", icon: MessageSquare, match: (p: string) => p.startsWith(`${base}/messages`) },
    {
      href: playerFilmHubRoot(accountSegment),
      label: "Team",
      icon: Shield,
      match: (p: string) =>
        p.startsWith(`${base}/prep`) ||
        p.startsWith(`${base}/film-room`) ||
        p.startsWith(`${base}/study-guides`) ||
        p.startsWith(`${base}/playbooks`),
    },
    { href: `${base}/profile`, label: "Profile", icon: UserRound, match: (p: string) => p.startsWith(`${base}/profile`) },
  ]

  return (
    <div className={cn("flex min-h-[100dvh] flex-col", braikPlayerChrome.shell)}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: braikPlayerChrome.bloomCool }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: braikPlayerChrome.bloomWarm }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: braikPlayerChrome.bloomAccent }}
        aria-hidden
      />

      <header className="relative z-20 shrink-0 border-b border-sky-500/15 bg-black/25 px-4 py-3.5 backdrop-blur-xl">
        <PlayerPortalHeaderInner />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-28 pt-4">
        <SuspensionBanner teamStatus={teamStatus} />
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-sky-500/20 bg-[#040a12]/94 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_-18px_rgba(0,0,0,0.72)] backdrop-blur-xl"
        aria-label="Player portal primary navigation"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-1">
          {items.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <Link key={href} href={href} className={navLinkClass(active)} prefetch={false}>
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function playerPortalSectionEyebrow(pathname: string, base: string): string {
  const p = pathname.split("?")[0] ?? pathname
  if (p === base || p === `${base}/`) return "Feed"
  if (p.startsWith(`${base}/prep`)) return "Team"
  if (p.startsWith(`${base}/calendar`)) return "Calendar"
  if (p.startsWith(`${base}/messages`)) return "Messages"
  if (p.startsWith(`${base}/profile`)) return "Profile"
  if (p.startsWith(`${base}/announcements`)) return "News"
  if (p.startsWith(`${base}/reminders`)) return "Alerts"
  return "Feed"
}

function PlayerPortalHeaderInner() {
  const pathname = usePathname() ?? ""
  const { teamName, sport, accountSegment } = usePlayerPortal()
  const base = `/player/${encodeURIComponent(accountSegment)}`
  const eyebrow = playerPortalSectionEyebrow(pathname, base)

  return (
    <div className="mx-auto flex max-w-3xl items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300/95">{eyebrow}</p>
        <h1 className="truncate bg-gradient-to-r from-sky-100 via-amber-100 to-orange-100 bg-clip-text text-xl font-black text-transparent drop-shadow-sm">
          {teamName}
        </h1>
        {sport?.trim() ? <p className="text-sm font-medium text-white/70">{sport}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4 text-amber-300" aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
          <span className="sm:hidden">Out</span>
        </button>
        <Image
          src={braikLogo.webp}
          alt="Braik"
          width={braikLogo.width}
          height={braikLogo.height}
          className="h-9 w-auto max-w-[120px] object-contain drop-shadow-md"
        />
      </div>
    </div>
  )
}
