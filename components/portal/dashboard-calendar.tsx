"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns"
import { CreateEventOverlay, type CreateEventCreatedPayload } from "@/components/portal/create-event-overlay"
import type { DashboardBootstrapCalendarEvent } from "@/lib/dashboard/dashboard-bootstrap-types"
import { calendarEventsUrl } from "@/lib/calendar/calendar-events-client"

type DashboardCalendarEvent = {
  id: string
  eventType: string
  title: string
  start: string
  end: string
  location?: string
  color?: string
  highlight: boolean
  /** True while the create request is in flight (optimistic row). */
  isPending?: boolean
}

function dashboardCalendarGridRangeIso(month: Date): { from: string; to: string } {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  return { from: weekStart.toISOString(), to: calendarEnd.toISOString() }
}

function mapApiEventsToRows(
  data: Array<{
    id: string
    type: string
    title: string
    start: string
    end: string
    location?: string | null
  }>
): DashboardCalendarEvent[] {
  return data.map((e) => ({
    id: e.id,
    eventType: e.type || "CUSTOM",
    title: e.title || "",
    start: e.start,
    end: e.end,
    location: e.location || undefined,
    color:
      e.type === "GAME"
        ? "#EF4444"
        : e.type === "PRACTICE"
          ? "#10B981"
          : e.type === "MEETING"
            ? "#F59E0B"
            : "#8B5CF6",
    highlight: false,
  }))
}

export type DashboardCalendarProps = {
  teamId: string
  canAddEvents: boolean
  /** From dashboard bootstrap — same fields as calendar API uses for the home grid. When absent after load, we fetch `/api/teams/.../calendar/events`. */
  initialCalendarEvents?: DashboardBootstrapCalendarEvent[] | null
  /** True while parent bootstrap is in flight — avoids a duplicate calendar request during that window. */
  bootstrapLoading?: boolean
}

/**
 * Home dashboard schedule strip + month grid.
 * Create event uses shared CreateEventOverlay (same as Calendar page).
 */
