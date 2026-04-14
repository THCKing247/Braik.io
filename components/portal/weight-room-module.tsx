"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  format,
  startOfDay,
  startOfWeek,
} from "date-fns"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Pencil,
  Trash2,
  Trophy,
  Upload,
  X,
} from "lucide-react"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import {
  ThousandLbCertificateDialog,
  type ThousandLbCertificateData,
} from "@/components/portal/weight-room-thousand-lb-certificate"
import { TimePicker } from "@/components/portal/date-time-picker"
import { WorkoutSessionDetailDialog } from "@/components/portal/workout-session-detail-dialog"
import {
  WEIGHT_SESSION_DURATION_PRESETS,
  initialWorkoutEditorRows,
  normalizeWorkoutItemsForSave,
  parseSessionStartTimeToDate,
  parseWorkoutItemsFromDb,
  sessionPickerDateToApiTime,
  type WorkoutItem,
  workoutItemsSummaryLine,
} from "@/lib/weight-room/workout-items"

type TabId = "schedule" | "maxes" | "leaderboard" | "achievements"

const TAB_DEFS: { id: TabId; label: string }[] = [
  { id: "schedule", label: "Schedule" },
  { id: "maxes", label: "Player Maxes" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "achievements", label: "Achievements" },
]

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const LIFT_TYPES = ["BENCH", "SQUAT", "CLEAN", "DEADLIFT"] as const

type ScheduleCalendarView = "day" | "week" | "list"

/** Sunday-first weeks, aligned with `day_of_week` (JS: 0 = Sun … 6 = Sat). */
const SCHEDULE_WEEK_OPTIONS = { weekStartsOn: 0 as const }

function weightRoomScheduleSessionDetail(session: WorkoutSessionRow): string | null {
  const items = parseWorkoutItemsFromDb(session.workout_items)
  const summary = workoutItemsSummaryLine(items, 2)
  if (summary) return summary
  const desc = session.description?.trim()
  if (desc) return desc
  const pg = Array.isArray(session.position_groups) ? (session.position_groups as string[]).filter(Boolean) : []
  return pg.length ? pg.join(", ") : null
}

interface WorkoutSessionRow {
  id: string
  team_id: string
  day_of_week: number
  title: string
  description: string | null
  start_time: string
  duration_minutes: number
  position_groups: string[] | unknown
  /** JSONB array of { lift, reps } */
  workout_items?: unknown
}

interface PlayerMaxRow {
  id: string
  player_id: string
  lift_type: string
  weight_lbs: number
  logged_date: string
  notes: string | null
  created_at: string
}

interface LitePlayer {
  id: string
  firstName: string
  lastName: string
  position_group: string | null
  jerseyNumber: number | null
}

