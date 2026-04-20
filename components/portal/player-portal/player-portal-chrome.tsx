"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Calendar,
  Clapperboard,
  Home,
  MessageSquare,
  UserRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"

function navLinkClass(active: boolean) {
  return cn(
    "flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors min-w-[3.5rem]",
    active
      ? "bg-white text-indigo-700 shadow-md shadow-indigo-900/15"
      : "text-white/85 hover:bg-white/10"
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

  const items = [
    { href: base, label: "Home", icon: Home, match: (p: string) => p === base || p === `${base}/` },
    { href: `${base}/calendar`, label: "Calendar", icon: Calendar, match: (p: string) => p.startsWith(`${base}/calendar`) },
    { href: `${base}/messages`, label: "Msgs", icon: MessageSquare, match: (p: string) => p.startsWith(`${base}/messages`) },
    { href: `${base}/film-room`, label: "Film", icon: Clapperboard, match: (p: string) => p.startsWith(`${base}/film-room`) },
    { href: `${base}/profile`, label: "Profile", icon: UserRound, match: (p: string) => p.startsWith(`${base}/profile`) },
  ]

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-indigo-950 via-violet-900 to-fuchsia-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-400/20 via-transparent to-transparent" />

      <header className="relative z-20 shrink-0 border-b border-white/10 bg-white/10 px-4 py-4 backdrop-blur-md">
        <PlayerPortalHeaderInner />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-24 pt-4">
        <SuspensionBanner teamStatus={teamStatus} />
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-indigo-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-lg"
        aria-label="Player portal primary"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-1">
          {items.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <Link key={href} href={href} className={navLinkClass(active)} prefetch={false}>
                <Icon className={cn("h-5 w-5", active ? "text-indigo-600" : "text-white")} aria-hidden />
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
  const { teamName, sport } = usePlayerPortal()
  return (
    <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200/90">Athlete portal</p>
        <h1 className="truncate text-xl font-black text-white drop-shadow-sm">{teamName}</h1>
        {sport ? <p className="text-sm font-medium text-white/75">{sport}</p> : null}
      </div>
      <div className="hidden shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-indigo-950 shadow-lg sm:block">
        Braik
      </div>
    </div>
  )
}
