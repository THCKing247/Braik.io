"use client"

import { useState, useEffect, useCallback } from "react"
import { CalendarWidgetEnhanced } from "./calendar-widget-enhanced"
import { CreateEventOverlay, type CreateEventCreatedPayload } from "./create-event-overlay"

interface Event {
  id: string
  type: string
  title: string
  start: Date
  end: Date
  location: string | null
  notes: string | null
  audience: string
  creator: { name: string | null; email: string }
  rsvps: Array<{
    player: { firstName: string; lastName: string }
    status: string
  }>
  linkedDocuments?: Array<{
    document: {
      id: string
      title: string
      fileName: string
      fileUrl: string
      fileSize: number | null
      mimeType: string | null
    }
  }>
}

interface ScheduleManagerProps {
  teamId: string
  events: Event[]
  canEdit: boolean
  defaultView?: "day" | "week" | "month" | "year"
}

export function ScheduleManager({ teamId, events: initialEvents, canEdit, defaultView = "day" }: ScheduleManagerProps) {
  const [events, setEvents] = useState(initialEvents)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKey, setCreateKey] = useState(0)
  const [createRange, setCreateRange] = useState<{ start: Date; end: Date } | null>(null)

  const openCreateModal = useCallback((opts?: { start: Date; end: Date }) => {
    setCreateRange(opts ?? null)
    setCreateKey((k) => k + 1)
    setCreateOpen(true)
  }, [])

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  const handleCreated = useCallback(
    (payload: CreateEventCreatedPayload) => {
      setEvents((prev) => [
        ...prev,
        {
          id: payload.id,
          type: payload.type,
          title: payload.title,
          start: new Date(payload.start),
          end: new Date(payload.end),
          location: payload.location,
          notes: payload.notes,
          audience: payload.audience,
          creator: prev[0]?.creator ?? { name: null, email: "" },
          rsvps: [],
          linkedDocuments: [],
        },
      ])
    },
    []
  )

  const calendarEvents = events.map((event) => ({
    id: event.id,
    eventType: event.type.toUpperCase(),
    title: event.title,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    location: event.location || undefined,
    highlight: false,
    description: event.notes || null,
    creator: event.creator,
    linkedDocuments: event.linkedDocuments,
  }))

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col">
      {canEdit && (
        <CreateEventOverlay
          open={createOpen}
          onOpenChange={setCreateOpen}
          teamId={teamId}
          initialRange={createRange}
          openKey={createKey}
          onCreated={handleCreated}
        />
      )}

      <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden">
        <CalendarWidgetEnhanced
          teamId={teamId}
          events={calendarEvents}
          canEdit={canEdit}
          defaultView={defaultView}
          onCreateEvent={canEdit ? openCreateModal : undefined}
        />
      </div>
    </div>
  )
}
