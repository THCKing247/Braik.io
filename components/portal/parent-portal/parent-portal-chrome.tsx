"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Home, MessageSquare, UserRound, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"
import { braikParentTheme } from "@/components/portal/portal-brand-tokens"
import { braikLogo } from "@/lib/marketing/landing-images"

function navLinkClass(active: boolean) {
  return cn(
    "flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors",
    active
      ? cn(braikParentTheme.activeTab, "[&_svg]:text-[#F8F8F8] lg:bg-slate-900 lg:text-white lg:shadow-md lg:shadow-slate-900/15 lg:ring-0 lg:[&_svg]:text-white")
      : cn(braikParentTheme.inactiveTab, "[&_svg]:text-[#c6cfe4] lg:text-slate-600 lg:hover:bg-slate-100 lg:[&_svg]:text-slate-500")
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
    <div className={cn("flex min-h-[100dvh] flex-col lg:bg-slate-50", braikParentTheme.shell)}>
      <header className={cn("relative z-20 shrink-0 border-b px-4 py-3.5 backdrop-blur-sm lg:border-slate-200/90 lg:bg-white lg:py-4 lg:shadow-sm lg:backdrop-blur-0", braikParentTheme.header)}>
        <ParentPortalHeaderInner />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-24 pt-4">
        <SuspensionBanner teamStatus={teamStatus} />
        {children}
      </main>

      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_-18px_rgba(0,0,0,0.72)] backdrop-blur-sm lg:border-slate-200 lg:bg-white/95 lg:px-1 lg:shadow-none lg:backdrop-blur-md",
          braikParentTheme.nav
        )}
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
  const pathname = usePathname() ?? ""
  const { linkCodeSegment, teamName, sport, parentDisplayName } = useParentPortal()
  const base = `/parent/${encodeURIComponent(linkCodeSegment)}`
  const sub =
    parentDisplayName?.trim() ||
    null
  const p = pathname.split("?")[0] ?? pathname
  const eyebrow = p === base || p === `${base}/`
    ? "Feed"
    : p.startsWith(`${base}/calendar`)
      ? "Calendar"
      : p.startsWith(`${base}/messages`)
        ? "Messages"
        : p.startsWith(`${base}/profile`) || p.startsWith(`${base}/documents`)
          ? "Player"
          : p.startsWith(`${base}/reminders`)
            ? "Profile"
            : "Feed"

  return (
    <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] lg:text-slate-500", braikParentTheme.textSecondary)}>
          {eyebrow}
        </p>
        <h1 className="truncate bg-gradient-to-r from-[#F8F8F8] via-[#F8F8E8] to-[#F85808] bg-clip-text text-xl font-black text-transparent">
          {teamName}
        </h1>
        <div className={cn("mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm lg:text-slate-600", braikParentTheme.textMuted)}>
          {sport ? <span>{sport}</span> : null}
          {sub ? <span className={cn("lg:text-slate-500", braikParentTheme.textMuted)}>{sub}</span> : null}
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
