"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import {
  kickDeferredCoreMerge,
  useDashboardBootstrapQuery,
} from "@/lib/dashboard/dashboard-bootstrap-query"
import type { TeamCalendarEventApiRow } from "@/lib/teams/cached-team-calendar-events"
import {
  defaultCalendarWeekRange,
  invalidateTeamCalendarQueries,
  useTeamCalendarEventsQuery,
  type CalendarFetchView,
  type CalendarVisibleRangePayload,
} from "@/lib/calendar/calendar-events-client"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { cn } from "@/lib/utils"

// ── types ─────────────────────────────────────────────────────────────────────

type EventType = "game" | "practice" | "film" | "meeting" | "other"

type AgendaEvent = {
  id: string
  type: EventType
  title: string
  startDate: Date
  endDate: Date
  location: string | null
  notes: string | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function inferEventType(raw: string): EventType {
  const t = raw.toLowerCase()
  if (t.includes("game") || t.includes("match")) return "game"
  if (t.includes("practice") || t.includes("walkthrough") || t.includes("scrimmage")) return "practice"
  if (t.includes("film") || t.includes("video")) return "film"
  if (t.includes("meeting") || t.includes("install")) return "meeting"
  return "other"
}

const TYPE_COLOR: Record<EventType, string> = {
  game: "#FF7A33",
  practice: "#2BD576",
  film: "#4D9BFF",
  meeting: "#FFC63D",
  other: "#92A5CC",
}

function mapApiToAgenda(rows: TeamCalendarEventApiRow[]): AgendaEvent[] {
  return rows.map((e) => ({
    id: e.id,
    type: inferEventType(e.type ?? e.title ?? ""),
    title: e.title,
    startDate: new Date(e.start),
    endDate: new Date(e.end),
    location: e.location,
    notes: e.notes,
  }))
}

function pad(v: number) {
  return String(v).padStart(2, "0")
}

function countdownChip(date: Date): string {
  const ms = date.getTime() - Date.now()
  if (ms <= 0) return "NOW"
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return `IN ${d}D ${pad(h)}H`
}

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function groupByDay(events: AgendaEvent[]): Map<string, AgendaEvent[]> {
  const map = new Map<string, AgendaEvent[]>()
  for (const ev of events) {
    const key = ev.startDate.toDateString()
    const arr = map.get(key) ?? []
    arr.push(ev)
    map.set(key, arr)
  }
  return map
}

function formatTime(d: Date) {
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? "PM" : "AM"
  const hr = h % 12 || 12
  return `${hr}:${pad(m)} ${ampm}`
}

// ── mock data for "up next" hero when no real game event ──────────────────────

const MOCK_NEXT_GAME: AgendaEvent = {
  id: "mock-game",
  type: "game",
  title: "🏈 Game vs Central Eagles",
  startDate: (() => {
    const d = new Date()
    const daysUntilFriday = (5 - d.getDay() + 7) % 7
    d.setDate(d.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday))
    d.setHours(19, 0, 0, 0)
    return d
  })(),
  endDate: (() => {
    const d = new Date()
    const daysUntilFriday = (5 - d.getDay() + 7) % 7
    d.setDate(d.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday))
    d.setHours(21, 30, 0, 0)
    return d
  })(),
  location: "Carver Field",
  notes: "Bus leaves 4:15 sharp",
}

