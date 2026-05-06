"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Bell, Calendar, ChevronRight, Clock3, Megaphone, MessageSquare, UserRound } from "lucide-react"
import { useDashboardBootstrapQuery } from "@/lib/dashboard/dashboard-bootstrap-query"
import { feedRelativeTime } from "@/lib/portal/feed-relative-time"
import { useParentPortal } from "@/components/portal/parent-portal/parent-portal-context"
import { braikParentTheme } from "@/components/portal/portal-brand-tokens"
import { cn } from "@/lib/utils"

type ParentFeedPost = {
  id: string
  author: string
  role: string
  title: string
  body: string
  timeLabel: string
  label: "Announcement" | "Game Result" | "Team Update" | "Film" | "Coach Info"
  href: string
}

const tileBase =
  `group relative flex flex-col overflow-hidden rounded-2xl border p-4 shadow-sm transition-transform active:scale-[0.98] sm:p-5 ${braikParentTheme.cardDark}`

export function ParentPortalHome() {
  const { linkCodeSegment, teamName, linkedPlayerFirstName, teamId } = useParentPortal()
  const base = `/parent/${encodeURIComponent(linkCodeSegment)}`
  const dashQ = useDashboardBootstrapQuery(teamId)
  const athleteHint = linkedPlayerFirstName?.trim() || "your athlete"

  const posts = useMemo<ParentFeedPost[]>(() => {
    const announcementPosts: ParentFeedPost[] = (dashQ.data?.announcements ?? []).map((row) => ({
      id: `announcement-${row.id}`,
      author: row.author_name?.trim() || "Coach",
      role: "Coach",
      title: row.title,
      body: row.body,
      timeLabel: feedRelativeTime(row.created_at),
      label: "Announcement",
      href: `${base}/announcements`,
    }))

    const staticPosts: ParentFeedPost[] = [
      {
        id: "parent-result",
        author: "Braik Football",
        role: "Team",
        title: "Final: Braik 28, Central Eagles 17",
        body: `Great team win. ${athleteHint} can review game context and upcoming schedule in Calendar.`,
        timeLabel: "2h ago",
        label: "Game Result",
        href: `${base}/calendar`,
      },
      {
        id: "parent-update",
        author: "Head Coach",
        role: "Head Coach",
        title: "Travel packet posted for families",
        body: "Arrival windows, gate map, and sideline family guidance are available for linked families.",
        timeLabel: "Yesterday",
        label: "Team Update",
        href: `${base}/profile`,
      },
      {
        id: "parent-film",
        author: "Defensive Coordinator",
        role: "Defensive Coordinator",
        title: "Family film note posted after semifinal",
        body: "Coach-shared film notes are available for parent-visible review tied to your linked athlete's team.",
        timeLabel: "Yesterday",
        label: "Film",
        href: `${base}/announcements`,
      },
    ]

    return [...announcementPosts, ...staticPosts]
  }, [athleteHint, base, dashQ.data?.announcements])

  const desktopTiles: Array<{
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
      accent: "border-[#1f2f63] bg-[#10275f] text-[#F8F8F8]",
    },
    {
      href: `${base}/calendar`,
      title: "Calendar",
      subtitle: "Games, practices & events",
      icon: Calendar,
      accent: "border-[#1f2f63] bg-[#10275f] text-[#F8F8F8]",
    },
    {
      href: `${base}/messages`,
      title: "Messages",
      subtitle: "Coaches & threads",
      icon: MessageSquare,
      accent: "border-[#1f2f63] bg-[#10275f] text-[#F8F8F8]",
    },
    {
      href: `${base}/announcements`,
      title: "Announcements",
      subtitle: "Team updates",
      icon: Megaphone,
      accent: "border-[#1f2f63] bg-[#10275f] text-[#F8F8F8]",
    },
    {
      href: `${base}/reminders`,
      title: "Reminders",
      subtitle: "Alerts for you",
      icon: Bell,
      accent: "border-[#F85808]/45 bg-[#F85808]/15 text-[#F8F8F8]",
    },
  ]

  return (
    <div className="mx-auto w-full max-w-lg space-y-3.5 pb-4">
      <section className={`rounded-2xl border px-3 py-2.5 backdrop-blur-md lg:hidden ${braikParentTheme.surface}`}>
        <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${braikParentTheme.textSecondary}`}>Feed</p>
        <p className={`mt-1 text-[15px] font-black ${braikParentTheme.textWarm}`}>{teamName}</p>
        <p className={`text-[11px] font-medium ${braikParentTheme.textMuted}`}>
          Family updates and coach posts relevant to {athleteHint}.
        </p>
      </section>

      <Link
        href={`${base}/calendar`}
        prefetch={false}
        className={`group flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 shadow-inner backdrop-blur-md transition active:scale-[0.99] lg:hidden ${braikParentTheme.surfaceSoft}`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F85808]/18">
          <Clock3 className="h-4 w-4 text-[#F85808]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${braikParentTheme.textSecondary}`}>Next game</p>
          <p className={`truncate text-sm font-bold ${braikParentTheme.textWarm}`}>Friday · 7:00 PM · vs Central Eagles</p>
          <p className={`text-[11px] font-medium ${braikParentTheme.textMuted}`}>Home · Gates open 5:30 · family access open</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#9aa8c7] transition group-hover:text-[#F8F8F8]" aria-hidden />
      </Link>

      <ul className="space-y-3 lg:hidden">
        {posts.map((post) => (
          <li key={post.id} className={`rounded-2xl border px-4 py-3.5 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.8)] ring-1 ring-[#1f2f63]/40 ${braikParentTheme.cardDark}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-bold ${braikParentTheme.textWarm}`}>{post.author}</p>
              <span className="rounded-full bg-[#10265f] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F8F8F8]">
                {post.role}
              </span>
              <span className="rounded-full bg-[#F85808]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F8F8E8]">
                {post.label}
              </span>
            </div>
            <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${braikParentTheme.textMuted}`}>{post.timeLabel}</p>
            <h3 className={`mt-2 text-base font-black ${braikParentTheme.textWarm}`}>{post.title}</h3>
            <p className={`mt-1.5 text-sm leading-relaxed ${braikParentTheme.textSecondary}`}>{post.body}</p>
            <div className="mt-3 flex items-center gap-4 border-t border-[#1f2f63]/60 pt-2.5">
              <Link href={post.href} prefetch={false} className="text-sm font-semibold text-slate-200 hover:text-white">
                Details
              </Link>
              <button type="button" className="text-sm font-semibold text-[#F85808] hover:text-[#D83808]" aria-label="React soon">
                React
              </button>
              <button type="button" className="text-sm font-semibold text-[#c6cfe4] hover:text-[#F8F8F8]" aria-label="Reply soon">
                Reply
              </button>
            </div>
          </li>
        ))}
      </ul>

      <section className="hidden lg:block" aria-label="Family portal modules">
        <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Shortcuts</p>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4">
          {desktopTiles.map((t) => (
            <li key={t.href}>
              <Link href={t.href} prefetch={false} className={cn(tileBase, "min-h-[112px]")}>
                <div
                  className={cn(
                    "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-none",
                    t.accent
                  )}
                >
                  <t.icon className="h-5 w-5" aria-hidden />
                </div>
                <span className="text-base font-bold text-[#F8F8F8]">{t.title}</span>
                <span className="mt-0.5 text-xs font-medium text-[#c6cfe4]">{t.subtitle}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
