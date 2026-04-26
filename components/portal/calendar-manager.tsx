"use client"

import { useState, useEffect, useCallback } from "react"
import { CalendarWidgetEnhanced } from "./calendar-widget-enhanced"
import {
  CreateEventOverlay,
  type CreateEventCreatedPayload,
  type CreateEventEditingValues,
} from "./create-event-overlay"
import {
  dispatchCalendarEventsChanged,
  type CalendarFetchView,
} from "@/lib/calendar/calendar-events-client"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

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
  linkedGameId?: string | null
  linkedInjuryId?: string | null
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

function dbEventTypeToForm(t: string): CreateEventEditingValues["type"] {
  const u = (t || "").toUpperCase()
  if (u === "PRACTICE") return "practice"
  if (u === "GAME") return "game"
  if (u === "MEETING") return "meeting"
  if (u === "FILM") return "film"
  return "other"
}

function eventToEditingValues(e: Event): CreateEventEditingValues {
  return {
    id: e.id,
    type: dbEventTypeToForm(e.type),
    title: e.title,
    start: e.start,
    end: e.end,
    location: e.location,
    notes: e.notes,
    audience: e.audience,
  }
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
  const { showToast } = usePlaybookToast()
  const [events, setEvents] = useState(initialEvents)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKey, setCreateKey] = useState(0)
  const [createRange, setCreateRange] = useState<{ start: Date; end: Date } | null>(null)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [editKey, setEditKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const openCreateModal = useCallback((opts?: { start: Date; end: Date }) => {
    setEditEvent(null)
    setCreateRange(opts ?? null)
    setCreateKey((k) => k + 1)
    setCreateOpen(true)
  }, [])

  const openEditModal = useCallback((e: Event) => {
    setCreateOpen(false)
    setEditEvent(e)
    setEditKey((k) => k + 1)
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

  const handleUpdated = useCallback(
    (payload: CreateEventCreatedPayload) => {
      setEvents((prev) =>
        prev.map((row) =>
          row.id === payload.id
            ? {
                ...row,
                type: payload.type,
                title: payload.title,
                start: new Date(payload.start),
                end: new Date(payload.end),
                location: payload.location,
                notes: payload.notes,
                audience: payload.audience,
              }
            : row
        )
      )
      onEventWrite?.()
      dispatchCalendarEventsChanged(teamId)
      showToast("Event updated.", "success")
    },
    [onEventWrite, teamId, showToast]
  )

  const confirmDeleteEvent = useCallback(async () => {
    if (!deleteTarget || !teamId) return
    setDeleteLoading(true)
    try {
      const res = await fetchWithTimeout(
        `/api/teams/${encodeURIComponent(teamId)}/calendar/events/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      )
      const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
      if (!res.ok) {
        const code = body.error?.code ?? ""
        let msg = body.error?.message ?? "Could not delete this event."
        if (code === "PERMISSION_DENIED") {
          msg = "You don't have permission to delete events for this team."
        } else if (code === "EVENT_LINKED_TO_GAME") {
          msg = "This event is tied to a game. Remove or change it from Schedule / Games."
        } else if (code === "EVENT_LINKED_TO_FOLLOW_UP") {
          msg = "This event is linked to a follow-up and can't be deleted from the calendar."
        } else if (code === "EVENT_LINKED_TO_INJURY") {
          msg = "This event is linked to an injury record and can't be deleted here."
        }
        showToast(msg, "error")
        return
      }
      setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id))
      onEventWrite?.()
      dispatchCalendarEventsChanged(teamId)
      showToast("Event deleted.", "success")
      setDeleteTarget(null)
    } catch {
      showToast("Could not delete this event.", "error")
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteTarget, teamId, onEventWrite, showToast])

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
      dispatchCalendarEventsChanged(teamId)
    },
    [onEventWrite, teamId]
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
    audience: event.audience,
    creator: event.creator,
    linkedDocuments: event.linkedDocuments,
    linkedFollowUpId: event.linkedFollowUpId ?? undefined,
    followUpPlayerId: event.followUpPlayerId ?? undefined,
    linkedGameId: event.linkedGameId ?? undefined,
    linkedInjuryId: event.linkedInjuryId ?? undefined,
  }))

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col">
      {canEdit && (
        <CreateEventOverlay
          open={createOpen || !!editEvent}
          onOpenChange={(o) => {
            if (!o) {
              setCreateOpen(false)
              setEditEvent(null)
            }
          }}
          teamId={teamId}
          mode={editEvent ? "edit" : "create"}
          editingEvent={editEvent ? eventToEditingValues(editEvent) : null}
          initialRange={createRange}
          openKey={editEvent ? editKey : createKey}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
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
          onRequestEditEvent={
            canEdit
              ? (calEv) => {
                  const row = events.find((e) => e.id === calEv.id)
                  if (row) openEditModal(row)
                }
              : undefined
          }
          onRequestDeleteEvent={canEdit ? (calEv) => {
            const row = events.find((e) => e.id === calEv.id)
            if (row) setDeleteTarget(row)
          } : undefined}
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

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleteLoading && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this event?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this event? This cannot be undone.
          </p>
          {deleteTarget ? (
            <p className="text-sm font-medium text-foreground">&ldquo;{deleteTarget.title}&rdquo;</p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDeleteEvent()} disabled={deleteLoading}>
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
