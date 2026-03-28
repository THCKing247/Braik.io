"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
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

const CalendarManager = dynamic(
  () => import("@/components/portal/calendar-manager").then((m) => m.CalendarManager),
  {
    loading: () => (
      <div className="min-h-[50vh] w-full animate-pulse rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-md bg-muted" />
          ))}
        </div>
      </div>
    ),
  }
)

export default function CalendarPage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => <CalendarPageContent teamId={teamId} canEdit={canEdit} />}
    </DashboardPageShell>
  )
}

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
  linkedDocuments?: Array<{ document: { id: string; title: string; fileName: string; fileUrl: string; fileSize: number | null; mimeType: string | null } }>
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
  }))
}

function CalendarPageContent({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const [visibleRange, setVisibleRange] = useState<CalendarVisibleRangePayload>(() => defaultCalendarWeekRange())

  const dashQ = useDashboardBootstrapQuery(teamId)

  useEffect(() => {
    const t = teamId.trim()
    if (!t || !dashQ.data?.deferredPending) return
    kickDeferredCoreMerge(t, queryClient)
  }, [teamId, dashQ.data?.deferredPending, queryClient])

  const calQ = useTeamCalendarEventsQuery(
    teamId,
    visibleRange,
    dashQ.data?.dashboard?.calendarEvents ?? null
  )

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
      className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden overflow-y-hidden max-lg:min-h-0 lg:overflow-hidden"
      aria-label="Calendar page root"
    >
      <CalendarManager
        teamId={teamId}
        events={eventsWithDates}
        canEdit={canEdit}
        defaultView="week"
        eventsLoading={eventsLoading}
        onVisibleRangeChange={handleVisibleRangeChange}
        onEventWrite={handleEventWrite}
      />
    </div>
  )
}
