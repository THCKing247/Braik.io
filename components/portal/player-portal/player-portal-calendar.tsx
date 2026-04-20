"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
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

const CalendarManager = dynamic(
  () => import("@/components/portal/calendar-manager").then((m) => m.CalendarManager),
  {
    loading: () => (
      <div className="min-h-[50vh] w-full animate-pulse rounded-xl border border-white/40 bg-white/90 p-4 shadow-inner">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-md bg-indigo-100/80" />
          ))}
        </div>
      </div>
    ),
  }
)

type EventItem = {
  id: string
  type: string
  title: string
  start: string
  end: string
  location: string | null
  notes: string | null
  audience: string
  creator: { name: string | null; email: string }
  rsvps: Array<{ player: { firstName: string; lastName: string }; status: string }>
  linkedDocuments?: Array<{
    document: { id: string; title: string; fileName: string; fileUrl: string; fileSize: number | null; mimeType: string | null }
  }>
  linkedFollowUpId?: string | null
  followUpPlayerId?: string | null
  linkedGameId?: string | null
  linkedInjuryId?: string | null
}

function mapApiToEventItems(rows: TeamCalendarEventApiRow[]): EventItem[] {
  return rows.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    start: e.start,
    end: e.end,
    location: e.location,
    notes: e.notes,
    audience: e.audience,
    creator: e.creator,
    rsvps: Array.isArray(e.rsvps) ? e.rsvps : [],
    linkedDocuments: Array.isArray(e.linkedDocuments) ? e.linkedDocuments : [],
    linkedFollowUpId: e.linkedFollowUpId ?? null,
    followUpPlayerId: e.followUpPlayerId ?? null,
    linkedGameId: e.linkedGameId ?? null,
    linkedInjuryId: e.linkedInjuryId ?? null,
  }))
}

export function PlayerPortalCalendar() {
  const { teamId } = usePlayerPortal()
  const queryClient = useQueryClient()
  const [visibleRange, setVisibleRange] = useState<CalendarVisibleRangePayload>(() => defaultCalendarWeekRange())

  const dashQ = useDashboardBootstrapQuery(teamId)

  useEffect(() => {
    const t = teamId.trim()
    if (!t || !dashQ.data?.deferredPending) return
    kickDeferredCoreMerge(t, queryClient)
  }, [teamId, dashQ.data?.deferredPending, queryClient])

  const calQ = useTeamCalendarEventsQuery(teamId, visibleRange, dashQ.data?.dashboard?.calendarEvents ?? null)

  const events = useMemo(() => mapApiToEventItems(calQ.data ?? []), [calQ.data])

  const handleVisibleRangeChange = useCallback((payload: { start: Date; end: Date; view: CalendarFetchView }) => {
    setVisibleRange((prev) => {
      if (
        prev.view === payload.view &&
        prev.start.getTime() === payload.start.getTime() &&
        prev.end.getTime() === payload.end.getTime()
      ) {
        return prev
      }
      return { start: payload.start, end: payload.end, view: payload.view }
    })
  }, [])

  const handleEventWrite = useCallback(() => {
    void invalidateTeamCalendarQueries(queryClient, teamId)
  }, [queryClient, teamId])

  const eventsWithDates = events.map((e) => ({
    ...e,
    start: new Date(e.start),
    end: new Date(e.end),
  }))

  const eventsLoading = calQ.isFetching && events.length === 0

  return (
    <div
      className="flex min-h-[min(720px,calc(100dvh-13rem))] w-full flex-col overflow-hidden rounded-2xl border border-white/40 bg-white shadow-xl"
      aria-label="Player calendar"
    >
      <CalendarManager
        teamId={teamId}
        events={eventsWithDates}
        canEdit={false}
        defaultView="week"
        eventsLoading={eventsLoading}
        onVisibleRangeChange={handleVisibleRangeChange}
        onEventWrite={handleEventWrite}
      />
    </div>
  )
}
