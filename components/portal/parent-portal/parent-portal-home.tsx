"use client"

import Link from "next/link"
import { Bell, Calendar, Megaphone, MessageSquare, UserRound } from "lucide-react"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"
import { cn } from "@/lib/utils"

const tileBase =
  "group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-transform active:scale-[0.98] sm:p-5"

export function ParentPortalHome() {
  const { linkCodeSegment, teamName, parentDisplayName, parentEmail, linkedPlayerFirstName } = useParentPortal()
  const base = `/parent/${encodeURIComponent(linkCodeSegment)}`

  const greet =
    parentDisplayName?.split(/\s+/)[0]?.trim() ||
    (parentEmail?.split("@")[0] ? parentEmail.split("@")[0].replace(/\./g, " ") : null) ||
    "there"

  const athleteHint =
    linkedPlayerFirstName?.trim() ||
    "your athlete"

  const tiles: Array<{
    href: string
    title: string
    subtitle: string
    icon: typeof UserRound
    accent: string
  }> = [
    {
      href: `${base}/profile`,
      title: "Athlete profile",
      subtitle: "Roster info & documents",
      icon: UserRound,
      accent: "border-slate-200 bg-slate-50 text-slate-800",
    },
    {
      href: `${base}/calendar`,
      title: "Calendar",
      subtitle: "Games, practices & events",
      icon: Calendar,
      accent: "border-emerald-100 bg-emerald-50 text-emerald-900",
    },
    {
      href: `${base}/messages`,
      title: "Messages",
      subtitle: "Coaches & threads",
      icon: MessageSquare,
      accent: "border-violet-100 bg-violet-50 text-violet-900",
    },
    {
      href: `${base}/announcements`,
      title: "Announcements",
      subtitle: "Team updates",
      icon: Megaphone,
      accent: "border-rose-100 bg-rose-50 text-rose-900",
    },
    {
      href: `${base}/reminders`,
      title: "Reminders",
      subtitle: "Alerts for you",
      icon: Bell,
      accent: "border-amber-100 bg-amber-50 text-amber-900",
    },
  ]

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Today</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Hello {greet}</h2>
        <p className="mt-1 text-sm font-medium text-slate-700">{teamName}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Stay up to date on {athleteHint}&apos;s schedule and everything your coaches share with families.
        </p>
      </section>

      <section aria-label="Family portal modules">
        <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Shortcuts</p>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4">
          {tiles.map((t) => (
            <li key={t.href}>
              <Link href={t.href} prefetch={false} className={cn(tileBase, "min-h-[112px]")}>
                <div
                  className={cn(
                    "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border text-slate-900 shadow-none",
                    t.accent
                  )}
                >
                  <t.icon className="h-5 w-5" aria-hidden />
                </div>
                <span className="text-base font-bold text-slate-900">{t.title}</span>
                <span className="mt-0.5 text-xs font-medium text-slate-500">{t.subtitle}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
