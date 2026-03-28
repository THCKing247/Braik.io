"use client"

import dynamic from "next/dynamic"
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import {
  useNotificationPollIntervalMs,
  useNotificationsPollingActive,
  useOnDocumentForeground,
} from "@/lib/hooks/use-notifications-polling"
import {
  Trophy,
  Bell,
  Users,
  ImageIcon,
  MapPin,
  Clock,
} from "lucide-react"

const ReadinessSummaryCardLazy = lazy(() => import("@/components/portal/readiness-summary-card"))

const DashboardCalendar = dynamic(
  () => import("@/components/portal/dashboard-calendar").then((m) => m.DashboardCalendar),
  {
    loading: () => (
      <div
        className="h-44 w-full min-w-0 animate-pulse rounded-xl bg-[rgb(var(--platinum))] md:h-52"
        aria-hidden
      />
    ),
  }
)

const DashboardAnnouncementsCard = dynamic(
  () =>
    import("@/components/portal/dashboard-announcements-card").then((m) => m.DashboardAnnouncementsCard),
  {
    loading: () => (
      <div
        className="h-64 min-w-0 animate-pulse rounded-2xl bg-[rgb(var(--platinum))] md:rounded-lg"
        aria-hidden
      />
    ),
  }
)
import { buildNotificationRoute, buildNotificationUrl } from "@/lib/utils/notification-router"
import { getNextUpcomingGame, inferHomeAway, type TeamGameRow } from "@/lib/team-schedule-games"
import { computeTeamRecord, formatRecordLine } from "@/lib/records/compute-team-record"
import { TEAM_GAMES_CHANGED_EVENT } from "@/lib/team-games-events"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"
import type { DashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import type { NotificationApiRow } from "@/lib/notifications/notifications-api-query"
import { useQueryClient } from "@tanstack/react-query"
import {
  kickDeferredCoreMerge,
  useDashboardBootstrapQuery,
} from "@/lib/dashboard/dashboard-bootstrap-query"
import { devDashboardHandoffLog } from "@/lib/debug/dashboard-handoff-dev"
import { DashboardHomeDeferredBootstrapTrigger } from "@/components/portal/dashboard-home-deferred-bootstrap-trigger"

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

/** Announcements / notifications / readiness row — must mount on first paint so widget APIs run on client navigation (no viewport gate). */
function HomeDashboardWidgetsRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-12">{children}</div>
  )
}

// ─── Team Banner ──────────────────────────────────────────────────────────────