const MOCK_WEEK_EVENTS: AgendaEvent[] = [
  {
    id: "mock-walkthrough",
    type: "practice",
    title: "Walkthrough",
    startDate: (() => { const d = new Date(); d.setHours(16, 0, 0, 0); return d })(),
    endDate: (() => { const d = new Date(); d.setHours(17, 0, 0, 0); return d })(),
    location: "Carver Field",
    notes: "Notes ready",
  },
  MOCK_NEXT_GAME,
  {
    id: "mock-film",
    type: "film",
    title: "Film session",
    startDate: (() => {
      const d = new Date()
      const daysUntilSat = (6 - d.getDay() + 7) % 7
      d.setDate(d.getDate() + (daysUntilSat === 0 ? 7 : daysUntilSat))
      d.setHours(10, 0, 0, 0)
      return d
    })(),
    endDate: new Date(),
    location: "Team room",
    notes: "Semifinal corrections",
  },
  {
    id: "mock-meeting",
    type: "meeting",
    title: "Team meeting",
    startDate: (() => {
      const d = new Date()
      const day = d.getDay()
      const daysUntilMon = (1 - day + 7) % 7
      d.setDate(d.getDate() + (daysUntilMon === 0 ? 7 : daysUntilMon))
      d.setHours(18, 0, 0, 0)
      return d
    })(),
    endDate: new Date(),
    location: null,
    notes: "Red zone install · Pages 12–14",
  },
]

// ── segmented control ─────────────────────────────────────────────────────────

type ScheduleView = "today" | "week" | "month"

