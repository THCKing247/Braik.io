"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Home, MessageSquare, UserRound, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"
import { braikLogo } from "@/lib/marketing/landing-images"

function navLinkClass(active: boolean) {
  return cn(
    "flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors min-w-[3.25rem]",
    active
      ? "bg-white text-orange-900 shadow-lg shadow-orange-500/25 ring-1 ring-white/70 [&_svg]:text-orange-600 lg:bg-slate-900 lg:text-white lg:shadow-md lg:shadow-slate-900/15 lg:ring-0 lg:[&_svg]:text-white"
      : "text-white/85 hover:bg-white/10 [&_svg]:text-white lg:text-slate-600 lg:hover:bg-slate-100 lg:[&_svg]:text-slate-500"
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
    { href: base, label: "Feed", icon: Home, match: (p: string) => p === base || p === `${base}/` },
    {
      href: `${base}/calendar`,
      label: "Calendar",
      icon: Calendar,
      match: (p: string) => p.startsWith(`${base}/calendar`),
    },
    {
      href: `${base}/messages`,
      label: "Messages",
      icon: MessageSquare,
      match: (p: string) => p.startsWith(`${base}/messages`),
    },
    {
      href: `${base}/profile`,
      label: "Player",
      icon: Users,
      match: (p: string) => p.startsWith(`${base}/profile`) || p.startsWith(`${base}/documents`),
    },
    {
      href: `${base}/reminders`,
      label: "Profile",
      icon: UserRound,
      match: (p: string) => p.startsWith(`${base}/reminders`),
    },
  ]

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#050c14] via-[#071226] to-[#120714] lg:bg-slate-50">
      <header className="relative z-20 shrink-0 border-b border-sky-500/15 bg-black/25 px-4 py-3.5 backdrop-blur-xl lg:border-slate-200/90 lg:bg-white lg:py-4 lg:shadow-sm lg:backdrop-blur-0">
        <ParentPortalHeaderInner />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-24 pt-4">
        <SuspensionBanner teamStatus={teamStatus} />
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-sky-500/20 bg-[#040a12]/94 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_-18px_rgba(0,0,0,0.72)] backdrop-blur-xl lg:border-slate-200 lg:bg-white/95 lg:px-1 lg:shadow-none lg:backdrop-blur-md"
        aria-label="Family portal primary"
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

function ParentPortalHeaderInner() {
  const { teamName, sport, parentDisplayName } = useParentPortal()
  const sub =
    parentDisplayName?.trim() ||
    null

  return (
    <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300/95 lg:text-slate-500">Parent portal</p>
        <h1 className="truncate bg-gradient-to-r from-sky-100 via-amber-100 to-orange-100 bg-clip-text text-xl font-black text-transparent">
          {teamName}
        </h1>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-white/70 lg:text-slate-600">
          {sport ? <span>{sport}</span> : null}
          {sub ? <span className="text-white/70 lg:text-slate-500">{sub}</span> : null}
        </div>
      </div>
      <div className="shrink-0">
        <Image
          src={braikLogo.webp}
          alt="Braik"
          width={braikLogo.width}
          height={braikLogo.height}
          className="h-8 w-auto max-w-[100px] object-contain opacity-90"
        />
      </div>
    </div>
  )
}
