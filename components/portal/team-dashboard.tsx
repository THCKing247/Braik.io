"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  Bell,
  Megaphone,
  Calendar,
  Users,
  ImageIcon,
  MapPin,
  Clock,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionUser {
  id: string
  email: string
  name?: string | null
  role?: string
  teamId?: string
  teamName?: string
  organizationName?: string
}

interface TeamDashboardProps {
  session: { user: SessionUser } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleLabel(role?: string) {
  switch ((role || "").toUpperCase()) {
    case "HEAD_COACH": return "Head Coach"
    case "ASSISTANT_COACH": return "Assistant Coach"
    case "PLAYER": return "Player"
    case "PARENT": return "Parent"
    default: return "Team Member"
  }
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// Placeholder events — will be replaced by real schedule data when built
const PLACEHOLDER_EVENTS: Array<{ day: number; month: number; year: number; label: string; type: "game" | "practice" | "event" }> = []

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const eventsThisMonth = PLACEHOLDER_EVENTS.filter(
    e => e.month === viewMonth && e.year === viewYear
  )
  const eventDays = new Set(eventsThisMonth.map(e => e.day))

  // Build grid cells (null = empty padding cell)
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[rgb(var(--platinum))]"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" style={{ color: "rgb(var(--text2))" }} />
        </button>
        <p className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
          {MONTHS[viewMonth]} {viewYear}
        </p>
        <button
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[rgb(var(--platinum))]"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" style={{ color: "rgb(var(--text2))" }} />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map(d => (
          <div key={d} className="py-1.5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (cell === null) return <div key={`empty-${i}`} />
          const hasEvent = eventDays.has(cell)
          const todayCell = isToday(cell)
          return (
            <div
              key={cell}
              className="relative flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-[rgb(var(--platinum))] cursor-default"
              style={{
                backgroundColor: todayCell ? "rgb(var(--accent))" : "transparent",
                color: todayCell ? "#FFFFFF" : "rgb(var(--text))",
                minHeight: "42px",
              }}
            >
              {cell}
              {hasEvent && !todayCell && (
                <span
                  className="absolute bottom-1 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "rgb(var(--accent))" }}
                />
              )}
              {hasEvent && todayCell && (
                <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-white/70" />
              )}
            </div>
          )
        })}
      </div>

      {/* Upcoming events list — placeholder */}
      <div className="mt-2 space-y-1.5 border-t pt-3" style={{ borderColor: "rgb(var(--border))" }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--text2))" }}>
          Upcoming
        </p>
        {eventsThisMonth.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3" style={{ borderColor: "rgb(var(--border))" }}>
            <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: "rgb(var(--muted))" }} />
            <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
              No events scheduled yet.{" "}
              <Link href="/dashboard/schedule" className="hover:underline" style={{ color: "rgb(var(--accent))" }}>
                Add to schedule →
              </Link>
            </p>
          </div>
        ) : (
          eventsThisMonth.slice(0, 4).map((e, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: "rgb(var(--platinum))" }}>
              <div
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    e.type === "game" ? "#EF4444" :
                    e.type === "practice" ? "rgb(var(--accent))" :
                    "#F59E0B",
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" style={{ color: "rgb(var(--text))" }}>{e.label}</p>
                <p className="text-[10px]" style={{ color: "rgb(var(--muted))" }}>
                  {MONTHS[e.month]} {e.day}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <Link href="/dashboard/schedule">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs font-medium"
          style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text2))" }}
        >
          <Calendar className="mr-1.5 h-3.5 w-3.5" />
          View Full Schedule
        </Button>
      </Link>
    </div>
  )
}

// ─── Team Banner ──────────────────────────────────────────────────────────────

