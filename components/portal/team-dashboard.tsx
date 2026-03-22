"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import {
  Trophy,
  Bell,
  Megaphone,
  Users,
  ImageIcon,
  MapPin,
  Clock,
  ClipboardCheck,
} from "lucide-react"
import { DashboardCalendar } from "@/components/portal/dashboard-calendar"
import { DashboardAnnouncementsCard } from "@/components/portal/dashboard-announcements-card"
import { buildNotificationRoute, buildNotificationUrl } from "@/lib/utils/notification-router"
import { getNextUpcomingGame, inferHomeAway, type TeamGameRow } from "@/lib/team-schedule-games"

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
  /** Effective team id (matches DashboardPageShell / schedule page) */
  teamId: string
  /** Same permission as calendar event create (coaches) */
  canAddCalendarEvents: boolean
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

function formatRelativeTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return d.toLocaleDateString()
}


// ─── Team Banner ──────────────────────────────────────────────────────────────

function TeamBanner({ user, teamId }: { user: SessionUser; teamId: string }) {
  const [teamSummary, setTeamSummary] = useState<{ name: string; slogan: string | null; logoUrl: string | null } | null>(null)
  const hasTeam = Boolean(user.teamId)

  useEffect(() => {
    if (!teamId) {
      setTeamSummary(null)
      return
    }
    let cancelled = false
    fetch(`/api/teams/${teamId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setTeamSummary({
            name: data.name ?? "",
            slogan: data.slogan ?? null,
            logoUrl: data.logoUrl ?? null,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setTeamSummary(null)
      })
    return () => { cancelled = true }
  }, [teamId])

  const teamName = teamSummary?.name || user.teamName || user.organizationName || "Your Team"
  const lastName = user?.name?.split(" ").slice(-1)[0] || ""
  const roleLabel = getRoleLabel(user.role)
  const logoUrl = teamSummary?.logoUrl ?? null

  // Placeholder record — will be populated from real season data
  const wins = 0
  const losses = 0
  const districtWins = 0
  const districtLosses = 0

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-lg shadow-slate-900/15 ring-1 ring-white/10 md:shadow-md md:ring-0"
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

      <div className="relative flex min-w-0 flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6">
        {/* Left: Logo + name */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {/* Team logo or placeholder */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 sm:h-16 sm:w-16 sm:rounded-xl"
            title={hasTeam ? "Team logo" : "Connect to a team"}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={`${teamName} logo`} className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-7 w-7 text-white/50" />
            )}
          </div>

          <div className="min-w-0 flex-1 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55 sm:text-xs sm:tracking-[0.15em]">
              {hasTeam ? `Welcome back, ${roleLabel === "Head Coach" ? "Coach" : roleLabel}${lastName ? ` ${lastName}` : ""}` : `Welcome, ${user.name || roleLabel}`}
            </p>
            <h1
              className="mt-1 break-words text-lg font-bold uppercase leading-tight tracking-tight text-white sm:text-2xl md:text-3xl"
              style={{ fontFamily: "var(--font-teko, var(--font-oswald, sans-serif))" }}
            >
              {hasTeam ? teamName : "Welcome to Your Portal"}
            </h1>
            <p className="mt-1 text-[11px] text-white/45 sm:text-xs sm:text-white/50">{hasTeam ? roleLabel : "Connect to a team to get started"}</p>
          </div>
        </div>

        {/* Right: Record (only show if has team) */}
        {hasTeam && (
        <div className="flex shrink-0 flex-wrap items-center justify-start gap-6 border-t border-white/10 pt-3 sm:gap-5 sm:border-t-0 sm:pt-0 md:justify-end">
          {/* Overall record */}
          <div className="min-w-[4rem] text-center sm:min-w-[4.5rem]">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/45 sm:text-[10px] sm:tracking-[0.15em]">
              Overall
            </p>
            <div className="mt-0.5 flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{wins}</span>
              <span className="text-base font-semibold text-white/40 sm:text-lg">-</span>
              <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{losses}</span>
            </div>
            <p className="text-[9px] text-white/35 sm:text-[10px]">W – L</p>
          </div>

          <div className="hidden h-10 w-px bg-white/15 sm:block" aria-hidden />

          {/* District record */}
          <div className="min-w-[4rem] text-center sm:min-w-[4.5rem]">
            <div className="flex items-center justify-center gap-1">
              <Trophy className="h-3 w-3 text-white/50" />
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/45 sm:text-[10px] sm:tracking-[0.15em]">
                District
              </p>
            </div>
            <div className="mt-0.5 flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{districtWins}</span>
              <span className="text-base font-semibold text-white/40 sm:text-lg">-</span>
              <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{districtLosses}</span>
            </div>
            <p className="text-[9px] text-white/35 sm:text-[10px]">W – L</p>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

// ─── Readiness Summary Card (coach only; fetches team readiness) ───────────────

function ReadinessSummaryCard({ teamId }: { teamId: string }) {
  const [summary, setSummary] = useState<{ total: number; incompleteCount: number; readyCount: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    if (!teamId) return
    setLoading(true)
    setForbidden(false)
    fetch(`/api/teams/${teamId}/readiness`)
      .then((res) => {
        if (res.status === 403) {
          setForbidden(true)
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((data: { summary?: { total?: number; incompleteCount?: number; readyCount?: number } } | null) => {
        if (data?.summary) {
          setSummary({
            total: data.summary.total ?? 0,
            incompleteCount: data.summary.incompleteCount ?? 0,
            readyCount: data.summary.readyCount ?? 0,
          })
        } else {
          setSummary(null)
        }
      })
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [teamId])

  if (forbidden || loading || !summary) return null

  return (
    <Card
      className="h-full rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
      style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
    >
      <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
        <CardTitle className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold" style={{ color: "rgb(var(--text))" }}>
          <ClipboardCheck className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
          Roster Readiness
        </CardTitle>
        <Link href={`/dashboard/roster?teamId=${teamId}`} className="shrink-0">
          <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-medium md:h-7 md:px-2" style={{ color: "rgb(var(--accent))" }}>
            View
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>{summary.total}</span>
          <span className="text-sm" style={{ color: "rgb(var(--muted))" }}>players</span>
        </div>
        <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
          <span className="font-medium text-green-600">{summary.readyCount} ready</span>
          {summary.incompleteCount > 0 && (
            <> · <span className="font-medium text-amber-600">{summary.incompleteCount} need attention</span></>
          )}
        </p>
        {summary.incompleteCount > 0 && (
          <Link href={`/dashboard/roster?teamId=${teamId}`}>
            <Button size="sm" variant="outline" className="mt-2 text-xs">
              Open Readiness tab
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Notifications Card ───────────────────────────────────────────────────────

type DashNotification = {
  id: string
  title: string
  body: string | null
  linkUrl: string | null
  linkType: string | null
  linkId: string | null
  read: boolean
  createdAt: string
  type: string
}

const NOTIFICATION_TYPES_ROSTER_MESSAGES_SCHEDULE = new Set([
  "roster_change",
  "roster_import",
  "message",
  "thread_reply",
  "event_created",
  "event_updated",
  "event_starting_soon",
])

function notificationStyle(t: string) {
  const x = t.toLowerCase()
  if (x.includes("message") || x.includes("thread")) {
    return { dot: "#2563EB", bg: "rgba(37,99,235,0.07)", border: "rgba(37,99,235,0.2)" }
  }
  if (x.includes("event") || x.includes("schedule")) {
    return { dot: "#7C3AED", bg: "rgba(124,58,237,0.07)", border: "rgba(124,58,237,0.2)" }
  }
  if (x.includes("roster")) {
    return { dot: "#059669", bg: "rgba(5,150,105,0.07)", border: "rgba(5,150,105,0.2)" }
  }
  return { dot: "rgb(var(--accent))", bg: "rgba(37,99,235,0.06)", border: "rgba(37,99,235,0.2)" }
}

function NotificationsCard({ teamId }: { teamId: string }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<DashNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?teamId=${encodeURIComponent(teamId)}&limit=15`)
      if (!res.ok) return
      const data = await res.json()
      const raw = (data.notifications || []) as DashNotification[]
      const list = raw.filter((n) => NOTIFICATION_TYPES_ROSTER_MESSAGES_SCHEDULE.has(n.type))
      setNotifications(list)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  const openNotification = async (n: DashNotification) => {
    if (!n.read) {
      try {
        await fetch(`/api/notifications/${n.id}`, { method: "PATCH" })
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      } catch {
        /* ignore */
      }
    }
    const route = buildNotificationRoute(n.linkType, n.linkId, n.linkUrl, teamId)
    if (route) {
      router.push(buildNotificationUrl(route))
      return
    }
    if (n.linkUrl?.startsWith("/")) {
      try {
        const u = new URL(n.linkUrl, "http://x")
        if (teamId && !u.searchParams.has("teamId")) u.searchParams.set("teamId", teamId)
        router.push(`${u.pathname}${u.search}`)
      } catch {
        router.push(n.linkUrl)
      }
    }
  }

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      })
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })))
    } catch {
      /* ignore */
    }
  }

  const unread = notifications.filter((n) => !n.read).length

  return (
    <Card
      className="flex h-full flex-col rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
      style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
    >
      <CardHeader className="flex shrink-0 flex-row items-center justify-between px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
        <CardTitle
          className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold"
          style={{ color: "rgb(var(--text))" }}
        >
          <Bell className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
          Notifications
          {unread > 0 && (
            <span
              className="ml-1 inline-flex min-w-[1.25rem] h-5 px-1 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: "rgb(var(--accent))" }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </CardTitle>
        {notifications.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs md:h-7"
            style={{ color: "rgb(var(--muted))" }}
            onClick={markAllRead}
          >
            Mark all read
          </Button>
        ) : (
          <span className="h-9 w-16 shrink-0 md:h-7" aria-hidden />
        )}
      </CardHeader>
      <CardContent className="max-h-[320px] flex-1 space-y-2 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
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
                Roster changes, new messages, and schedule updates only. Refreshes every 10 seconds.
              </p>
            </div>
          </div>
        ) : (
          notifications.map((n) => {
            const s = notificationStyle(n.type)
            const clickable =
              Boolean(
                buildNotificationRoute(n.linkType, n.linkId, n.linkUrl, teamId) ||
                  (n.linkUrl && n.linkUrl.startsWith("/"))
              )
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => clickable && openNotification(n)}
                disabled={!clickable}
                className={`flex w-full text-left items-start gap-3 rounded-lg border p-3 transition-opacity ${
                  clickable ? "cursor-pointer hover:opacity-95" : "cursor-default opacity-90"
                } ${!n.read ? "ring-1 ring-blue-200/60" : ""}`}
                style={{ backgroundColor: s.bg, borderColor: s.border }}
              >
                <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug" style={{ color: "rgb(var(--text))" }}>
                    {n.title}
                  </p>
                  {n.body ? (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "rgb(var(--muted))" }}>
                      {n.body}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px]" style={{ color: "rgb(var(--muted))" }}>
                    {formatRelativeTime(n.createdAt)}
                    {clickable ? " · Tap to open" : ""}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

// ─── Next upcoming game (games table — same source as Schedule page) ──────────

function UpcomingGameCard({ teamId }: { teamId: string }) {
  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<TeamGameRow | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/stats/games?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { games?: TeamGameRow[] } | null) => {
        if (cancelled) return
        const rows = data?.games
        if (!rows || !Array.isArray(rows)) {
          setGame(null)
          return
        }
        setGame(getNextUpcomingGame(rows))
      })
      .catch(() => {
        if (!cancelled) setGame(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  const scheduleHref = `/dashboard/schedule?teamId=${encodeURIComponent(teamId)}`

  if (loading) {
    return (
      <Card
        className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardContent className="flex min-h-[120px] items-center justify-center py-6">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[rgb(var(--accent))] border-t-transparent" />
        </CardContent>
      </Card>
    )
  }

  if (!game) {
    return (
      <Card
        className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
          <CardTitle className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold" style={{ color: "rgb(var(--text))" }}>
            <Trophy className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
            Next game
          </CardTitle>
          <Link href={scheduleHref} className="shrink-0">
            <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-medium md:h-7 md:px-2" style={{ color: "rgb(var(--accent))" }}>
              Schedule
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
            No upcoming games on the schedule. Completed, postponed, and cancelled games are not shown here.
          </p>
        </CardContent>
      </Card>
    )
  }

  const kickoff = new Date(game.gameDate)
  const ha = inferHomeAway(game.location)
  const homeAwayLabel = ha === "home" ? "Home" : ha === "away" ? "Away" : "TBD"
  const opp = game.opponent?.trim() || "Opponent TBD"

  return (
    <Card
      className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
      style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
        <CardTitle className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold" style={{ color: "rgb(var(--text))" }}>
          <Trophy className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
          Next game
        </CardTitle>
        <Link href={scheduleHref} className="shrink-0">
          <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-medium md:h-7 md:px-2" style={{ color: "rgb(var(--accent))" }}>
            Full schedule
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 md:px-6 md:pb-6">
        <p className="text-lg font-bold leading-snug" style={{ color: "rgb(var(--text))" }}>
          {ha === "home" ? "vs " : ha === "away" ? "@ " : ""}
          {opp}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {Number.isFinite(kickoff.getTime()) ? format(kickoff, "EEE, MMM d · h:mm a") : "Date TBD"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "rgb(var(--text2))" }}>
          <span className="rounded-md bg-[rgb(var(--platinum))] px-2 py-0.5 text-xs font-semibold">{homeAwayLabel}</span>
          <span className="inline-flex items-start gap-1.5 min-w-0">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="break-words">{game.location?.trim() || "Location TBD"}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Connect to Team Card Component ───────────────────────────────────────────

function ConnectToTeamCard({ user }: { user: SessionUser }) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!code.trim()) {
      setError("Please enter your team code.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/team/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
        credentials: "include",
      })
      const data = (await res.json()) as { success?: boolean; error?: string; teamName?: string }

      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong. Please try again.")
        setLoading(false)
        return
      }

      setSuccess(true)
      setLoading(false)

      // Reload the page after a short delay so the dashboard refreshes with team data
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch {
      setError("A network error occurred. Please check your connection and try again.")
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
        <CardContent className="flex flex-col items-center gap-4 py-8 px-6 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(34,197,94,0.1)" }}
          >
            <Users className="h-8 w-8" style={{ color: "#22C55E" }} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text))" }}>
              Successfully Connected!
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgb(var(--muted))" }}>
              Loading your team dashboard...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
      <CardContent className="flex flex-col gap-4 py-8 px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgb(var(--platinum))" }}
          >
            <Users className="h-8 w-8" style={{ color: "rgb(var(--accent))" }} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text))" }}>
              Connect to Your Team
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgb(var(--muted))" }}>
              Enter your Team Code to access team schedules, roster, messages, and more.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="team-code-input"
              className="text-sm font-semibold"
              style={{ color: "rgb(var(--text))" }}
            >
              Team Code
            </Label>
            <Input
              id="team-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter Team Code (e.g. ABC12345)"
              maxLength={8}
              className="font-mono text-lg tracking-widest text-center"
              style={{
                color: "rgb(var(--text))",
                borderColor: error ? "#EF4444" : "rgb(var(--border))",
              }}
              autoFocus
            />
            <p className="text-xs text-center" style={{ color: "rgb(var(--muted))" }}>
              Get your Team Code from your Head Coach.
            </p>
          </div>

          {error && (
            <div
              className="flex items-start gap-2 rounded-lg border p-3 text-sm"
              style={{
                backgroundColor: "rgba(239,68,68,0.06)",
                borderColor: "rgba(239,68,68,0.25)",
                color: "#EF4444",
              }}
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !code.trim()}
            size="lg"
            className="w-full font-semibold text-white"
            style={{ backgroundColor: "rgb(var(--accent))" }}
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                Connecting...
              </>
            ) : (
              "Connect to Team"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeamDashboard({ session, teamId, canAddCalendarEvents }: TeamDashboardProps) {
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

  const hasTeam = Boolean(teamId)
  const isHeadCoach = user.role?.toUpperCase() === "HEAD_COACH"

  return (
    <div className="min-w-0 space-y-3 pb-2 sm:space-y-4 md:space-y-6 md:pb-6">

      {/* ── Team Banner ── */}
      <TeamBanner user={user} teamId={teamId} />

      {/* ── Connect to Team Card (if no team and not head coach) ── */}
      {!hasTeam && !isHeadCoach && <ConnectToTeamCard user={user} />}

      {/* ── Next game (games table) + home calendar strip ── */}
      {hasTeam && (
        <div className="space-y-3 sm:space-y-4">
          <UpcomingGameCard teamId={teamId} />
          <DashboardCalendar teamId={teamId} canAddEvents={canAddCalendarEvents} />
        </div>
      )}

      {/* ── Announcements + Notifications + Readiness ── */}
      {hasTeam && (
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <DashboardAnnouncementsCard
          teamId={teamId}
          canCreate={canAddCalendarEvents}
          viewerUserId={user.id}
          viewerRole={user.role}
        />
        <NotificationsCard teamId={teamId} />
        <ReadinessSummaryCard teamId={teamId} />
      </div>
      )}

    </div>
  )
}