function SegmentedControl({ value, onChange }: { value: ScheduleView; onChange: (v: ScheduleView) => void }) {
  const segments: { id: ScheduleView; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
  ]
  return (
    <div className="mb-[14px] flex gap-[6px] rounded-full border border-[rgba(125,155,255,0.14)] bg-white/[0.04] p-[4px]">
      {segments.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn(
            "flex-1 rounded-full py-[8px] text-[12px] font-bold transition-all",
            value === s.id
              ? "bg-gradient-to-r from-[#FF7A33] to-[#FF3D1F] text-[#160A02] shadow-[0_6px_16px_-6px_rgba(255,90,30,0.6)]"
              : "text-[#92A5CC]"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

// ── next game hero card ───────────────────────────────────────────────────────

function NextGameHero({ event, teamName }: { event: AgendaEvent; teamName: string }) {
  const [going, setGoing] = useState(false)
  const [chip, setChip] = useState(() => countdownChip(event.startDate))

  useEffect(() => {
    const id = setInterval(() => setChip(countdownChip(event.startDate)), 10000)
    return () => clearInterval(id)
  }, [event.startDate])

  return (
    <section
      className="mb-[4px] overflow-hidden rounded-[24px] border border-[rgba(255,140,70,0.35)] p-[16px_16px_14px]"
      style={{
        background:
          "radial-gradient(420px 210px at 88% -20%,rgba(255,122,51,0.32),transparent 60%)," +
          "repeating-linear-gradient(90deg,rgba(255,255,255,0.028) 0 1px,transparent 1px 34px)," +
          "linear-gradient(135deg,#16307A 0%,#0B1B4A 55%,#081231 100%)",
        boxShadow: "0 22px 60px -28px rgba(255,100,40,0.45)",
      }}
    >
      <div className="mb-[12px] flex items-center justify-between">
        <span
          className="inline-flex items-center gap-[6px] rounded-[7px] px-[9px] py-[4px] font-black text-[9px] uppercase tracking-[0.1em] text-white"
          style={{ background: "linear-gradient(90deg,#FF3D1F,#FF7A33)" }}
        >
          <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-white" />
          Game · {DAY_NAMES[event.startDate.getDay()]} {formatTime(event.startDate)}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#92A5CC]">Home</span>
      </div>

      <div className="mb-[10px] flex items-center justify-between px-[6px]">
        <div className="flex w-[88px] flex-col items-center gap-[7px]">
          <div
            className="flex h-[56px] w-[56px] items-center justify-center rounded-[18px] border border-white/[0.16] font-black text-[19px] text-[#160A02]"
            style={{ background: "linear-gradient(140deg,#FF7A33,#FF3D1F)" }}
          >
            {teamName?.slice(0, 3).toUpperCase() || "TST"}
          </div>
          <span className="font-black text-[12px] uppercase tracking-[0.05em] text-[#EEF3FF]">
            {teamName?.split(" ")[0] || "Home"}
          </span>
        </div>
        <span className="font-black text-[26px] text-[rgba(238,243,255,0.28)]" style={{ transform: "skewX(-8deg)" }}>
          VS
        </span>
        <div className="flex w-[88px] flex-col items-center gap-[7px]">
          <div
            className="flex h-[56px] w-[56px] items-center justify-center rounded-[18px] border border-white/[0.16] font-black text-[19px] text-[#BFD4FF]"
            style={{ background: "linear-gradient(140deg,#20408C,#0F2358)" }}
          >
            CE
          </div>
          <span className="font-black text-[12px] uppercase tracking-[0.05em] text-[#EEF3FF]">Central Eagles</span>
        </div>
      </div>

      <div className="flex items-center gap-[10px]">
        <p className="flex-1 text-[11.5px] font-medium leading-[1.45] text-[#92A5CC]">
          {event.location || "Home field"} · Gates 5:30
          <br />
          {event.notes || "Bus leaves 4:15 sharp"}
        </p>
        <div className="flex items-center">
          {["#2C4E9E", "#1E6FD9", "#7A4AE0"].map((c, i) => (
            <span
              key={i}
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[#0B1B4A] text-[8px] font-black text-white"
              style={{ background: c, marginLeft: i === 0 ? 0 : -7 }}
            >
              {["JR", "MT", "DK"][i]}
            </span>
          ))}
          <span className="ml-[6px] text-[10.5px] font-semibold text-[#92A5CC]">31 going</span>
        </div>
        <button
          type="button"
          onClick={() => setGoing((p) => !p)}
          className="rounded-[14px] px-[16px] py-[11px] font-bold text-[13px] transition-transform active:scale-[0.96]"
          style={
            going
              ? { background: "linear-gradient(90deg,#2BD576,#17A85A)", color: "#03210F", boxShadow: "0 10px 24px -8px rgba(43,213,118,0.65)" }
              : { background: "linear-gradient(90deg,#FF7A33,#FF3D1F)", color: "#160A02", boxShadow: "0 10px 24px -8px rgba(255,90,30,0.65)" }
          }
        >
          {going ? "You're going ✓" : "I'm going"}
        </button>
      </div>

      {/* countdown chip */}
      <div className="mt-[10px] flex justify-center">
        <span
          className="rounded-[8px] border border-[rgba(255,122,51,0.4)] bg-[rgba(255,122,51,0.12)] px-[9px] py-[5px] font-black text-[10px] uppercase tracking-[0.05em] text-[#FF7A33]"
        >
          {chip}
        </span>
      </div>
    </section>
  )
}

// ── agenda row ────────────────────────────────────────────────────────────────

function AgendaRow({ event }: { event: AgendaEvent }) {
  const isGame = event.type === "game"
  const [chip, setChip] = useState(() => isGame ? countdownChip(event.startDate) : null)

  useEffect(() => {
    if (!isGame) return
    const id = setInterval(() => setChip(countdownChip(event.startDate)), 10000)
    return () => clearInterval(id)
  }, [isGame, event.startDate])

  const color = TYPE_COLOR[event.type]
  const day = event.startDate.getDay()
  const date = event.startDate.getDate()

  return (
    <div
      className="relative mb-[10px] flex items-center gap-[12px] overflow-hidden rounded-[22px] border border-[rgba(125,155,255,0.14)] bg-gradient-to-b from-[#13234E] to-[#0E1B3E] py-[13px] pl-[18px] pr-[14px]"
    >
      {/* left accent bar */}
      <div
        className="absolute bottom-0 left-0 top-0 w-[4px]"
        style={{ background: color }}
      />
      {/* date block */}
      <div className="w-[46px] shrink-0 text-center">
        <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[#92A5CC]">
          {DAY_NAMES[day]}
        </div>
        <div
          className="font-black text-[21px] leading-none text-[#EEF3FF]"
          style={{ transform: "skewX(-5deg)" }}
        >
          {date}
        </div>
      </div>
      {/* info */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold text-[#EEF3FF]">{event.title}</div>
        <div className="mt-[3px] text-[11px] font-medium text-[#92A5CC]">
          {formatTime(event.startDate)}
          {event.location ? ` · ${event.location}` : ""}
          {event.notes ? ` · ${event.notes}` : ""}
        </div>
      </div>
      {/* chevron or countdown chip */}
      {isGame && chip ? (
        <span
          className="shrink-0 rounded-[8px] border border-[rgba(255,122,51,0.4)] bg-[rgba(255,122,51,0.12)] px-[9px] py-[5px] font-black text-[10px] uppercase tracking-[0.05em] text-[#FF7A33] whitespace-nowrap"
        >
          {chip}
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-[#92A5CC]" />
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function PlayerPortalCalendar() {
  const { teamId, teamName } = usePlayerPortal()
  const queryClient = useQueryClient()
  const [view, setView] = useState<ScheduleView>("week")
  const [visibleRange, setVisibleRange] = useState<CalendarVisibleRangePayload>(() => defaultCalendarWeekRange())

  const dashQ = useDashboardBootstrapQuery(teamId)

  useEffect(() => {
    const t = teamId.trim()
    if (!t || !dashQ.data?.deferredPending) return
    kickDeferredCoreMerge(t, queryClient)
  }, [teamId, dashQ.data?.deferredPending, queryClient])

  const calQ = useTeamCalendarEventsQuery(teamId, visibleRange, dashQ.data?.dashboard?.calendarEvents ?? null)

  const agendaEvents = useMemo(
    () => (calQ.data?.length ? mapApiToAgenda(calQ.data) : MOCK_WEEK_EVENTS),
    [calQ.data]
  )

  const nextGame = useMemo(
    () =>
      agendaEvents.find((e) => e.type === "game" && e.startDate > new Date()) ??
      MOCK_NEXT_GAME,
    [agendaEvents]
  )

  const handleVisibleRangeChange = useCallback((payload: { start: Date; end: Date; view: CalendarFetchView }) => {
    setVisibleRange((prev) => {
      if (
        prev.view === payload.view &&
        prev.start.getTime() === payload.start.getTime() &&
        prev.end.getTime() === payload.end.getTime()
      ) return prev
      return { start: payload.start, end: payload.end, view: payload.view }
    })
  }, [])

  const handleEventWrite = useCallback(() => {
    void invalidateTeamCalendarQueries(queryClient, teamId)
  }, [queryClient, teamId])

  void handleVisibleRangeChange
  void handleEventWrite

  const grouped = groupByDay(agendaEvents)
  const sortedDays = [...grouped.keys()].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  const today = new Date().toDateString()
  const rangeStart = agendaEvents[0]?.startDate
  const rangeEnd = agendaEvents[agendaEvents.length - 1]?.startDate
  const rangeLabel =
    rangeStart && rangeEnd
      ? `${MONTH_NAMES[rangeStart.getMonth()]} ${rangeStart.getDate()} – ${MONTH_NAMES[rangeEnd.getMonth()]} ${rangeEnd.getDate()}`
      : ""

  return (
    <div className="mx-auto w-full max-w-lg pb-4 lg:max-w-2xl">
      {/* header */}
      <div className="mb-[14px] flex items-baseline justify-between">
        <span className="font-black text-[22px] uppercase tracking-[0.02em] text-[#EEF3FF]">Schedule</span>
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">{rangeLabel}</span>
      </div>

      <SegmentedControl value={view} onChange={setView} />

      {/* up next hero */}
      <div className="mb-[2px] text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC]">
        Up next
      </div>
      <NextGameHero event={nextGame} teamName={teamName} />

      {/* agenda */}
      <div className="mt-[4px] text-[10px] font-black uppercase tracking-[0.16em] text-[#92A5CC] mb-[9px]">
        This week
      </div>
      {sortedDays.map((dayKey) => {
        const isToday = dayKey === today
        const dayEvents = grouped.get(dayKey) ?? []
        return (
          <div key={dayKey}>
            {isToday ? null : null}
            {dayEvents.map((ev) => (
              <AgendaRow key={ev.id} event={ev} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