function TeamBanner({
  user,
  teamId,
  scheduleGames,
  scheduleGamesLoading,
  prefetchedTeamSummary,
  bootstrapTeamLoading,
  networkSyncHint,
}: {
  user: SessionUser
  teamId: string
  scheduleGames: TeamGameRow[]
  scheduleGamesLoading: boolean
  /** From `/api/dashboard/bootstrap` — avoids a separate GET /api/teams/:id for the header. */
  prefetchedTeamSummary?: { name: string; slogan: string | null; logoUrl: string | null }
  /** While bootstrap is in flight, skip redundant team GET until success or fallback. */
  bootstrapTeamLoading?: boolean
  /** Shown under the welcome line when showing cached data or background refresh. */
  networkSyncHint?: string | null
}) {
  const [teamSummary, setTeamSummary] = useState<{ name: string; slogan: string | null; logoUrl: string | null } | null>(null)
  const [logoBroken, setLogoBroken] = useState(false)
  const hasTeam = Boolean(user.teamId)

  const record = useMemo(() => computeTeamRecord(scheduleGames), [scheduleGames])
  const overallLine = formatRecordLine(record.overall)
  const districtLine = formatRecordLine(record.district)

  useEffect(() => {
    if (!teamId) {
      setTeamSummary(null)
      setLogoBroken(false)
      return
    }
    setLogoBroken(false)
    if (prefetchedTeamSummary) {
      setTeamSummary(prefetchedTeamSummary)
      return
    }
    if (bootstrapTeamLoading) {
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
  }, [teamId, prefetchedTeamSummary, bootstrapTeamLoading])

  const teamName = teamSummary?.name || user.teamName || user.organizationName || "Your Team"
  const lastName = user?.name?.split(" ").slice(-1)[0] || ""
  const roleLabel = getRoleLabel(user.role)
  const logoUrl = logoBroken ? null : (teamSummary?.logoUrl ?? null)

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
              <img
                src={logoUrl}
                alt={`${teamName} logo`}
                className="h-full w-full object-contain"
                onError={() => setLogoBroken(true)}
              />
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
            {networkSyncHint ? (
              <p className="mt-1.5 text-[10px] font-medium text-amber-200/90 sm:text-[11px]" role="status">
                {networkSyncHint}
              </p>
            ) : null}
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
            <div className="mt-0.5 flex items-baseline justify-center">
              <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {scheduleGamesLoading ? "—" : overallLine}
              </span>
            </div>
            <p className="text-[9px] text-white/35 sm:text-[10px]">
              {record.overall.ties > 0 ? "W – L – T" : "W – L"}
            </p>
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
            <div className="mt-0.5 flex items-baseline justify-center">
              <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {scheduleGamesLoading ? "—" : districtLine}
              </span>
            </div>
            <p className="text-[9px] text-white/35 sm:text-[10px]">
              {record.district.ties > 0 ? "W – L – T" : "W – L"}
            </p>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

/** Static shell while the readiness chunk loads (after `DeferredHomeDashboardRow` reveals the row). */
function ReadinessSummarySuspenseFallback() {
  return (
    <Card
      className="h-full rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
      style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      aria-busy
      aria-label="Loading roster readiness"
    >
      <CardHeader className="flex flex-row items-center justify-between px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
        <CardTitle
          className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold"
          style={{ color: "rgb(var(--text))" }}
        >
          <span className="h-4 w-4 shrink-0 rounded bg-[rgb(var(--platinum))] animate-pulse" aria-hidden />
          <span className="h-4 w-32 rounded bg-[rgb(var(--platinum))] animate-pulse" aria-hidden />
        </CardTitle>
        <span className="h-7 w-12 shrink-0 rounded-md bg-[rgb(var(--platinum))] animate-pulse md:h-7" aria-hidden />
      </CardHeader>
      <CardContent className="min-h-[100px] space-y-3 px-4 pb-4 md:px-6 md:pb-6">
        <div className="h-9 w-16 rounded-md bg-[rgb(var(--platinum))] animate-pulse" aria-hidden />
        <div className="h-4 w-full max-w-[220px] rounded bg-[rgb(var(--platinum))] animate-pulse" aria-hidden />
        <div className="h-4 w-full max-w-[180px] rounded bg-[rgb(var(--platinum))] animate-pulse" aria-hidden />
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

function NotificationsCard({
  teamId,
  bootstrapLoading,
  initialNotifications,
}: {
  teamId: string
  bootstrapLoading?: boolean
  /** Mapped from `/api/dashboard/bootstrap` (same shape after client filter). */
  initialNotifications?: DashNotification[]
}) {
  const router = useRouter()
  const shell = useAppBootstrapOptional()
  const shellRef = useRef(shell)
  shellRef.current = shell

  const [notifications, setNotifications] = useState<DashNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [markBusy, setMarkBusy] = useState(false)
  const notifFetchInFlight = useRef(false)

  const load = useCallback(async () => {
    if (!teamId.trim() || notifFetchInFlight.current) return
    notifFetchInFlight.current = true
    try {
      const res = await fetchWithTimeout(
        `/api/notifications?teamId=${encodeURIComponent(teamId)}&limit=15&unreadOnly=true&preview=1`,
        { credentials: "same-origin" }
      )
      if (!res.ok) return
      const data = await res.json()
      const raw = (data.notifications || []) as DashNotification[]
      const list = raw.filter((n) => NOTIFICATION_TYPES_ROSTER_MESSAGES_SCHEDULE.has(n.type))
      setNotifications(list)
      if (typeof data.unreadCount === "number") {
        shellRef.current?.syncUnreadFromServerCount(data.unreadCount)
      }
    } catch {
      /* ignore */
    } finally {
      notifFetchInFlight.current = false
      setLoading(false)
    }
  }, [teamId])

  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (bootstrapLoading) {
      setLoading(true)
      return
    }
    if (initialNotifications !== undefined) {
      setNotifications(initialNotifications)
      setLoading(false)
      return
    }
    void loadRef.current()
  }, [bootstrapLoading, initialNotifications, teamId])

  const pollingAllowed = useNotificationsPollingActive()
  const pollMs = useNotificationPollIntervalMs()

  useEffect(() => {
    if (bootstrapLoading || !pollingAllowed) return
    const interval = setInterval(() => void loadRef.current(), pollMs)
    return () => clearInterval(interval)
  }, [bootstrapLoading, pollingAllowed, pollMs])

  useOnDocumentForeground(
    () => void loadRef.current(),
    !bootstrapLoading && Boolean(teamId)
  )

  const openNotification = async (n: DashNotification) => {
    if (!n.read) {
      const prev = notifications
      setNotifications((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      shell?.applyUnreadDelta(-1)
      try {
        const res = await fetch(`/api/notifications/${n.id}`, { method: "PATCH" })
        if (!res.ok) throw new Error("mark read failed")
        void load()
      } catch {
        setNotifications(prev)
        shell?.applyUnreadDelta(1)
        void shell?.refetch()
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
    const prev = notifications
    const unreadBefore = prev.filter((x) => !x.read).length
    if (unreadBefore === 0) return
    setMarkBusy(true)
    setNotifications([])
    shell?.applyUnreadDelta(-unreadBefore)
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      })
      if (!res.ok) throw new Error("mark all failed")
      void load()
    } catch {
      setNotifications(prev)
      shell?.applyUnreadDelta(unreadBefore)
      void shell?.refetch()
    } finally {
      setMarkBusy(false)
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
            disabled={markBusy}
            onClick={() => void markAllRead()}
          >
            {markBusy ? "Saving…" : "Mark all read"}
          </Button>
        ) : (
          <span className="h-9 w-16 shrink-0 md:h-7" aria-hidden />
        )}
      </CardHeader>
      <CardContent className="scrollbar-hidden max-h-[320px] flex-1 space-y-2 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6">
        {loading ? (
          <div className="space-y-3 py-6" aria-busy="true" aria-label="Loading notifications">
            <div className="h-4 w-full max-w-[240px] animate-pulse rounded bg-[rgb(var(--platinum))]" />
            <div className="h-14 w-full animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
            <div className="h-14 w-full animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
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
                Roster changes, new messages, and schedule updates only. Refreshes when you return here or while you are active on this tab.
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

function UpcomingGameCard({
  teamId,
  scheduleGames,
  loading,
}: {
  teamId: string
  scheduleGames: TeamGameRow[]
  loading: boolean
}) {
  const game = useMemo(() => getNextUpcomingGame(scheduleGames), [scheduleGames])

  const scheduleHref = `/dashboard/schedule?teamId=${encodeURIComponent(teamId)}`

  if (loading) {
    return (
      <Card
        className="h-full min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
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
        className="h-full min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
          <CardTitle className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold" style={{ color: "rgb(var(--text))" }}>
            <Trophy className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
            Next game
          </CardTitle>
          <Link href={scheduleHref} prefetch={false} className="shrink-0">
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
      className="h-full min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
      style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
        <CardTitle className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold" style={{ color: "rgb(var(--text))" }}>
          <Trophy className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
          Next game
        </CardTitle>
        <Link href={scheduleHref} prefetch={false} className="shrink-0">
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

function mapNotificationRowsForHomeCard(rows: NotificationApiRow[]): DashNotification[] {
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    linkUrl: n.linkUrl,
    linkType: n.linkType,
    linkId: n.linkId,
    read: n.read,
    createdAt: n.createdAt,
    type: n.type,
  }))
}

export function TeamDashboard({ session, teamId, canAddCalendarEvents }: TeamDashboardProps) {
  const user = session?.user

  const tid = teamId?.trim() ?? ""
  /** Same team id as `AppBootstrapProvider` (must share one React Query cache). */
  const shell = useAppBootstrapOptional()
  const queryClient = useQueryClient()
  const bootstrapQueryTeamId = (shell?.teamId?.trim() || tid).trim()
  const dashQ = useDashboardBootstrapQuery(bootstrapQueryTeamId)
  const [scheduleGames, setScheduleGames] = useState<TeamGameRow[]>([])
  const [scheduleGamesLoading, setScheduleGamesLoading] = useState(true)
  const [dashNetworkHint, setDashNetworkHint] = useState<string | null>(null)

  /** Ensure deferred-core merge runs on entry (do not rely only on sentinel/timer — AD portal → dashboard must load widgets). */
  useEffect(() => {
    const t = bootstrapQueryTeamId.trim()
    if (!t) return
    kickDeferredCoreMerge(t, queryClient)
  }, [bootstrapQueryTeamId, queryClient])

  useEffect(() => {
    devDashboardHandoffLog("TeamDashboard", {
      teamIdProp: tid,
      shellTeamId: shell?.teamId ?? null,
      bootstrapQueryTeamId,
      queryStatus: dashQ.status,
      isPending: dashQ.isPending,
      isFetching: dashQ.isFetching,
      hasData: Boolean(dashQ.data),
      deferredPending: dashQ.data?.deferredPending,
      dashboardPresent: Boolean(dashQ.data?.dashboard),
    })
  }, [
    tid,
    shell?.teamId,
    bootstrapQueryTeamId,
    dashQ.status,
    dashQ.isPending,
    dashQ.isFetching,
    dashQ.data,
  ])

  const bootstrapAligned: DashboardBootstrapPayload | null | undefined = dashQ.data?.dashboard

  const dashboardBootstrapState = useMemo((): "loading" | "ok" | "fallback" => {
    if (!bootstrapQueryTeamId.trim()) return "fallback"
    if (dashQ.isPending && !dashQ.data) return "loading"
    if (dashQ.isError && !dashQ.data) return "fallback"
    if (dashQ.data?.dashboard) return "ok"
    return "fallback"
  }, [bootstrapQueryTeamId, dashQ.isPending, dashQ.isError, dashQ.data])

  const loadScheduleGames = useCallback(() => {
    const gid = bootstrapQueryTeamId.trim()
    if (!gid) {
      setScheduleGames([])
      setScheduleGamesLoading(false)
      return
    }
    setScheduleGamesLoading(true)
    fetch(`/api/stats/games?teamId=${encodeURIComponent(gid)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { games?: TeamGameRow[] } | null) => {
        if (data?.games && Array.isArray(data.games)) {
          setScheduleGames(data.games)
        } else {
          setScheduleGames([])
        }
      })
      .catch(() => setScheduleGames([]))
      .finally(() => setScheduleGamesLoading(false))
  }, [bootstrapQueryTeamId])

  useEffect(() => {
    if (!bootstrapQueryTeamId.trim()) {
      setScheduleGames([])
      setScheduleGamesLoading(false)
      setDashNetworkHint(null)
      return
    }
    const awaitingCore = dashQ.data?.deferredPending === true
    if (awaitingCore) {
      setScheduleGamesLoading(true)
      setDashNetworkHint(null)
      return
    }
    if (dashQ.data?.dashboard?.games && Array.isArray(dashQ.data.dashboard.games)) {
      setScheduleGames(dashQ.data.dashboard.games)
      setScheduleGamesLoading(false)
      setDashNetworkHint(dashQ.isFetching ? "Refreshing dashboard data…" : null)
    } else if (dashQ.isPending && !dashQ.data) {
      setScheduleGamesLoading(true)
      setDashNetworkHint(null)
    } else if (dashQ.isError && !dashQ.data) {
      setDashNetworkHint(null)
      loadScheduleGames()
    } else if (!dashQ.isPending && !dashQ.data?.dashboard) {
      loadScheduleGames()
    }
  }, [
    bootstrapQueryTeamId,
    dashQ.data?.deferredPending,
    dashQ.data?.dashboard?.games,
    dashQ.data?.dashboard,
    dashQ.isPending,
    dashQ.isFetching,
    dashQ.isError,
    dashQ.data,
    loadScheduleGames,
  ])

  const homeNotificationsFiltered = useMemo(() => {
    const raw = dashQ.data?.notifications?.notifications ?? []
    return mapNotificationRowsForHomeCard(raw).filter((n) =>
      NOTIFICATION_TYPES_ROSTER_MESSAGES_SCHEDULE.has(n.type)
    )
  }, [dashQ.data?.notifications?.notifications])

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ teamId?: string }>
      if (ce.detail?.teamId === bootstrapQueryTeamId) loadScheduleGames()
    }
    window.addEventListener(TEAM_GAMES_CHANGED_EVENT, handler)
    return () => window.removeEventListener(TEAM_GAMES_CHANGED_EVENT, handler)
  }, [bootstrapQueryTeamId, loadScheduleGames])

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
  /** Align all dashboard API calls with `AppBootstrapProvider` / bootstrap query key. */
  const dataTeamId = bootstrapQueryTeamId
  const isHeadCoach = user.role?.toUpperCase() === "HEAD_COACH"
  const awaitingDeferredCore = Boolean(dashQ.data?.deferredPending)

  return (
    <div className="min-w-0 space-y-3 pb-2 sm:space-y-4 md:space-y-6 md:pb-6">

      {/* ── Team Banner ── */}
      <TeamBanner
        user={user}
        teamId={dataTeamId}
        scheduleGames={scheduleGames}
        scheduleGamesLoading={scheduleGamesLoading && !bootstrapAligned}
        prefetchedTeamSummary={
          bootstrapAligned
            ? {
                name: bootstrapAligned.team.name,
                slogan: bootstrapAligned.team.slogan,
                logoUrl: bootstrapAligned.team.logoUrl,
              }
            : undefined
        }
        bootstrapTeamLoading={dashboardBootstrapState === "loading"}
        networkSyncHint={dashNetworkHint}
      />

      {/* ── Connect to Team Card (if no team and not head coach) ── */}
      {!hasTeam && !isHeadCoach && <ConnectToTeamCard user={user} />}

      {/* ── Next game (games table) + home calendar strip ── */}
      {hasTeam && (
        <div className="space-y-3 sm:space-y-4">
          <div className="lg:hidden">
            <UpcomingGameCard teamId={dataTeamId} scheduleGames={scheduleGames} loading={scheduleGamesLoading} />
          </div>
          <DashboardCalendar
            teamId={dataTeamId}
            canAddEvents={canAddCalendarEvents}
            bootstrapLoading={dashboardBootstrapState === "loading"}
            initialCalendarEvents={
              dashboardBootstrapState === "ok" && bootstrapAligned && !awaitingDeferredCore
                ? bootstrapAligned.calendarEvents
                : undefined
            }
          />
        </div>
      )}

      {/* ── Sentinel: loads deferred-core when near viewport or after fallback delay (not on first paint) ── */}
      {hasTeam ? <DashboardHomeDeferredBootstrapTrigger teamId={dataTeamId} /> : null}

      {/* ── Announcements + Notifications + Readiness (deferred until near viewport) ── */}
      {hasTeam && (
        <HomeDashboardWidgetsRow key={dataTeamId}>
          <div className="lg:col-span-4">
            <DashboardAnnouncementsCard
              teamId={dataTeamId}
              canCreate={canAddCalendarEvents}
              viewerUserId={user.id}
              viewerRole={user.role}
              bootstrapLoading={dashboardBootstrapState === "loading"}
              initialAnnouncements={
                dashboardBootstrapState === "ok" && !awaitingDeferredCore ? dashQ.data?.announcements : undefined
              }
            />
          </div>
          <div className="lg:col-span-5">
            <NotificationsCard
              teamId={dataTeamId}
              bootstrapLoading={dashboardBootstrapState === "loading"}
              initialNotifications={
                dashboardBootstrapState === "ok" && !awaitingDeferredCore
                  ? homeNotificationsFiltered
                  : undefined
              }
            />
          </div>
          <div className="space-y-3 sm:space-y-4 lg:col-span-3 lg:flex lg:h-full lg:flex-col lg:space-y-0 lg:gap-6">
            <div className="hidden lg:block lg:flex-1">
              <UpcomingGameCard teamId={dataTeamId} scheduleGames={scheduleGames} loading={scheduleGamesLoading} />
            </div>
            {/* One mount only: `hidden lg:block` + `lg:hidden` still mount both branches and duplicate /readiness?summaryOnly=1 */}
            <div className="shrink-0 lg:flex-1">
              <Suspense fallback={<ReadinessSummarySuspenseFallback />}>
                <ReadinessSummaryCardLazy
                  teamId={dataTeamId}
                  dashboardBootstrapState={dashboardBootstrapState}
                  readinessFromBootstrap={bootstrapAligned?.readiness}
                />
              </Suspense>
            </div>
          </div>
        </HomeDashboardWidgetsRow>
      )}

    </div>
  )
}
