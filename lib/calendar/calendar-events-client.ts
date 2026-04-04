"use client"

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns"
import type { DashboardBootstrapCalendarEvent } from "@/lib/dashboard/dashboard-bootstrap-types"
import type { TeamCalendarEventApiRow } from "@/lib/teams/cached-team-calendar-events"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

export const CALENDAR_EVENTS_STALE_MS = 5 * 60 * 1000

/** Dispatched on `window` when Coach B (or other flows) create/update calendar data; listeners invalidate React Query + dashboard refetch. */
export const BRAIK_CALENDAR_EVENTS_CHANGED_EVENT = "braik:calendar-events-changed" as const

export type CalendarFetchView = "day" | "week" | "month" | "year" | "agenda"

export type CalendarVisibleRangePayload = {
  start: Date
  end: Date
  view: CalendarFetchView
}

/** ISO instants for API `from` / `to` (inclusive window for overlap filter). */
export function toCalendarRangeIso(start: Date, end: Date): { from: string; to: string } {
  return { from: start.toISOString(), to: end.toISOString() }
}

export function calendarEventsQueryKey(
  teamId: string,
  fromIso: string,
  toIso: string,
  view: string
) {
  return ["calendar-events", teamId.trim(), fromIso, toIso, view] as const
}

export function calendarEventsUrl(teamId: string, fromIso: string, toIso: string) {
  const q = new URLSearchParams({ from: fromIso, to: toIso })
  return `/api/teams/${encodeURIComponent(teamId.trim())}/calendar/events?${q.toString()}`
}

export async function fetchCalendarEventsJson(
  teamId: string,
  fromIso: string,
  toIso: string
): Promise<TeamCalendarEventApiRow[]> {
  const res = await fetchWithTimeout(calendarEventsUrl(teamId, fromIso, toIso), {
    credentials: "same-origin",
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`calendar events ${res.status}`)
  const data = (await res.json()) as unknown
  const rows = Array.isArray(data) ? (data as TeamCalendarEventApiRow[]) : []
  if (process.env.NODE_ENV === "development") {
    console.log("[calendar-events] GET parsed", { teamId, count: rows.length, fromIso, toIso })
  }
  return rows
}

function mapBootstrapRowsToApiShape(
  rows: DashboardBootstrapCalendarEvent[] | undefined | null
): TeamCalendarEventApiRow[] {
  if (!rows?.length) return []
  return rows.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    start: e.start,
    end: e.end,
    location: e.location,
    notes: null,
    audience: "all",
    creator: { name: null, email: "" },
    rsvps: [],
    linkedDocuments: [],
  }))
}

/** Default first-paint range: current week (Sun–Sat), matches `CalendarManager` defaultView="week". */
export function defaultCalendarWeekRange(): CalendarVisibleRangePayload {
  const now = new Date()
  const start = startOfWeek(now, { weekStartsOn: 0 })
  const end = endOfDay(addDays(start, 6))
  return { start, end, view: "week" }
}

export function adjacentCalendarRanges(
  view: CalendarFetchView,
  rangeStart: Date,
  rangeEnd: Date
): { prev: { from: string; to: string }; next: { from: string; to: string } } {
  if (view === "day") {
    const p = subDays(rangeStart, 1)
    const n = addDays(rangeStart, 1)
    return {
      prev: toCalendarRangeIso(startOfDay(p), endOfDay(p)),
      next: toCalendarRangeIso(startOfDay(n), endOfDay(n)),
    }
  }
  if (view === "week" || view === "agenda") {
    const pStart = startOfWeek(subWeeks(rangeStart, 1), { weekStartsOn: 0 })
    const pEnd = endOfDay(addDays(pStart, 6))
    const nStart = startOfWeek(addWeeks(rangeStart, 1), { weekStartsOn: 0 })
    const nEnd = endOfDay(addDays(nStart, 6))
    return {
      prev: toCalendarRangeIso(pStart, pEnd),
      next: toCalendarRangeIso(nStart, nEnd),
    }
  }
  if (view === "month") {
    const pStart = startOfMonth(subMonths(rangeStart, 1))
    const pEnd = endOfMonth(subMonths(rangeStart, 1))
    const nStart = startOfMonth(addMonths(rangeStart, 1))
    const nEnd = endOfMonth(addMonths(rangeStart, 1))
    return {
      prev: toCalendarRangeIso(pStart, pEnd),
      next: toCalendarRangeIso(nStart, nEnd),
    }
  }
  if (view === "year") {
    const pStart = startOfYear(subYears(rangeStart, 1))
    const pEnd = endOfYear(subYears(rangeStart, 1))
    const nStart = startOfYear(addYears(rangeStart, 1))
    const nEnd = endOfYear(addYears(rangeStart, 1))
    return {
      prev: toCalendarRangeIso(pStart, pEnd),
      next: toCalendarRangeIso(nStart, nEnd),
    }
  }
  const p = subDays(rangeStart, 1)
  const n = addDays(rangeStart, 1)
  return {
    prev: toCalendarRangeIso(startOfDay(p), endOfDay(p)),
    next: toCalendarRangeIso(startOfDay(n), endOfDay(n)),
  }
}

export function invalidateTeamCalendarQueries(queryClient: QueryClient, teamId: string) {
  const tid = teamId.trim()
  if (!tid) return
  return queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === "calendar-events" && q.queryKey[1] === tid,
  })
}

export function useTeamCalendarEventsQuery(
  teamId: string,
  range: CalendarVisibleRangePayload | null,
  bootstrapCalendarEvents?: DashboardBootstrapCalendarEvent[] | null
) {
  const queryClient = useQueryClient()
  const tid = teamId.trim()
  const { fromIso, toIso, view } = useMemo(() => {
    if (!range) return { fromIso: "", toIso: "", view: "week" as CalendarFetchView }
    const { from, to } = toCalendarRangeIso(range.start, range.end)
    return { fromIso: from, toIso: to, view: range.view }
  }, [range])

  const placeholderFromBootstrap = useMemo(
    () => mapBootstrapRowsToApiShape(bootstrapCalendarEvents ?? undefined),
    [bootstrapCalendarEvents]
  )

  const query = useQuery({
    queryKey: tid && fromIso && toIso ? calendarEventsQueryKey(tid, fromIso, toIso, view) : ["calendar-events", "__"],
    queryFn: () => fetchCalendarEventsJson(tid, fromIso, toIso),
    enabled: Boolean(tid && fromIso && toIso && range),
    staleTime: CALENDAR_EVENTS_STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => {
      if (previousData && previousData.length > 0) return previousData
      return placeholderFromBootstrap.length > 0 ? placeholderFromBootstrap : undefined
    },
  })

  useEffect(() => {
    if (!tid || !fromIso || !toIso || !range) return
    const { prev, next } = adjacentCalendarRanges(view, range.start, range.end)
    void queryClient.prefetchQuery({
      queryKey: calendarEventsQueryKey(tid, prev.from, prev.to, view),
      queryFn: () => fetchCalendarEventsJson(tid, prev.from, prev.to),
      staleTime: CALENDAR_EVENTS_STALE_MS,
    })
    void queryClient.prefetchQuery({
      queryKey: calendarEventsQueryKey(tid, next.from, next.to, view),
      queryFn: () => fetchCalendarEventsJson(tid, next.from, next.to),
      staleTime: CALENDAR_EVENTS_STALE_MS,
    })
  }, [tid, fromIso, toIso, view, range, queryClient])

  return query
}
