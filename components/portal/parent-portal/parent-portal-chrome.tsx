"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Home, Megaphone, MessageSquare, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"

function navLinkClass(active: boolean) {
  return cn(
    "flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors min-w-[3.25rem]",
    active
      ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
      : "text-slate-600 hover:bg-slate-100"
  )
}

export function ParentPortalChrome({
  children,
  teamStatus,
}: {
  children: React.ReactNode
  teamStatus?: string | null
}) {
  const { linkCodeSegment } = useParentPortal()
  const base = `/parent/${encodeURIComponent(linkCodeSegment)}`
  const pathname = usePathname() ?? ""

  const items = [
    { href: base, label: "Home", icon: Home, match: (p: string) => p === base || p === `${base}/` },
    {
      href: `${base}/calendar`,
      label: "Calendar",
      icon: Calendar,
      match: (p: string) => p.startsWith(`${base}/calendar`),
    },
    {
      href: `${base}/messages`,
      label: "Msgs",
      icon: MessageSquare,
      match: (p: string) => p.startsWith(`${base}/messages`),
    },
    {
      href: `${base}/announcements`,
      label: "News",
      icon: Megaphone,
      match: (p: string) => p.startsWith(`${base}/announcements`),
    },
    {
      href: `${base}/profile`,
      label: "Athlete",
      icon: UserRound,
      match: (p: string) => p.startsWith(`${base}/profile`),
    },
  ]

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      <header className="relative z-20 shrink-0 border-b border-slate-200/90 bg-white px-4 py-4 shadow-sm">
        <ParentPortalHeaderInner />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-24 pt-4">
        <SuspensionBanner teamStatus={teamStatus} />
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md"
        aria-label="Family portal primary"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-0.5">
          {items.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <Link key={href} href={href} className={navLinkClass(active)} prefetch={false}>
                <Icon className={cn("h-5 w-5", active ? "text-white" : "text-slate-500")} aria-hidden />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function ParentPortalHeaderInner() {
  const { teamName, sport, parentDisplayName } = useParentPortal()
  const sub =
    parentDisplayName?.trim() ||
    null

  return (
    <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Family portal</p>
        <h1 className="truncate text-xl font-bold text-slate-900">{teamName}</h1>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-600">
          {sport ? <span>{sport}</span> : null}
          {sub ? <span className="text-slate-500">{sub}</span> : null}
        </div>
      </div>
      <div className="hidden shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 sm:block">
        Braik
      </div>
    </div>
  )
}