export function DashboardCalendar({
  teamId,
  canAddEvents,
  initialCalendarEvents,
  bootstrapLoading = false,
}: DashboardCalendarProps) {
  const [events, setEvents] = useState<DashboardCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const [createOpen, setCreateOpen] = useState(false)
  const [createKey, setCreateKey] = useState(0)
  const [createRange, setCreateRange] = useState<{ start: Date; end: Date } | null>(null)

  const refetchEventsSilently = useCallback(() => {
    const { from, to } = dashboardCalendarGridRangeIso(currentMonth)
    fetch(calendarEventsUrl(teamId, from, to))
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setEvents(
            mapApiEventsToRows(
              data as Array<{
                id: string
                type: string
                title: string
                start: string
                end: string
                location?: string | null
              }>
            )
          )
        }
      })
      .catch(() => {})
  }, [teamId, currentMonth])

  const mapPayloadToRow = useCallback((p: CreateEventCreatedPayload): DashboardCalendarEvent => {
    const t = (p.type || "CUSTOM").toUpperCase()
    return {
      id: p.id,
      eventType: t,
      title: p.title || "",
      start: p.start,
      end: p.end,
      location: p.location || undefined,
      color:
        t === "GAME"
          ? "#EF4444"
          : t === "PRACTICE"
            ? "#10B981"
            : t === "MEETING"
              ? "#F59E0B"
              : "#8B5CF6",
      highlight: false,
      isPending: false,
    }
  }, [])

  const onOptimisticCreate = useCallback(
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
      const row = mapPayloadToRow({
        id: d.tempId,
        type: d.type,
        title: d.title,
        start: d.start,
        end: d.end,
        location: d.location,
        notes: d.notes,
        audience: d.audience,
      })
      setEvents((prev) => [...prev, { ...row, isPending: true }])
    },
    [mapPayloadToRow]
  )

  const onOptimisticRollback = useCallback((tempId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== tempId))
  }, [])

  const onEventCreated = useCallback(
    (p: CreateEventCreatedPayload) => {
      if (p.replacesTempId) {
        setEvents((prev) =>
          prev.map((e) => (e.id === p.replacesTempId ? mapPayloadToRow(p) : e))
        )
      }
      refetchEventsSilently()
    },
    [mapPayloadToRow, refetchEventsSilently]
  )

  useEffect(() => {
    let cancelled = false

    if (bootstrapLoading) {
      setLoading(true)
      return () => {
        cancelled = true
      }
    }

    if (Array.isArray(initialCalendarEvents) && initialCalendarEvents.length > 0) {
      setEvents(
        mapApiEventsToRows(
          initialCalendarEvents.map((e) => ({
            id: e.id,
            type: e.type,
            title: e.title,
            start: e.start,
            end: e.end,
            location: e.location,
          }))
        )
      )
    }

    setLoading(true)
    const { from, to } = dashboardCalendarGridRangeIso(currentMonth)
    fetch(calendarEventsUrl(teamId, from, to))
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) {
          setEvents(
            mapApiEventsToRows(
              data as Array<{
                id: string
                type: string
                title: string
                start: string
                end: string
                location?: string | null
              }>
            )
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
  }, [teamId, bootstrapLoading, initialCalendarEvents, currentMonth])

  const openCreateForDay = (day: Date) => {
    const start = new Date(day)
    start.setHours(16, 0, 0, 0)
    const end = new Date(day)
    end.setHours(17, 30, 0, 0)
    setCreateRange({ start, end })
    setCreateKey((k) => k + 1)
    setCreateOpen(true)
  }

  const openCreateGeneric = () => {
    setCreateRange(null)
    setCreateKey((k) => k + 1)
    setCreateOpen(true)
  }

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start)
      return isSameDay(eventDate, date)
    })
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({ start: weekStart, end: calendarEnd })

  if (loading) {
    return (
      <Card
        className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
          <CardTitle className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold" style={{ color: "rgb(var(--text))" }}>
            <Calendar className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
            Calendar
          </CardTitle>
          <Link href="/dashboard/calendar" className="shrink-0">
            <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-medium md:h-7 md:px-2" style={{ color: "rgb(var(--accent))" }}>
              Full view
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
          <p className="mb-3 text-center text-xs" style={{ color: "rgb(var(--muted))" }} role="status">
            Loading schedule…
          </p>
          <div className="grid min-h-[280px] grid-cols-7 gap-1" aria-busy="true" aria-label="Calendar loading">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[40px] animate-pulse rounded-md bg-[rgb(var(--platinum))] sm:min-h-[48px]" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {canAddEvents && (
        <CreateEventOverlay
          open={createOpen}
          onOpenChange={setCreateOpen}
          teamId={teamId}
          initialRange={createRange}
          openKey={createKey}
          onCreated={onEventCreated}
          onOptimisticCreate={onOptimisticCreate}
          onOptimisticRollback={onOptimisticRollback}
        />
      )}

      <Card
        className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
          <CardTitle className="flex items-center gap-2 text-sm font-bold md:text-base md:font-semibold" style={{ color: "rgb(var(--text))" }}>
            <Calendar className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--accent))" }} />
            Calendar
          </CardTitle>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            {canAddEvents && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1 px-3 text-xs font-semibold md:h-8"
                style={{ color: "rgb(var(--accent))", borderColor: "rgb(var(--border))" }}
                onClick={openCreateGeneric}
              >
                <Plus className="h-4 w-4" />
                Add event
              </Button>
            )}
            <Link href="/dashboard/calendar">
              <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-medium md:h-7 md:px-2" style={{ color: "rgb(var(--accent))" }}>
                Full view
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 px-3 pb-4 sm:px-5 md:px-6 md:pb-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="h-10 w-10 shrink-0 p-0 md:h-7 md:w-7"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
              <div className="min-w-0 truncate text-center text-sm font-bold md:font-semibold" style={{ color: "rgb(var(--text))" }}>
                {format(currentMonth, "MMMM yyyy")}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="h-10 w-10 shrink-0 p-0 md:h-7 md:w-7"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                <div
                  key={day}
                  className="py-0.5 text-center text-[10px] font-semibold sm:py-1 sm:text-xs"
                  style={{ color: "rgb(var(--muted))" }}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid min-w-0 grid-cols-7 gap-0.5 sm:gap-1">
              {calendarDays.map((day) => {
                const dayEvents = getEventsForDate(day)
                const isToday = isSameDay(day, new Date())
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const cellClass = `min-h-[44px] sm:min-h-[52px] md:min-h-[60px] border rounded p-0.5 sm:p-1 md:p-1.5 cursor-pointer hover:shadow-sm transition-all text-left w-full min-w-0 ${
                  !isCurrentMonth ? "opacity-30" : ""
                } ${isToday ? "ring-2 ring-blue-500" : ""}`
                const cellStyle = {
                  backgroundColor: "#FFFFFF" as const,
                  borderColor: isToday ? "#3B82F6" : "rgb(var(--border))",
                }

                if (canAddEvents) {
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => openCreateForDay(day)}
                      className={cellClass}
                      style={cellStyle}
                      aria-label={`Create event on ${format(day, "MMMM d, yyyy")}`}
                    >
                      <div
                        className={`text-xs font-semibold mb-1 ${isToday ? "text-blue-500" : ""}`}
                        style={!isToday ? { color: "rgb(var(--text))" } : {}}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="pointer-events-none space-y-0.5">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`text-[10px] p-0.5 rounded truncate border-l-2 ${event.isPending ? "opacity-70" : ""}`}
                            style={{
                              backgroundColor: "#FFFFFF",
                              borderLeftColor: event.color || "#3B82F6",
                              borderLeftWidth: "2px",
                            }}
                          >
                            <span className="block truncate" style={{ color: "rgb(var(--text))" }}>
                              {event.title}
                              {event.isPending ? "…" : ""}
                            </span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] font-medium" style={{ color: "rgb(var(--muted))" }}>
                            +{dayEvents.length - 2}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                }

                return (
                  <Link
                    key={day.toISOString()}
                    href="/dashboard/calendar"
                    className={cellClass}
                    style={cellStyle}
                  >
                    <div
                      className={`text-xs font-semibold mb-1 ${isToday ? "text-blue-500" : ""}`}
                      style={!isToday ? { color: "rgb(var(--text))" } : {}}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`text-[10px] p-0.5 rounded truncate border-l-2 ${event.isPending ? "opacity-70" : ""}`}
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderLeftColor: event.color || "#3B82F6",
                            borderLeftWidth: "2px",
                          }}
                        >
                          <span className="block truncate" style={{ color: "rgb(var(--text))" }}>
                            {event.title}
                            {event.isPending ? "…" : ""}
                          </span>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] font-medium" style={{ color: "rgb(var(--muted))" }}>
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
