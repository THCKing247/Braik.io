"use client"

import { useState, useEffect } from "react"
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
  /** Same permission as ScheduleManager canEdit */
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

      <div className="relative flex min-w-0 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
        {/* Left: Logo + name */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {/* Team logo or placeholder */}
          <div
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border-2 border-white/20 bg-white/10 overflow-hidden"
            title={hasTeam ? "Team logo" : "Connect to a team"}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={`${teamName} logo`} className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-7 w-7 text-white/50" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/60">
              {hasTeam ? `Welcome back, ${roleLabel === "Head Coach" ? "Coach" : roleLabel}${lastName ? ` ${lastName}` : ""}` : `Welcome, ${user.name || roleLabel}`}
            </p>
            <h1
              className="break-words text-xl font-bold uppercase tracking-tight text-white sm:text-2xl md:text-3xl"
              style={{ fontFamily: "var(--font-teko, var(--font-oswald, sans-serif))" }}
            >
              {hasTeam ? teamName : "Welcome to Your Portal"}
            </h1>
            <p className="mt-0.5 text-xs text-white/50">{hasTeam ? roleLabel : "Connect to a team to get started"}</p>
          </div>
        </div>

        {/* Right: Record (only show if has team) */}
        {hasTeam && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-4 sm:gap-5 md:justify-end">
          {/* Overall record */}
          <div className="text-center min-w-[4.5rem]">
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

          <div className="hidden h-10 w-px bg-white/15 sm:block" aria-hidden />

          {/* District record */}
          <div className="text-center min-w-[4.5rem]">
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
        )}
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
    <Card className="border h-full" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
          <ClipboardCheck className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
          Roster Readiness
        </CardTitle>
        <Link href={`/dashboard/roster?teamId=${teamId}`}>
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" style={{ color: "rgb(var(--accent))" }}>
            View
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
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
    <div className="min-w-0 space-y-4 pb-4 md:pb-6">

      {/* ── Team Banner ── */}
      <TeamBanner user={user} teamId={teamId} />

      {/* ── Connect to Team Card (if no team and not head coach) ── */}
      {!hasTeam && !isHeadCoach && <ConnectToTeamCard user={user} />}

      {/* ── Full-width Calendar (effective team matches schedule page) ── */}
      {hasTeam && (
        <DashboardCalendar teamId={teamId} canAddEvents={canAddCalendarEvents} />
      )}

      {/* ── Updates + Notifications + Readiness (coach) ── */}
      {hasTeam && (
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <UpdatesCard />
        <NotificationsCard />
        <ReadinessSummaryCard teamId={teamId} />
      </div>
      )}

    </div>
  )
}