export function WeightRoomModule({ teamId, canEdit = true }: { teamId: string; canEdit?: boolean }) {
  const { showToast } = usePlaybookToast()
  const [tab, setTab] = useState<TabId>("schedule")
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([])
  const [maxes, setMaxes] = useState<PlayerMaxRow[]>([])
  const [roster, setRoster] = useState<LitePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [certOpen, setCertOpen] = useState(false)
  const [certData, setCertData] = useState<ThousandLbCertificateData | null>(null)

  const base = `/api/teams/${encodeURIComponent(teamId)}/weight-room`

  const loadSchedule = useCallback(async () => {
    const res = await fetch(`${base}/schedule`)
    if (!res.ok) throw new Error("Failed to load schedule")
    const data = await res.json()
    setSessions(data.sessions ?? [])
  }, [base])

  const loadMaxes = useCallback(async () => {
    const res = await fetch(`${base}/maxes`)
    if (!res.ok) throw new Error("Failed to load maxes")
    const data = await res.json()
    setMaxes(data.maxes ?? [])
  }, [base])

  const loadRoster = useCallback(async () => {
    const res = await fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}&lite=1`)
    if (!res.ok) return
    const data = await res.json()
    const players = Array.isArray(data) ? data : []
    setRoster(
      players.map(
        (p: {
          id: string
          firstName?: string
          lastName?: string
          positionGroup?: string | null
          jerseyNumber?: number | null
        }) => ({
          id: p.id,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          position_group: p.positionGroup ?? null,
          jerseyNumber: p.jerseyNumber ?? null,
        })
      )
    )
  }, [teamId])

  useEffect(() => {
    setLoading(true)
    setErr(null)
    const loads = [loadSchedule(), loadRoster()] as Promise<unknown>[]
    if (canEdit) loads.push(loadMaxes())
    Promise.all(loads)
      .catch((e) => setErr(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false))
  }, [loadSchedule, loadMaxes, loadRoster, canEdit])

  const positionOptions = useMemo(() => {
    const s = new Set<string>()
    roster.forEach((p) => {
      if (p.position_group?.trim()) s.add(p.position_group.trim())
    })
    return [...s].sort()
  }, [roster])

  const byDay = useMemo(() => {
    const m: Record<number, WorkoutSessionRow[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    sessions.forEach((s) => {
      const d = s.day_of_week
      if (m[d]) m[d].push(s)
    })
    Object.keys(m).forEach((k) => {
      m[Number(k)].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
    })
    return m
  }, [sessions])

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-4 px-4 pb-8 md:px-0">
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Weight room</h1>
          <p className="mt-1 text-sm text-[#64748B]">Schedule, maxes, and team strength leaderboard.</p>
        </div>
        <WeightRoomToolbar teamId={teamId} tab={tab} maxes={maxes} />
      </div>

      <PortalUnderlineTabs
        tabs={TAB_DEFS}
        value={tab}
        onValueChange={(id) => setTab(id as TabId)}
        ariaLabel="Weight room sections"
      />

      {err && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {err}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#0B2A5B] border-t-transparent" />
        </div>
      ) : (
        <>
          {tab === "schedule" && (
            <ScheduleTab
              base={base}
              byDay={byDay}
              roster={roster}
              positionOptions={positionOptions}
              onRefresh={loadSchedule}
              canEdit={canEdit}
            />
          )}
          {tab === "maxes" && (
            <MaxesTab
              base={base}
              maxes={maxes}
              roster={roster}
              positionOptions={positionOptions}
              onRefresh={loadMaxes}
              canEdit={canEdit}
              showToast={showToast}
              onMaxCrossedThousand={async (detail) => {
                const k = `braik-1000lb-cert-${teamId}-${detail.playerId}`
                if (typeof localStorage !== "undefined" && localStorage.getItem(k)) return
                const pl = roster.find((p) => p.id === detail.playerId)
                let teamName = ""
                let headCoachName = ""
                const ar = await fetch(`${base}/achievements`)
                if (ar.ok) {
                  const aj = (await ar.json()) as { teamName?: string; headCoachName?: string }
                  teamName = aj.teamName ?? ""
                  headCoachName = aj.headCoachName ?? ""
                }
                if (typeof localStorage !== "undefined") localStorage.setItem(k, "1")
                setCertData({
                  playerName: pl ? `${pl.firstName} ${pl.lastName}`.trim() : "Player",
                  jerseyNumber: pl?.jerseyNumber ?? null,
                  position: pl?.position_group ?? null,
                  benchLbs: detail.breakdown.benchLbs,
                  squatLbs: detail.breakdown.squatLbs,
                  cleanLbs: detail.breakdown.cleanLbs,
                  combinedThree: detail.threeLiftTotal,
                  dateAchieved: detail.breakdown.dateAchieved,
                  teamName,
                  headCoachName,
                })
                setCertOpen(true)
              }}
            />
          )}
          {tab === "leaderboard" && <LeaderboardTab base={base} positionOptions={positionOptions} />}
          {tab === "achievements" && (
            <AchievementsTab
              base={base}
              canEdit={canEdit}
              onOpenCertificate={(d) => {
                setCertData(d)
                setCertOpen(true)
              }}
            />
          )}
        </>
      )}
      <ThousandLbCertificateDialog
        open={certOpen}
        onOpenChange={(o) => {
          setCertOpen(o)
          if (!o) setCertData(null)
        }}
        data={certData}
      />
    </div>
  )
}

function WeightRoomToolbar({
  teamId,
  tab,
  maxes,
}: {
  teamId: string
  tab: TabId
  maxes: PlayerMaxRow[]
}) {
  const exportCsv = () => {
    const rows = [["playerId", "liftType", "weightLbs", "loggedDate", "notes"]]
    maxes.forEach((m) => {
      rows.push([m.player_id, m.lift_type, String(m.weight_lbs), m.logged_date, (m.notes ?? "").replace(/\n/g, " ")])
    })
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `weight-maxes-${teamId}-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (tab !== "maxes") {
    return null
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={exportCsv}>
        <Download className="mr-1 h-4 w-4" />
        Export CSV
      </Button>
    </div>
  )
}

function WeightRoomScheduleSessionCard({
  session,
  canEdit,
  density,
  onViewDetails,
  onEdit,
  onAttendance,
  onDelete,
}: {
  session: WorkoutSessionRow
  canEdit: boolean
  density: "compact" | "comfortable"
  onViewDetails: () => void
  onEdit: () => void
  onAttendance: () => void
  onDelete: () => void
}) {
  const pad = density === "compact" ? "p-2 text-xs" : "p-3 text-sm"
  const titleCls = density === "compact" ? "text-xs font-semibold" : "text-sm font-semibold"
  const detail = weightRoomScheduleSessionDetail(session)
  return (
    <div
      className={`rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] ${pad}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex gap-1">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onViewDetails}
          aria-label={`View workout: ${session.title}`}
        >
          <p className={`${titleCls} text-[#0F172A]`}>{session.title}</p>
          <p className="text-[#64748B]">
            {String(session.start_time).slice(0, 5)} · {session.duration_minutes} min
          </p>
          {detail ? <p className="mt-0.5 line-clamp-2 text-[#64748B]">{detail}</p> : null}
        </button>
        {canEdit && (
          <div className="flex shrink-0 flex-col gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-[11px]"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              aria-label="Edit session"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-[11px]"
              onClick={(e) => {
                e.stopPropagation()
                onAttendance()
              }}
              aria-label="Attendance"
            >
              <Calendar className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-[11px] text-red-600"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label="Delete session"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ScheduleTab({
  base,
  byDay,
  roster,
  positionOptions,
  onRefresh,
  canEdit,
}: {
  base: string
  byDay: Record<number, WorkoutSessionRow[]>
  roster: LitePlayer[]
  positionOptions: string[]
  onRefresh: () => Promise<void>
  canEdit: boolean
}) {
  const [scheduleView, setScheduleView] = useState<ScheduleCalendarView>("week")
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()))
  const [editor, setEditor] = useState<WorkoutSessionRow | "new" | null>(null)
  /** When opening Add Session from a calendar day, 0–6 (Sun–Sat); null = default (Monday) in dialog */
  const [newSessionInitialDay, setNewSessionInitialDay] = useState<number | null>(null)
  const [attSession, setAttSession] = useState<WorkoutSessionRow | null>(null)
  const [attDate, setAttDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [attMap, setAttMap] = useState<Record<string, "present" | "absent">>({})
  const [detailSession, setDetailSession] = useState<{ session: WorkoutSessionRow; calendarDay: Date } | null>(null)

  const anchorStart = useMemo(() => startOfDay(anchorDate), [anchorDate])
  const weekStart = useMemo(() => startOfWeek(anchorStart, SCHEDULE_WEEK_OPTIONS), [anchorStart])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const listDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  )

  const rangeLabel = useMemo(() => {
    if (scheduleView === "day") {
      return format(anchorStart, "EEEE, MMMM d, yyyy")
    }
    return `${format(weekStart, "MMM d, yyyy")} – ${format(weekEnd, "MMM d, yyyy")}`
  }, [scheduleView, anchorStart, weekStart, weekEnd])

  const navigateBack = () => {
    if (scheduleView === "day") {
      setAnchorDate((d) => addDays(startOfDay(d), -1))
    } else {
      setAnchorDate((d) => addWeeks(startOfDay(d), -1))
    }
  }

  const navigateForward = () => {
    if (scheduleView === "day") {
      setAnchorDate((d) => addDays(startOfDay(d), 1))
    } else {
      setAnchorDate((d) => addWeeks(startOfDay(d), 1))
    }
  }

  const openAttendance = (session: WorkoutSessionRow, calendarDay: Date) => {
    setAttSession(session)
    setAttDate(format(startOfDay(calendarDay), "yyyy-MM-dd"))
  }

  const openWorkoutDetail = (session: WorkoutSessionRow, calendarDay: Date) => {
    setDetailSession({ session, calendarDay })
  }

  const deleteSession = async (session: WorkoutSessionRow) => {
    if (!confirm("Delete this session block?")) return
    const res = await fetch(`${base}/schedule/${session.id}`, { method: "DELETE" })
    if (res.ok) await onRefresh()
  }

  const sessionCardHandlers = (session: WorkoutSessionRow, calendarDay: Date, density: "compact" | "comfortable") => ({
    onViewDetails: () => openWorkoutDetail(session, calendarDay),
    onEdit: () => setEditor(session),
    onAttendance: () => openAttendance(session, calendarDay),
    onDelete: () => void deleteSession(session),
    density,
  })

  useEffect(() => {
    if (!attSession || !attDate) return
    let cancelled = false
    fetch(`${base}/attendance?sessionId=${encodeURIComponent(attSession.id)}&attendanceDate=${encodeURIComponent(attDate)}`)
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((d: { records?: { player_id: string; status: string }[] }) => {
        if (cancelled) return
        const next: Record<string, "present" | "absent"> = {}
        ;(d.records ?? []).forEach((r) => {
          next[r.player_id] = r.status === "absent" ? "absent" : "present"
        })
        setAttMap(next)
      })
    return () => {
      cancelled = true
    }
  }, [attSession, attDate, base])

  const saveAttendance = async () => {
    if (!attSession) return
    const records = roster.map((p) => ({
      playerId: p.id,
      status: attMap[p.id] ?? "present",
    }))
    const res = await fetch(`${base}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: attSession.id, attendanceDate: attDate, records }),
    })
    if (!res.ok) alert("Failed to save attendance")
    else await onRefresh()
  }

  const dayIndex = anchorStart.getDay()
  const daySessions = byDay[dayIndex] ?? []

  const openNewSession = (dayOfWeek?: number) => {
    setNewSessionInitialDay(typeof dayOfWeek === "number" && dayOfWeek >= 0 && dayOfWeek <= 6 ? dayOfWeek : null)
    setEditor("new")
  }

  const closeSessionEditor = () => {
    setEditor(null)
    setNewSessionInitialDay(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {canEdit && (
          <Button
            type="button"
            size="sm"
            className="w-full rounded-lg sm:w-auto"
            onClick={() => openNewSession(scheduleView === "day" ? dayIndex : undefined)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Session
          </Button>
        )}
        <div className="flex w-full min-w-0 flex-col gap-3 sm:ml-auto sm:max-w-md sm:flex-1 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <div className="flex items-center justify-center rounded-lg border border-[#E5E7EB] p-1 sm:justify-end">
            {(["day", "week", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setScheduleView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  scheduleView === v ? "bg-[#0B2A5B] text-white" : "text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex w-full min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
              onClick={navigateBack}
              aria-label={scheduleView === "day" ? "Previous day" : "Previous week"}
            >
              <ChevronLeft className="h-4 w-4 text-[#64748B]" />
            </Button>
            <p className="min-w-0 flex-1 text-center text-sm font-semibold leading-snug text-[#0F172A] sm:text-base">
              {rangeLabel}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
              onClick={navigateForward}
              aria-label={scheduleView === "day" ? "Next day" : "Next week"}
            >
              <ChevronRight className="h-4 w-4 text-[#64748B]" />
            </Button>
          </div>
        </div>
      </div>

      {scheduleView === "day" && (
        <div className="space-y-3">
          {daySessions.length === 0 ? (
            <Card
              className={`border-[#E5E7EB] ${canEdit ? "cursor-pointer transition hover:border-[#0B2A5B]/40 hover:bg-[#F8FAFC]" : ""}`}
              role={canEdit ? "button" : undefined}
              tabIndex={canEdit ? 0 : undefined}
              onClick={() => canEdit && openNewSession(dayIndex)}
              onKeyDown={(e) => {
                if (!canEdit) return
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  openNewSession(dayIndex)
                }
              }}
            >
              <CardContent className="py-10 text-center text-sm text-[#64748B]">
                No sessions scheduled for {format(anchorStart, "EEEE, MMM d")}.
                {canEdit ? (
                  <span className="mt-2 block text-[#0B2A5B] font-medium">Click to add a session for this day</span>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {canEdit ? (
                <button
                  type="button"
                  className="w-full rounded-lg border border-dashed border-[#CBD5E1] bg-white px-3 py-2 text-left text-sm text-[#0B2A5B] transition hover:border-[#0B2A5B]/50 hover:bg-[#F8FAFC]"
                  onClick={() => openNewSession(dayIndex)}
                >
                  <Plus className="mr-1 inline h-4 w-4 align-text-bottom" />
                  Add another session this day
                </button>
              ) : null}
              {daySessions.map((s) => (
                <WeightRoomScheduleSessionCard
                  key={s.id}
                  session={s}
                  canEdit={canEdit}
                  {...sessionCardHandlers(s, anchorStart, "comfortable")}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {scheduleView === "week" && (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
          <div className="grid min-w-[720px] grid-cols-7 gap-2 md:min-w-0 md:gap-3">
            {listDays.map((calDay) => {
              const dow = calDay.getDay()
              const label = DAY_LABELS[dow]
              const dayItems = byDay[dow] ?? []
              return (
                <Card
                  key={calDay.toISOString()}
                  className={`flex min-h-[160px] flex-col border-[#E5E7EB] ${
                    canEdit ? "cursor-pointer transition hover:border-[#0B2A5B]/35 hover:shadow-sm" : ""
                  }`}
                  role={canEdit ? "button" : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  onClick={() => canEdit && openNewSession(dow)}
                  onKeyDown={(e) => {
                    if (!canEdit) return
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openNewSession(dow)
                    }
                  }}
                >
                  <CardContent className="flex flex-1 flex-col p-2">
                    <p className="mb-1 text-center text-[10px] font-bold uppercase leading-tight text-[#64748B]">
                      {label}
                    </p>
                    <p className="mb-2 text-center text-xs font-semibold text-[#0B2A5B]">{format(calDay, "d")}</p>
                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                      {dayItems.length === 0 ? (
                        <p className="text-center text-[10px] text-[#94A3B8]">
                          {canEdit ? "Tap to add" : "—"}
                        </p>
                      ) : (
                        dayItems.map((s) => (
                          <WeightRoomScheduleSessionCard
                            key={s.id}
                            session={s}
                            canEdit={canEdit}
                            {...sessionCardHandlers(s, calDay, "compact")}
                          />
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {scheduleView === "list" && (
        <div className="space-y-0 divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-white">
          {listDays.map((calDay) => {
            const dow = calDay.getDay()
            const rows = byDay[dow] ?? []
            return (
              <section key={calDay.toISOString()} className="px-4 py-4 first:pt-4 last:pb-4">
                <div
                  className={`mb-3 border-b border-[#F1F5F9] pb-2 ${
                    canEdit
                      ? "cursor-pointer rounded-lg px-1 -mx-1 pt-1 transition hover:bg-[#F8FAFC]"
                      : ""
                  }`}
                  role={canEdit ? "button" : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  onClick={() => canEdit && openNewSession(dow)}
                  onKeyDown={(e) => {
                    if (!canEdit) return
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openNewSession(dow)
                    }
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{format(calDay, "EEEE")}</p>
                  <p className="text-lg font-semibold text-[#0F172A]">{format(calDay, "MMMM d, yyyy")}</p>
                  {canEdit ? (
                    <p className="mt-1 text-xs text-[#0B2A5B]">Click to add a session · {format(calDay, "MMM d")}</p>
                  ) : null}
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-[#64748B]">No sessions this day.</p>
                ) : (
                  <ul className="space-y-3">
                    {rows.map((s) => {
                      const detail = weightRoomScheduleSessionDetail(s)
                      return (
                        <li key={s.id}>
                          <div className="flex flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 sm:flex-row sm:items-start sm:justify-between">
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => openWorkoutDetail(s, calDay)}
                            >
                              <p className="font-semibold text-[#0F172A]">{s.title}</p>
                              <p className="mt-0.5 text-sm text-[#64748B]">
                                {format(calDay, "MMM d, yyyy")} · {String(s.start_time).slice(0, 5)} ·{" "}
                                {s.duration_minutes} min
                              </p>
                              {detail ? (
                                <p className="mt-1 text-sm text-[#64748B]">{detail}</p>
                              ) : null}
                            </button>
                            <div className="flex shrink-0 flex-wrap items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                                onClick={() => openWorkoutDetail(s, calDay)}
                              >
                                View workout
                              </Button>
                              {canEdit && (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-2"
                                    onClick={() => setEditor(s)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-2"
                                    onClick={() => openAttendance(s, calDay)}
                                  >
                                    <Calendar className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-2 text-red-600"
                                    onClick={() => void deleteSession(s)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      <SessionDialog
        open={editor !== null}
        onClose={closeSessionEditor}
        base={base}
        canEdit={canEdit}
        session={editor === "new" ? null : editor}
        initialDayOfWeek={editor === "new" ? newSessionInitialDay : null}
        positionOptions={positionOptions}
        onSaved={async () => {
          closeSessionEditor()
          await onRefresh()
        }}
      />

      <WorkoutSessionDetailDialog
        open={detailSession !== null}
        onOpenChange={(o) => {
          if (!o) setDetailSession(null)
        }}
        session={detailSession?.session ?? null}
        calendarDay={detailSession?.calendarDay ?? null}
      />

      <Dialog open={!!attSession} onOpenChange={() => setAttSession(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Attendance — {attSession?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className="mt-1" />
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {roster.map((p) => (
                <label key={p.id} className="flex items-center justify-between gap-2 rounded border border-[#E5E7EB] px-2 py-1.5">
                  <span className="text-sm">
                    {p.lastName}, {p.firstName}
                  </span>
                  <select
                    className="h-8 w-28 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
                    value={attMap[p.id] ?? "present"}
                    onChange={(e) =>
                      setAttMap((m) => ({ ...m, [p.id]: e.target.value as "present" | "absent" }))
                    }
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAttSession(null)}>
              Close
            </Button>
            <Button type="button" onClick={saveAttendance}>
              Save attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type WorkoutPresetRow = {
  id: string
  name: string
  default_title: string | null
  workout_items: unknown
}

function SessionDialog({
  open,
  onClose,
  base,
  canEdit,
  session,
  initialDayOfWeek,
  positionOptions,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  base: string
  canEdit: boolean
  session: WorkoutSessionRow | null
  /** 0–Sun … 6–Sat when creating from a calendar day; null = default Monday */
  initialDayOfWeek: number | null
  positionOptions: string[]
  onSaved: () => Promise<void>
}) {
  const { showToast } = usePlaybookToast()
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [title, setTitle] = useState("")
  const [startTimeDate, setStartTimeDate] = useState<Date | null>(() => parseSessionStartTimeToDate("07:00:00"))
  const [duration, setDuration] = useState(60)
  const [workoutRows, setWorkoutRows] = useState<WorkoutItem[]>([{ lift: "", reps: "" }])
  const [groups, setGroups] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [presets, setPresets] = useState<WorkoutPresetRow[]>([])
  const [presetsLoading, setPresetsLoading] = useState(false)
  const [presetPick, setPresetPick] = useState("")
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null)
  const [newPresetName, setNewPresetName] = useState("")
  const [presetSaving, setPresetSaving] = useState(false)

  const presetsBase = `${base}/presets`

  const loadPresets = useCallback(async () => {
    if (!canEdit) return
    setPresetsLoading(true)
    try {
      const res = await fetch(presetsBase)
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        if (res.status === 403) return
        showToast(
          err.error ??
            "Could not load workout presets. Deploy the `workout_presets` migration to your database, then redeploy.",
          "error"
        )
        return
      }
      const data = (await res.json()) as { presets?: WorkoutPresetRow[] }
      setPresets(data.presets ?? [])
    } finally {
      setPresetsLoading(false)
    }
  }, [canEdit, presetsBase, showToast])

  useEffect(() => {
    if (!open) return
    if (session) {
      setDayOfWeek(session.day_of_week)
      setTitle(session.title)
      setStartTimeDate(parseSessionStartTimeToDate(String(session.start_time)))
      setDuration(session.duration_minutes)
      setWorkoutRows(initialWorkoutEditorRows(session.workout_items, session.description))
      setGroups(Array.isArray(session.position_groups) ? (session.position_groups as string[]) : [])
    } else {
      const dow =
        initialDayOfWeek != null && initialDayOfWeek >= 0 && initialDayOfWeek <= 6 ? initialDayOfWeek : 1
      setDayOfWeek(dow)
      setTitle("")
      setStartTimeDate(parseSessionStartTimeToDate("07:00:00"))
      setDuration(60)
      setWorkoutRows([{ lift: "", reps: "" }])
      setGroups([])
    }
    setPresetPick("")
    setAppliedPresetId(null)
    setNewPresetName("")
  }, [open, session, initialDayOfWeek])

  useEffect(() => {
    if (!open || !canEdit) return
    void loadPresets()
  }, [open, canEdit, loadPresets])

  const toggleGroup = (g: string) => {
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  const addLiftRow = () => setWorkoutRows((r) => [...r, { lift: "", reps: "" }])
  const removeLiftRow = (index: number) =>
    setWorkoutRows((r) => (r.length <= 1 ? r : r.filter((_, i) => i !== index)))
  const setLiftRow = (index: number, field: keyof WorkoutItem, value: string) => {
    setWorkoutRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  const applyPresetById = (id: string) => {
    const p = presets.find((x) => x.id === id)
    if (!p) return
    const rows = parseWorkoutItemsFromDb(p.workout_items)
    setWorkoutRows(rows.length > 0 ? rows.map((r) => ({ ...r })) : [{ lift: "", reps: "" }])
    if (p.default_title?.trim()) setTitle(p.default_title.trim())
    setAppliedPresetId(p.id)
    setPresetPick("")
    showToast(`Loaded preset: ${p.name}`, "success")
  }

  const saveNewPreset = async () => {
    const name = newPresetName.trim()
    if (!name) {
      showToast("Enter a preset name", "error")
      return
    }
    const workoutItems = normalizeWorkoutItemsForSave(workoutRows)
    if (workoutItems.length === 0) {
      showToast("Add at least one lift row first", "error")
      return
    }
    setPresetSaving(true)
    try {
      const res = await fetch(presetsBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          defaultTitle: title.trim() || null,
          workoutItems,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        showToast((e as { error?: string }).error ?? "Could not save preset", "error")
        return
      }
      showToast("Preset saved", "success")
      setNewPresetName("")
      await loadPresets()
    } finally {
      setPresetSaving(false)
    }
  }

  const updateAppliedPreset = async () => {
    if (!appliedPresetId) return
    const p = presets.find((x) => x.id === appliedPresetId)
    if (!p) return
    const workoutItems = normalizeWorkoutItemsForSave(workoutRows)
    if (workoutItems.length === 0) {
      showToast("Add at least one lift row first", "error")
      return
    }
    setPresetSaving(true)
    try {
      const res = await fetch(`${presetsBase}/${appliedPresetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name,
          defaultTitle: title.trim() || null,
          workoutItems,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        showToast((e as { error?: string }).error ?? "Could not update preset", "error")
        return
      }
      showToast("Preset updated", "success")
      await loadPresets()
    } finally {
      setPresetSaving(false)
    }
  }

  const deleteAppliedPreset = async () => {
    if (!appliedPresetId) return
    if (!confirm("Delete this preset from the team library?")) return
    setPresetSaving(true)
    try {
      const res = await fetch(`${presetsBase}/${appliedPresetId}`, { method: "DELETE" })
      if (!res.ok) {
        showToast("Could not delete preset", "error")
        return
      }
      showToast("Preset removed", "success")
      setAppliedPresetId(null)
      await loadPresets()
    } finally {
      setPresetSaving(false)
    }
  }

  const save = async () => {
    if (!startTimeDate) {
      alert("Choose a start time.")
      return
    }
    const workoutItems = normalizeWorkoutItemsForSave(workoutRows)
    const dur = Math.max(1, Math.min(480, Math.round(Number(duration)) || 60))
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        dayOfWeek,
        title: title.trim(),
        startTime: sessionPickerDateToApiTime(startTimeDate),
        durationMinutes: dur,
        positionGroups: groups,
        workoutItems,
        description: null,
      }
      const url = session ? `${base}/schedule/${session.id}` : `${base}/schedule`
      const res = await fetch(url, {
        method: session ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? "Save failed")
        return
      }
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="flex max-h-[min(92vh,840px)] flex-col bg-white sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{session ? "Edit session" : "Add session"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-0.5 py-1">
          <div>
            <Label>Day</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
              value={String(dayOfWeek)}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {DAY_LABELS.map((d, i) => (
                <option key={d} value={String(i)}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Title</Label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session name" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TimePicker
              id="wr-session-start"
              label="Start *"
              variant="inline"
              value={startTimeDate}
              onChange={setStartTimeDate}
              placeholder="Select start time"
            />
            <div>
              <Label htmlFor="wr-session-duration">Duration (minutes)</Label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input
                  id="wr-session-duration"
                  className="min-w-0 flex-1"
                  type="number"
                  min={1}
                  max={480}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
                <select
                  id="wr-session-duration-presets"
                  className="h-10 shrink-0 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm sm:w-44"
                  aria-label="Duration presets: 15 minute steps up to 2 hours"
                  value={
                    WEIGHT_SESSION_DURATION_PRESETS.some((m) => m === duration) ? String(duration) : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value
                    if (v) setDuration(Number(v))
                  }}
                >
                  <option value="">Presets (15 min…2 hr)</option>
                  {WEIGHT_SESSION_DURATION_PRESETS.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Type any duration (up to 480 min) or pick a 15-minute preset up to 2 hours.
              </p>
            </div>
          </div>
          {canEdit && (
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 flex-1 sm:min-w-[220px]">
                  <Label className="text-xs text-[#64748B]">Use preset</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
                    value={presetPick}
                    disabled={presetsLoading || presets.length === 0}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v) applyPresetById(v)
                    }}
                  >
                    <option value="">
                      {presetsLoading ? "Loading…" : presets.length === 0 ? "No presets saved yet" : "— Load a saved workout —"}
                    </option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                {appliedPresetId ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={presetSaving}
                      onClick={() => void updateAppliedPreset()}
                    >
                      Update preset
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-red-600 hover:text-red-700"
                      disabled={presetSaving}
                      onClick={() => void deleteAppliedPreset()}
                    >
                      Delete preset
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 border-t border-[#E5E7EB] pt-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Label className="text-xs text-[#64748B]">Save as new preset</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g. Upper Body Monday"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0 rounded-lg"
                  disabled={presetSaving}
                  onClick={() => void saveNewPreset()}
                >
                  Save preset
                </Button>
              </div>
              <p className="text-[11px] leading-snug text-[#64748B]">
                Presets store lifts and reps (and optional default title). Loading a preset fills this form only — save the session to keep it on the schedule.
              </p>
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="mb-0">Workout</Label>
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={addLiftRow}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add lift
              </Button>
            </div>
            <div className="mt-2 max-h-[min(40vh,280px)] space-y-2 overflow-y-auto pr-0.5">
              {workoutRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    placeholder="Lift"
                    value={row.lift}
                    onChange={(e) => setLiftRow(i, "lift", e.target.value)}
                    aria-label={`Lift ${i + 1}`}
                  />
                  <Input
                    className="min-w-0 flex-1"
                    placeholder="e.g. 3 x 10"
                    value={row.reps}
                    onChange={(e) => setLiftRow(i, "reps", e.target.value)}
                    aria-label={`Reps ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-[#64748B] hover:text-red-600"
                    onClick={() => removeLiftRow(i)}
                    disabled={workoutRows.length <= 1}
                    aria-label="Remove row"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Position groups (optional)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {positionOptions.map((g) => (
                <label key={g} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={groups.includes(g)} onCheckedChange={() => toggleGroup(g)} />
                  {g}
                </label>
              ))}
              {positionOptions.length === 0 && (
                <span className="text-xs text-[#64748B]">
                  No position groups on roster yet — leave all unchecked for whole team.
                </span>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-[#E5E7EB] pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !title.trim() || !startTimeDate} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type MaxImportPreviewRow = {
  lineIndex: number
  jerseyRaw: string
  csvName: string
  status: "matched" | "unmatched" | "invalid"
  player?: LitePlayer
  bench?: number
  squat?: number
  clean?: number
  deadlift?: number
  loggedDate: string
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let i = 0
  let inQuotes = false
  const pushField = () => {
    row.push(field)
    field = ""
  }
  const pushRow = () => {
    rows.push(row)
    row = []
  }
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i += 2
        continue
      }
      if (c === '"') {
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ",") {
      pushField()
      i++
      continue
    }
    if (c === "\n") {
      pushField()
      pushRow()
      i++
      continue
    }
    if (c === "\r") {
      i++
      continue
    }
    field += c
    i++
  }
  pushField()
  if (row.length) pushRow()
  return rows
}

function parseWeightCell(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function ImportMaxesCsvDialog({
  open,
  onClose,
  base,
  roster,
  showToast,
  onImported,
}: {
  open: boolean
  onClose: () => void
  base: string
  roster: LitePlayer[]
  showToast: (message: string, variant?: "success" | "error") => void
  onImported: () => Promise<void>
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [fileLabel, setFileLabel] = useState("")
  const [rawText, setRawText] = useState("")
  const [preview, setPreview] = useState<MaxImportPreviewRow[]>([])
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setFileLabel("")
    setRawText("")
    setPreview([])
  }, [open])

  const defaultDate = () => format(new Date(), "yyyy-MM-dd")

  const downloadTemplate = () => {
    const template =
      "jersey_number,player_name,bench_lbs,squat_lbs,clean_lbs,deadlift_lbs,date_logged\n14,Example Player,225,315,185,275,2026-04-12"
    const blob = new Blob([template], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "player-maxes-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const findByJersey = (jersey: number): LitePlayer | undefined =>
    roster.find((p) => p.jerseyNumber != null && Number(p.jerseyNumber) === jersey)

  const buildPreview = (text: string) => {
    const rows = parseCsv(text)
    if (rows.length < 2) {
      setPreview([])
      return
    }
    const header = rows[0].map((h) => h.trim().toLowerCase())
    const idx = (name: string) => header.indexOf(name)
    const ji = idx("jersey_number")
    const out: MaxImportPreviewRow[] = []
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r]
      const lineIndex = r + 1
      const jerseyRaw = ji >= 0 && cells[ji] != null ? String(cells[ji]) : ""
      const jn = Number(String(jerseyRaw).trim())
      const nameCol = idx("player_name") >= 0 ? String(cells[idx("player_name")] ?? "") : ""
      const bench = idx("bench_lbs") >= 0 ? parseWeightCell(String(cells[idx("bench_lbs")] ?? "")) : null
      const squat = idx("squat_lbs") >= 0 ? parseWeightCell(String(cells[idx("squat_lbs")] ?? "")) : null
      const clean = idx("clean_lbs") >= 0 ? parseWeightCell(String(cells[idx("clean_lbs")] ?? "")) : null
      const deadlift = idx("deadlift_lbs") >= 0 ? parseWeightCell(String(cells[idx("deadlift_lbs")] ?? "")) : null
      let loggedDate = defaultDate()
      const di = idx("date_logged")
      if (di >= 0 && String(cells[di] ?? "").trim()) {
        const d = String(cells[di]).trim().slice(0, 10)
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) loggedDate = d
      }

      if (!Number.isFinite(jn) || !Number.isInteger(jn) || jn < 0 || jn > 99) {
        out.push({
          lineIndex,
          jerseyRaw,
          csvName: nameCol,
          status: "invalid",
          loggedDate,
        })
        continue
      }

      const player = findByJersey(jn)
      if (!player) {
        out.push({
          lineIndex,
          jerseyRaw,
          csvName: nameCol,
          status: "unmatched",
          loggedDate,
        })
        continue
      }

      if (bench == null || squat == null || clean == null || deadlift == null) {
        out.push({
          lineIndex,
          jerseyRaw,
          csvName: nameCol,
          status: "invalid",
          player,
          loggedDate,
        })
        continue
      }

      out.push({
        lineIndex,
        jerseyRaw,
        csvName: nameCol,
        status: "matched",
        player,
        bench,
        squat,
        clean,
        deadlift,
        loggedDate,
      })
    }
    setPreview(out)
  }

  const matchedRows = preview.filter((p) => p.status === "matched")
  const readyCount = matchedRows.length
  const skipCount = preview.length - readyCount

  const runImport = async () => {
    setImporting(true)
    try {
      const lifts = ["BENCH", "SQUAT", "CLEAN", "DEADLIFT"] as const
      const tasks: { label: string; promise: Promise<Response> }[] = []
      for (const row of matchedRows) {
        if (!row.player || row.bench == null || row.squat == null || row.clean == null || row.deadlift == null)
          continue
        const pl = row.player
        const weights = [row.bench, row.squat, row.clean, row.deadlift]
        weights.forEach((w, i) => {
          tasks.push({
            label: `CSV row ${row.lineIndex} (${lifts[i]})`,
            promise: fetch(`${base}/maxes`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerId: pl.id,
                liftType: lifts[i],
                weightLbs: w,
                loggedDate: row.loggedDate,
                notes: null,
              }),
            }),
          })
        })
      }
      const settled = await Promise.all(
        tasks.map(async (t) => {
          const res = await t.promise
          return { label: t.label, ok: res.ok }
        })
      )
      const failed = settled.filter((s) => !s.ok)
      const okCount = settled.filter((s) => s.ok).length
      if (okCount > 0) {
        showToast(`${okCount} maxes imported successfully`, "success")
        await onImported()
      }
      if (failed.length > 0) {
        const sample = failed
          .slice(0, 8)
          .map((f) => f.label)
          .join("; ")
        showToast(
          `Some imports failed (${failed.length}): ${sample}${failed.length > 8 ? "…" : ""}`,
          "error"
        )
      } else if (settled.length === 0 && matchedRows.length === 0) {
        showToast("No rows to import.", "error")
      }
      if (okCount > 0) {
        onClose()
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import maxes from CSV</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-[#64748B]">
              Match players by jersey number. Player name is for reference only.{" "}
              <code className="rounded bg-[#F1F5F9] px-1">date_logged</code> is optional — defaults to today.
            </p>
            <div>
              <Label>CSV file</Label>
              <Input
                className="mt-1"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setFileLabel(f.name)
                  const reader = new FileReader()
                  reader.onload = () => {
                    const text = String(reader.result ?? "")
                    setRawText(text)
                  }
                  reader.readAsText(f)
                }}
              />
              {fileLabel ? <p className="mt-1 text-xs text-[#64748B]">Selected: {fileLabel}</p> : null}
            </div>
            <button
              type="button"
              className="text-sm font-medium text-[#2563EB] underline"
              onClick={downloadTemplate}
            >
              Download template
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#0F172A]">
              {readyCount} rows ready, {skipCount} rows will be skipped
            </p>
            <div className="max-h-[50vh] overflow-auto rounded-lg border border-[#E5E7EB]">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase text-[#64748B]">
                  <tr>
                    <th className="px-2 py-2">Row</th>
                    <th className="px-2 py-2">Jersey</th>
                    <th className="px-2 py-2">CSV name</th>
                    <th className="px-2 py-2">Match</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => {
                    let bg = "bg-white"
                    let statusLabel = ""
                    if (row.status === "matched") {
                      bg = "bg-green-50"
                      statusLabel = "Matched"
                    } else if (row.status === "unmatched") {
                      bg = "bg-amber-50"
                      statusLabel = "Unmatched jersey"
                    } else {
                      bg = "bg-red-50"
                      statusLabel = row.player ? "Invalid lifts" : "Invalid jersey / lifts"
                    }
                    return (
                      <tr key={row.lineIndex} className={`border-t border-[#E5E7EB] ${bg}`}>
                        <td className="px-2 py-1.5 tabular-nums">{row.lineIndex}</td>
                        <td className="px-2 py-1.5">{row.jerseyRaw}</td>
                        <td className="px-2 py-1.5">{row.csvName}</td>
                        <td className="px-2 py-1.5">
                          {row.player ? `${row.player.lastName}, ${row.player.firstName}` : "—"}
                        </td>
                        <td className="px-2 py-1.5 font-medium">{statusLabel}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm text-[#0F172A]">
            <p>
              You are about to import <strong>{readyCount}</strong> row{readyCount === 1 ? "" : "s"} (
              {readyCount * 4} max entries).
            </p>
            <p className="text-[#64748B]">Each row posts four lifts (bench, squat, clean, deadlift) in parallel.</p>
          </div>
        )}

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3)}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={importing} onClick={onClose}>
              Cancel
            </Button>
            {step === 1 && (
              <Button
                type="button"
                disabled={!rawText.trim()}
                onClick={() => {
                  buildPreview(rawText)
                  setStep(2)
                }}
              >
                Next
              </Button>
            )}
            {step === 2 && (
              <Button type="button" disabled={readyCount === 0} onClick={() => setStep(3)}>
                Next
              </Button>
            )}
            {step === 3 && (
              <Button type="button" disabled={importing || readyCount === 0} onClick={runImport}>
                {importing ? "Importing…" : "Confirm import"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MaxesTab({
  base,
  maxes,
  roster,
  positionOptions,
  onRefresh,
  canEdit,
  showToast,
  onMaxCrossedThousand,
}: {
  base: string
  maxes: PlayerMaxRow[]
  roster: LitePlayer[]
  positionOptions: string[]
  onRefresh: () => Promise<void>
  canEdit: boolean
  showToast: (message: string, variant?: "success" | "error") => void
  onMaxCrossedThousand?: (detail: {
    playerId: string
    threeLiftTotal: number
    breakdown: { benchLbs: number; squatLbs: number; cleanLbs: number; dateAchieved: string }
  }) => void | Promise<void>
}) {
  const [liftFilter, setLiftFilter] = useState<string>("ALL")
  const [posFilter, setPosFilter] = useState<string>("ALL")
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
  }, [liftFilter, posFilter])

  const byPlayer = useMemo(() => {
    const m = new Map<string, PlayerMaxRow[]>()
    maxes.forEach((x) => {
      const arr = m.get(x.player_id) ?? []
      arr.push(x)
      m.set(x.player_id, arr)
    })
    m.forEach((arr) => arr.sort((a, b) => new Date(b.logged_date).getTime() - new Date(a.logged_date).getTime()))
    return m
  }, [maxes])

  const filteredRoster = roster.filter((p) => (posFilter === "ALL" ? true : (p.position_group ?? "") === posFilter))

  const totalPlayers = filteredRoster.length
  const totalPages = Math.max(1, Math.ceil(totalPlayers / pageSize) || 1)
  useEffect(() => {
    setCurrentPage((c) => Math.min(c, totalPages))
  }, [totalPlayers, pageSize, totalPages])

  const pageClamped = Math.min(currentPage, totalPages)
  const paginatedRoster = filteredRoster.slice((pageClamped - 1) * pageSize, pageClamped * pageSize)
  const showFrom = totalPlayers === 0 ? 0 : (pageClamped - 1) * pageSize + 1
  const showTo = Math.min(pageClamped * pageSize, totalPlayers)

  const currentFor = (pid: string, lift: string) => {
    const rows = (byPlayer.get(pid) ?? []).filter((r) => r.lift_type === lift)
    return rows[0] ?? null
  }
  const prevFor = (pid: string, lift: string) => {
    const rows = (byPlayer.get(pid) ?? []).filter((r) => r.lift_type === lift)
    return rows[1] ?? null
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Lift</Label>
          <select
            className="mt-1 h-10 w-40 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
            value={liftFilter}
            onChange={(e) => setLiftFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            {LIFT_TYPES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Position</Label>
          <select
            className="mt-1 h-10 w-44 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
            value={posFilter}
            onChange={(e) => setPosFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            {positionOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        {canEdit && (
          <>
            <Button type="button" size="sm" className="rounded-lg" onClick={() => setLogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Log Max
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" />
              Import CSV
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Rows per page</Label>
        <select
          className="h-9 w-[88px] rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number(e.target.value))
            setCurrentPage(1)
          }}
        >
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs font-semibold uppercase text-[#64748B]">
            <tr>
              <th className="px-3 py-2">Player</th>
              {LIFT_TYPES.map((l) => (
                <th key={l} className="px-3 py-2">
                  {l}
                </th>
              ))}
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {paginatedRoster.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-t border-[#E5E7EB]">
                  <td className="px-3 py-2 font-medium text-[#0F172A]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left hover:text-[#3B82F6]"
                      onClick={() => setOpenId((id) => (id === p.id ? null : p.id))}
                    >
                      {openId === p.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {p.lastName}, {p.firstName}
                    </button>
                  </td>
                  {LIFT_TYPES.map((l) => {
                    if (liftFilter !== "ALL" && liftFilter !== l) {
                      return <td key={l} className="px-3 py-2 text-[#94A3B8]">—</td>
                    }
                    const cur = currentFor(p.id, l)
                    const prev = prevFor(p.id, l)
                    let icon = null as React.ReactNode
                    if (cur && prev) {
                      if (cur.weight_lbs > prev.weight_lbs) icon = <ArrowUp className="inline h-3.5 w-3.5 text-green-600" />
                      else if (cur.weight_lbs < prev.weight_lbs) icon = <ArrowDown className="inline h-3.5 w-3.5 text-red-500" />
                      else icon = <span className="text-[#94A3B8">·</span>
                    }
                    return (
                      <td key={l} className="px-3 py-2 tabular-nums">
                        {cur ? (
                          <span>
                            {cur.weight_lbs} {icon}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )
                  })}
                  <td />
                </tr>
                {openId === p.id && (
                  <tr className="bg-[#FAFAFA]">
                    <td colSpan={6} className="px-3 py-2 text-xs text-[#64748B]">
                      <ul className="list-inside list-disc space-y-1">
                        {(byPlayer.get(p.id) ?? []).map((r) => (
                          <li key={r.id}>
                            {r.lift_type} — {r.weight_lbs} lbs @ {r.logged_date}
                            {r.notes ? ` — ${r.notes}` : ""}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#64748B]">
          Showing {showFrom}–{showTo} of {totalPlayers} players
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={pageClamped <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={pageClamped >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <LogMaxDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        base={base}
        roster={roster}
        onSaved={async (detail) => {
          setLogOpen(false)
          await onRefresh()
          if (detail?.crossedThousand && detail.playerId && onMaxCrossedThousand) {
            await onMaxCrossedThousand({
              playerId: detail.playerId,
              threeLiftTotal: detail.threeLiftTotal,
              breakdown: detail.breakdown,
            })
          }
        }}
      />
      <ImportMaxesCsvDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        base={base}
        roster={roster}
        showToast={showToast}
        onImported={onRefresh}
      />
    </div>
  )
}

function LogMaxDialog({
  open,
  onClose,
  base,
  roster,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  base: string
  roster: LitePlayer[]
  onSaved: (
    detail?: {
      crossedThousand: boolean
      playerId: string
      threeLiftTotal: number
      breakdown: { benchLbs: number; squatLbs: number; cleanLbs: number; dateAchieved: string }
    } | null
  ) => Promise<void>
}) {
  const [playerId, setPlayerId] = useState("")
  const [lift, setLift] = useState<string>("BENCH")
  const [weight, setWeight] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!playerId || !weight) return
    setSaving(true)
    try {
      const res = await fetch(`${base}/maxes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          liftType: lift,
          weightLbs: Number(weight),
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? "Failed")
        return
      }
      const json = (await res.json()) as {
        crossedThousand?: boolean
        threeLiftTotal?: number
        threeLiftBreakdown?: {
          benchLbs: number
          squatLbs: number
          cleanLbs: number
          dateAchieved: string
        }
      }
      await onSaved({
        crossedThousand: Boolean(json.crossedThousand),
        playerId,
        threeLiftTotal: Number(json.threeLiftTotal ?? 0),
        breakdown: {
          benchLbs: Number(json.threeLiftBreakdown?.benchLbs ?? 0),
          squatLbs: Number(json.threeLiftBreakdown?.squatLbs ?? 0),
          cleanLbs: Number(json.threeLiftBreakdown?.cleanLbs ?? 0),
          dateAchieved: String(json.threeLiftBreakdown?.dateAchieved ?? "").slice(0, 10) || format(new Date(), "yyyy-MM-dd"),
        },
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log max</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Player</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
            >
              <option value="">Select player</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName}, {p.firstName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Lift</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
              value={lift}
              onChange={(e) => setLift(e.target.value)}
            >
              {LIFT_TYPES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Weight (lbs)</Label>
            <Input className="mt-1" type="number" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeaderboardTab({
  base,
  positionOptions,
}: {
  base: string
  positionOptions: string[]
}) {
  const [scope, setScope] = useState<"overall" | "position">("overall")
  const [pos, setPos] = useState<string>("")
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [data, setData] = useState<{
    overall: { rank: number; name: string; combined: number; bench: number; squat: number; clean: number; dead: number }[]
  } | null>(null)

  useEffect(() => {
    setCurrentPage(1)
  }, [scope, pos])

  useEffect(() => {
    if (scope === "position" && !pos) {
      setData(null)
      return
    }
    const q =
      scope === "position" && pos
        ? `?scope=position&positionGroup=${encodeURIComponent(pos)}`
        : "?scope=overall"
    fetch(`${base}/leaderboard${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
  }, [base, scope, pos])

  const rows = data?.overall ?? []
  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize) || 1)
  useEffect(() => {
    setCurrentPage((c) => Math.min(c, totalPages))
  }, [totalRows, pageSize, totalPages])

  const pageClamped = Math.min(currentPage, totalPages)
  const paginatedRows = rows.slice((pageClamped - 1) * pageSize, pageClamped * pageSize)
  const showFrom = totalRows === 0 ? 0 : (pageClamped - 1) * pageSize + 1
  const showTo = Math.min(pageClamped * pageSize, totalRows)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="sm"
          variant={scope === "overall" ? "default" : "outline"}
          className="rounded-lg"
          onClick={() => setScope("overall")}
        >
          Overall
        </Button>
        <Button
          type="button"
          size="sm"
          variant={scope === "position" ? "default" : "outline"}
          className="rounded-lg"
          onClick={() => setScope("position")}
        >
          By position group
        </Button>
        {scope === "position" && (
          <select
            className="h-10 w-48 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
            value={pos}
            onChange={(e) => setPos(e.target.value)}
          >
            <option value="">Position group</option>
            {positionOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>

      {(scope === "overall" || (scope === "position" && pos)) && (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">Rows per page</Label>
          <select
            className="h-9 w-[88px] rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
      )}

      <Card className="border-[#E5E7EB]">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-[#0F172A]">Combined total (all four lifts)</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((r) => (
                <tr key={r.name + r.rank} className="border-t border-[#E5E7EB]">
                  <td className="px-4 py-2">{r.rank}</td>
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 tabular-nums">{r.combined}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(scope === "overall" || (scope === "position" && pos)) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-3">
              <p className="text-sm text-[#64748B]">
                Showing {showFrom}–{showTo} of {totalRows}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={pageClamped <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={pageClamped >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AchievementsTab({
  base,
  canEdit,
  onOpenCertificate,
}: {
  base: string
  canEdit: boolean
  onOpenCertificate: (data: ThousandLbCertificateData) => void
}) {
  const [data, setData] = useState<{
    thousandLbClub: {
      playerId: string
      name: string
      jerseyNumber: number | null
      positionGroup: string | null
      benchLbs: number
      squatLbs: number
      cleanLbs: number
      combinedThree: number
      dateAchieved: string
    }[]
    recentPRs: unknown[]
    teamName?: string
    headCoachName?: string
  } | null>(null)

  useEffect(() => {
    fetch(`${base}/achievements`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
  }, [base])

  const club = data?.thousandLbClub ?? []

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-4">
          <h3 className="mb-3 font-semibold text-[#0F172A]">1000 lb Club (Bench + Squat + Clean)</h3>
          <div className="space-y-3">
            {club.map((p) => (
              <div
                key={p.playerId}
                className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#0F172A]">{p.name}</p>
                    <p className="text-xs text-[#64748B]">
                      Bench {p.benchLbs} · Squat {p.squatLbs} · Clean {p.cleanLbs} · Total{" "}
                      <span className="font-medium text-[#0F172A]">{p.combinedThree}</span> lbs
                    </p>
                  </div>
                  {p.combinedThree >= 1000 && canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 rounded-lg"
                      onClick={() =>
                        onOpenCertificate({
                          playerName: p.name,
                          jerseyNumber: p.jerseyNumber,
                          position: p.positionGroup,
                          benchLbs: p.benchLbs,
                          squatLbs: p.squatLbs,
                          cleanLbs: p.cleanLbs,
                          combinedThree: p.combinedThree,
                          dateAchieved: p.dateAchieved,
                          teamName: data?.teamName ?? "",
                          headCoachName: data?.headCoachName ?? "",
                        })
                      }
                    >
                      <Trophy className="mr-1 h-4 w-4 text-amber-500" />
                      Generate Certificate
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {club.length === 0 && (
              <p className="text-sm text-[#64748B]">No players at 1,000+ lbs combined yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="border-[#E5E7EB]">
        <CardContent className="p-4">
          <h3 className="mb-2 font-semibold text-[#0F172A]">Recent PRs</h3>
          <ul className="space-y-1 text-xs text-[#64748B]">
            {(data?.recentPRs as { liftType: string; weightLbs: number }[] | undefined)?.slice(0, 12).map((pr, i) => (
              <li key={i}>
                {pr.liftType} — {pr.weightLbs} lbs
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
