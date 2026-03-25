"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

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
      {({ teamId, canEdit }) => (
        <CalendarPageContent teamId={teamId} canEdit={canEdit} />
      )}
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

function CalendarPageContent({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/teams/${teamId}/calendar/events`)
      .then((res) => {
        if (!res.ok) return []
        return res.json()
      })
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) {
          setEvents(
            (data as Record<string, unknown>[]).map((e) => ({
              ...e,
              rsvps: Array.isArray(e.rsvps) ? e.rsvps : [],
              linkedDocuments: Array.isArray(e.linkedDocuments) ? e.linkedDocuments : [],
            })) as EventItem[]
          )
        }
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  // Mount calendar shell + toolbar immediately; overlay in CalendarManager until events arrive (no full-page blank wait).
  const eventsWithDates = events.map((e) => ({
    ...e,
    start: new Date(e.start),
    end: new Date(e.end),
  }))

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
        eventsLoading={loading}
      />
    </div>
  )
}
