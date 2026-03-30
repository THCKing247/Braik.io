"use client"

import { useState, useEffect, useCallback } from "react"
import { CalendarWidgetEnhanced } from "./calendar-widget-enhanced"
import { CreateEventOverlay, type CreateEventCreatedPayload } from "./create-event-overlay"
import type { CalendarFetchView } from "@/lib/calendar/calendar-events-client"

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
  linkedFollowUpId?: string | null
  followUpPlayerId?: string | null
}

export interface CalendarManagerProps {
  teamId: string
  events: Event[]
  canEdit: boolean
  defaultView?: "day" | "week" | "month" | "year"
  /** When true, show overlay so shell mounts immediately while events fetch completes */
  eventsLoading?: boolean
  /** Visible range / view changes from the grid — for range-scoped event fetching. */
  onVisibleRangeChange?: (payload: { start: Date; end: Date; view: CalendarFetchView }) => void
  /** After a create/replace succeeds — invalidate client cache if using React Query. */
  onEventWrite?: () => void
}

export function CalendarManager({
  teamId,
  events: initialEvents,
  canEdit,
  defaultView = "day",
  eventsLoading = false,
  onVisibleRangeChange,
  onEventWrite,
}: CalendarManagerProps) {
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

  const handleOptimisticCreate = useCallback(
    (d: {
      tempId: string
      type: string
      title: string
      start: string
      end: string
      location: string | null
      notes: string | null
      audience: string
    }) => {
      setEvents((prev) => [
        ...prev,
        {
          id: d.tempId,
          type: d.type,
          title: d.title,
          start: new Date(d.start),
          end: new Date(d.end),
          location: d.location,
          notes: d.notes,
          audience: d.audience,
          creator: prev[0]?.creator ?? { name: null, email: "" },
          rsvps: [],
          linkedDocuments: [],
        },
      ])
    },
    []
  )

  const handleOptimisticRollback = useCallback((tempId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== tempId))
  }, [])

  const handleCreated = useCallback(
    (payload: CreateEventCreatedPayload) => {
      setEvents((prev) => {
        if (payload.replacesTempId) {
          return prev.map((e) =>
            e.id === payload.replacesTempId
              ? {
                  id: payload.id,
                  type: payload.type,
                  title: payload.title,
                  start: new Date(payload.start),
                  end: new Date(payload.end),
                  location: payload.location,
                  notes: payload.notes,
                  audience: payload.audience,
                  creator: e.creator,
                  rsvps: e.rsvps,
                  linkedDocuments: e.linkedDocuments,
                }
              : e
          )
        }
        return [
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
        ]
      })
      onEventWrite?.()
    },
    [onEventWrite]
  )

  const calendarEvents = events.map((event) => ({
    id: event.id,
    eventType: event.type.toUpperCase(),
    title: event.title,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    location: event.location || undefined,
    highlight: false,
    description: event.notes ?? null,
    creator: event.creator,
    linkedDocuments: event.linkedDocuments,
    linkedFollowUpId: event.linkedFollowUpId ?? undefined,
    followUpPlayerId: event.followUpPlayerId ?? undefined,
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
          onOptimisticCreate={handleOptimisticCreate}
          onOptimisticRollback={handleOptimisticRollback}
        />
      )}

      <div className="relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden">
        <CalendarWidgetEnhanced
          teamId={teamId}
          events={calendarEvents}
          canEdit={canEdit}
          defaultView={defaultView}
          onCreateEvent={canEdit ? openCreateModal : undefined}
          onVisibleRangeChange={onVisibleRangeChange}
          onEventWrite={onEventWrite}
        />
        {eventsLoading ? (
          <div
            className="absolute inset-0 z-10 flex items-start justify-center bg-background/85 px-4 pt-6 backdrop-blur-[1px]"
            aria-busy="true"
            aria-label="Loading events"
          >
            <div className="grid w-full max-w-5xl grid-cols-7 gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