function TeamBanner({ user }: { user: SessionUser }) {
  const teamName = user.teamName || user.organizationName || "Your Team"
  const displayName = user.name || user.email?.split("@")[0] || "Coach"
  const roleLabel = getRoleLabel(user.role)

  // Placeholder record — will be populated from real season data
  const wins = 0
  const losses = 0
  const districtWins = 0
  const districtLosses = 0

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #0B2A5B 60%, #162d4a 100%)",
      }}
    >
      {/* Background texture stripes */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 0, transparent 50%)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Logo + name */}
        <div className="flex items-center gap-4">
          {/* Team logo placeholder */}
          <div
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border-2 border-white/20 bg-white/10 transition-colors hover:bg-white/15 cursor-pointer"
            title="Upload team logo (coming soon)"
          >
            <ImageIcon className="h-7 w-7 text-white/50" />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/60">
              Welcome back, {displayName}
            </p>
            <h1
              className="text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl"
              style={{ fontFamily: "var(--font-teko, var(--font-oswald, sans-serif))" }}
            >
              {teamName}
            </h1>
            <p className="mt-0.5 text-xs text-white/50">{roleLabel}</p>
          </div>
        </div>

        {/* Right: Record */}
        <div className="flex items-center gap-5">
          {/* Overall record */}
          <div className="text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/50">
              Overall
            </p>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-white">{wins}</span>
              <span className="text-lg font-semibold text-white/40">-</span>
              <span className="text-3xl font-bold tabular-nums text-white">{losses}</span>
            </div>
            <p className="text-[10px] text-white/40">W – L</p>
          </div>

          <div className="h-10 w-px bg-white/15" />

          {/* District record */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Trophy className="h-3 w-3 text-white/50" />
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/50">
                District
              </p>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-white">{districtWins}</span>
              <span className="text-lg font-semibold text-white/40">-</span>
              <span className="text-3xl font-bold tabular-nums text-white">{districtLosses}</span>
            </div>
            <p className="text-[10px] text-white/40">W – L</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Updates Card ─────────────────────────────────────────────────────────────

function UpdatesCard() {
  const updates: Array<{ icon: React.ElementType; text: string; time: string; href: string }> = [
    // Placeholder — will be replaced with real data
  ]

  return (
    <Card className="border h-full" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
          <Megaphone className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
          Team Updates
        </CardTitle>
        <Link href="/dashboard/announcements">
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" style={{ color: "rgb(var(--accent))" }}>
            View all
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {updates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgb(var(--platinum))" }}
            >
              <Megaphone className="h-5 w-5" style={{ color: "rgb(var(--muted))" }} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>No updates yet</p>
              <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                Announcements and team updates will appear here.
              </p>
            </div>
            <Link href="/dashboard/announcements">
              <Button
                size="sm"
                className="text-xs font-medium text-white"
                style={{ backgroundColor: "rgb(var(--accent))" }}
              >
                Post an Announcement
              </Button>
            </Link>
          </div>
        ) : (
          updates.map(({ icon: Icon, text, time, href }, i) => (
            <Link
              key={i}
              href={href}
              className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-[rgb(var(--platinum))]"
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "rgb(var(--platinum))" }}
              >
                <Icon className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug" style={{ color: "rgb(var(--text))" }}>{text}</p>
                <p className="mt-0.5 text-xs" style={{ color: "rgb(var(--muted))" }}>{time}</p>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ─── Notifications Card ───────────────────────────────────────────────────────

function NotificationsCard() {
  const notifications: Array<{ type: "info" | "warning" | "success"; text: string; time: string }> = [
    // Placeholder — will be replaced with real notifications
  ]

  const typeStyles = {
    info: { dot: "rgb(var(--accent))", bg: "rgba(37,99,235,0.06)", border: "rgba(37,99,235,0.2)" },
    warning: { dot: "#F59E0B", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.25)" },
    success: { dot: "#22C55E", bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.25)" },
  }

  return (
    <Card className="border h-full" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
          <Bell className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
          Notifications
          {notifications.length > 0 && (
            <span
              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: "rgb(var(--accent))" }}
            >
              {notifications.length}
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" style={{ color: "rgb(var(--muted))" }}>
          Mark all read
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgb(var(--platinum))" }}
            >
              <Bell className="h-5 w-5" style={{ color: "rgb(var(--muted))" }} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>All caught up!</p>
              <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                Roster updates, messages, and schedule changes will appear here.
              </p>
            </div>
          </div>
        ) : (
          notifications.map(({ type, text, time }, i) => {
            const s = typeStyles[type]
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border p-3"
                style={{ backgroundColor: s.bg, borderColor: s.border }}
              >
                <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug" style={{ color: "rgb(var(--text))" }}>{text}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "rgb(var(--muted))" }}>{time}</p>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeamDashboard({ session }: TeamDashboardProps) {
  const user = session?.user
  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm" style={{ borderColor: "rgb(var(--border))" }}>
          <h2 className="text-base font-semibold" style={{ color: "rgb(var(--text))" }}>Unable to load your profile</h2>
          <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
            Your session loaded, but your user profile data is incomplete. Refresh the page or sign in again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── Team Banner ── */}
      <TeamBanner user={user} />

      {/* ── Full-width Calendar ── */}
      <Card
        className="border"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
            <Calendar className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
            Schedule
          </CardTitle>
          <Link href="/dashboard/schedule">
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" style={{ color: "rgb(var(--accent))" }}>
              Full view
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <MiniCalendar />
        </CardContent>
      </Card>

      {/* ── Updates + Notifications side by side ── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <UpdatesCard />
        <NotificationsCard />
      </div>

    </div>
  )
}
