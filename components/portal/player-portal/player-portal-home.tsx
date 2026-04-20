"use client"

import Link from "next/link"
import {
  Bell,
  BookOpen,
  Calendar,
  Clapperboard,
  GraduationCap,
  MessageSquare,
  Megaphone,
  UserRound,
} from "lucide-react"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { cn } from "@/lib/utils"

const tileBase =
  "group relative flex flex-col overflow-hidden rounded-2xl border border-white/40 bg-white p-4 shadow-lg shadow-indigo-950/20 transition-transform active:scale-[0.98] sm:p-5"

export function PlayerPortalHome() {
  const { accountSegment, teamName, userName, userEmail } = usePlayerPortal()
  const base = `/player/${encodeURIComponent(accountSegment)}`

  const firstName =
    userName?.split(/\s+/)[0]?.trim() ||
    (userEmail?.split("@")[0] ? userEmail.split("@")[0].replace(/\./g, " ") : null) ||
    "Athlete"

  const tiles: Array<{
    href: string
    title: string
    subtitle: string
    icon: typeof UserRound
    gradient: string
  }> = [
    {
      href: `${base}/profile`,
      title: "Profile",
      subtitle: "Info & documents",
      icon: UserRound,
      gradient: "from-sky-500 to-blue-700",
    },
    {
      href: `${base}/calendar`,
      title: "Calendar",
      subtitle: "Schedule & games",
      icon: Calendar,
      gradient: "from-emerald-500 to-teal-700",
    },
    {
      href: `${base}/messages`,
      title: "Messages",
      subtitle: "Team chat",
      icon: MessageSquare,
      gradient: "from-violet-500 to-purple-800",
    },
    {
      href: `${base}/film-room`,
      title: "Film Room",
      subtitle: "Video & cutups",
      icon: Clapperboard,
      gradient: "from-fuchsia-500 to-pink-700",
    },
    {
      href: `${base}/playbooks`,
      title: "Playbooks",
      subtitle: "Installs & scripts",
      icon: BookOpen,
      gradient: "from-amber-500 to-orange-700",
    },
    {
      href: `${base}/study-guides`,
      title: "Study Guides",
      subtitle: "Assignments",
      icon: GraduationCap,
      gradient: "from-cyan-500 to-indigo-700",
    },
    {
      href: `${base}/announcements`,
      title: "Announcements",
      subtitle: "From coaches",
      icon: Megaphone,
      gradient: "from-rose-500 to-red-700",
    },
    {
      href: `${base}/reminders`,
      title: "Reminders",
      subtitle: "Alerts for you",
      icon: Bell,
      gradient: "from-lime-500 to-green-800",
    },
  ]

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <section className="rounded-3xl border border-white/30 bg-white/95 p-5 shadow-xl shadow-black/20 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Today</p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">Hey {firstName}</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">{teamName}</p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Your athlete portal — quick access to everything your coaches publish for you. Tap a card below.
        </p>
      </section>

      <section aria-label="Player portal apps">
        <p className="mb-3 px-1 text-xs font-bold uppercase tracking-widest text-white/70">Jump in</p>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4">
          {tiles.map((t) => (
            <li key={t.href}>
              <Link href={t.href} prefetch={false} className={cn(tileBase, "min-h-[118px]")}>
                <div
                  className={cn(
                    "mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                    t.gradient
                  )}
                >
                  <t.icon className="h-6 w-6" aria-hidden />
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
