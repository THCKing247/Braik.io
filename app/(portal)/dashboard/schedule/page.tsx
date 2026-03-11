"use client"

import { useEffect, useState } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { ScheduleManager } from "@/components/portal/schedule-manager"

export default function SchedulePage() {
  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <SchedulePageContent teamId={teamId} canEdit={canEdit} />
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

function SchedulePageContent({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
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
    return () => { cancelled = true }
  }, [teamId])

  if (loading) {
    return (
      <div
        className="min-h-[420px] flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white/50"
        aria-label="Schedule content"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  const eventsWithDates = events.map((e) => ({
    ...e,
    start: new Date(e.start),
    end: new Date(e.end),
  }))

  return (
    <div
      className="min-h-[420px] overflow-y-auto overflow-x-hidden rounded-lg border border-[#E5E7EB] bg-white/50 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      aria-label="Schedule content"
    >
      <div className="p-4">
        <ScheduleManager
          teamId={teamId}
          events={eventsWithDates}
          canEdit={canEdit}
          defaultView="week"
        />
      </div>
    </div>
  )
}
