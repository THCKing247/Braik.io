"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DateTimePicker } from "@/components/portal/date-time-picker"
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react"
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
  addHours,
} from "date-fns"

type DashboardCalendarEvent = {
  id: string
  eventType: string
  title: string
  start: string
  end: string
  location?: string
  color?: string
  highlight: boolean
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
}

/**
 * Home dashboard schedule strip + month grid.
 * Quick-add uses POST /api/teams/[teamId]/calendar/events (same as ScheduleManager).
 */
export function DashboardCalendar({ teamId, canAddEvents }: DashboardCalendarProps) {
  const [events, setEvents] = useState<DashboardCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null)
  const [qaTitle, setQaTitle] = useState("")
  const [qaType, setQaType] = useState("practice")
  const [qaStartDate, setQaStartDate] = useState<Date | null>(null)
  const [qaEndDate, setQaEndDate] = useState<Date | null>(null)
  const [qaLocation, setQaLocation] = useState("")
  const [qaAudience, setQaAudience] = useState("all")
  const [qaSaving, setQaSaving] = useState(false)

  const refetchEventsSilently = useCallback(() => {
    fetch(`/api/teams/${teamId}/calendar/events`)
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
  }, [teamId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/teams/${teamId}/calendar/events`)
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
  }, [teamId])

  const openQuickAdd = (day: Date) => {
    setQuickAddDate(day)
    const start = new Date(day)
    start.setHours(16, 0, 0, 0)
    const end = new Date(day)
    end.setHours(17, 30, 0, 0)
    setQaStartDate(start)
    setQaEndDate(end)
    setQaTitle("")
    setQaType("practice")
    setQaLocation("")
    setQaAudience("all")
    setQuickAddOpen(true)
  }

  useEffect(() => {
    if (!qaStartDate) return
    if (!qaEndDate || qaEndDate <= qaStartDate) {
      setQaEndDate(addHours(qaStartDate, 1))
    }
  }, [qaStartDate])

  const handleQuickAddSubmit = async () => {
    if (!quickAddDate || !qaStartDate || !qaEndDate) return
    const title = qaTitle.trim()
    if (!title) {
      alert("Please enter a title for the event.")
      return
    }
    const start = qaStartDate
    const end = qaEndDate
    if (end <= start) {
      alert("End time must be after start time.")
      return
    }
    setQaSaving(true)
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/calendar/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: qaType,
          title,
          start: start.toISOString(),
          end: end.toISOString(),
          location: qaLocation.trim() || null,
          audience: qaAudience,
        }),
      })
      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
        const nested = errBody.error
        const msg =
          (typeof errBody.message === "string" && errBody.message) ||
          (typeof nested === "object" &&
            nested !== null &&
            typeof (nested as { message?: string }).message === "string" &&
            (nested as { message: string }).message) ||
          (typeof nested === "string" && nested) ||
          "Could not create event."
        throw new Error(msg)
      }
      setQuickAddOpen(false)
      setQuickAddDate(null)
      refetchEventsSilently()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not create event.")
    } finally {
      setQaSaving(false)
    }
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
        className="min-w-0 w-full max-w-full border overflow-hidden"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
            <Calendar className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
            Schedule
          </CardTitle>
          <Link href="/dashboard/schedule">
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" style={{ color: "rgb(var(--accent))" }}>
              Full view
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="min-w-0 w-full max-w-full border overflow-hidden"
      style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
          <Calendar className="h-4 w-4" style={{ color: "rgb(var(--accent))" }} />
          Schedule
        </CardTitle>
        <Link href="/dashboard/schedule">
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" style={{ color: "rgb(var(--accent))" }}>
            Full view
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="min-w-0 px-2 sm:px-6">
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
              {format(currentMonth, "MMMM yyyy")}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
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
                    onClick={() => openQuickAdd(day)}
                    className={cellClass}
                    style={cellStyle}
                    aria-label={`Add event on ${format(day, "MMMM d, yyyy")}`}
                  >
                    <div
                      className={`text-xs font-semibold mb-1 ${isToday ? "text-blue-500" : ""}`}
                      style={!isToday ? { color: "rgb(var(--text))" } : {}}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5 pointer-events-none">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-[10px] p-0.5 rounded truncate border-l-2"
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderLeftColor: event.color || "#3B82F6",
                            borderLeftWidth: "2px",
                          }}
                        >
                          <span className="truncate block" style={{ color: "rgb(var(--text))" }}>
                            {event.title}
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
                  href="/dashboard/schedule"
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
                        className="text-[10px] p-0.5 rounded truncate border-l-2"
                        style={{
                          backgroundColor: "#FFFFFF",
                          borderLeftColor: event.color || "#3B82F6",
                          borderLeftWidth: "2px",
                        }}
                      >
                        <span className="truncate block" style={{ color: "rgb(var(--text))" }}>
                          {event.title}
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

          {canAddEvents && quickAddDate && (
            <Dialog
              open={quickAddOpen}
              onOpenChange={(o) => {
                setQuickAddOpen(o)
                if (!o) setQuickAddDate(null)
              }}
            >
              <DialogContent className="max-w-md relative pt-10">
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddOpen(false)
                    setQuickAddDate(null)
                  }}
                  disabled={qaSaving}
                  className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <DialogHeader className="pr-8">
                  <DialogTitle>Quick add event</DialogTitle>
                  <DialogDescription>
                    {format(quickAddDate, "EEEE, MMMM d, yyyy")} — saved to team schedule and calendar for everyone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="qa-title" style={{ color: "rgb(var(--text))" }}>
                      Title *
                    </Label>
                    <Input
                      id="qa-title"
                      value={qaTitle}
                      onChange={(e) => setQaTitle(e.target.value)}
                      placeholder="e.g. Practice, Film, Team dinner"
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="qa-type" style={{ color: "rgb(var(--text))" }}>
                        Type
                      </Label>
                      <select
                        id="qa-type"
                        value={qaType}
                        onChange={(e) => setQaType(e.target.value)}
                        className="flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-white"
                        style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                      >
                        <option value="practice">Practice</option>
                        <option value="game">Game</option>
                        <option value="meeting">Meeting</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="qa-audience" style={{ color: "rgb(var(--text))" }}>
                        Who sees it
                      </Label>
                      <select
                        id="qa-audience"
                        value={qaAudience}
                        onChange={(e) => setQaAudience(e.target.value)}
                        className="flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-white"
                        style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                      >
                        <option value="all">Everyone</option>
                        <option value="players">Players</option>
                        <option value="parents">Parents</option>
                        <option value="staff">Staff only</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DateTimePicker
                      id="qa-start"
                      label="Start *"
                      value={qaStartDate}
                      onChange={setQaStartDate}
                      placeholder="Start date & time"
                      defaultTime={qaStartDate ?? quickAddDate ?? undefined}
                    />
                    <DateTimePicker
                      id="qa-end"
                      label="End *"
                      value={qaEndDate}
                      onChange={setQaEndDate}
                      placeholder="End date & time"
                      minDate={qaStartDate}
                      defaultTime={qaStartDate ? addHours(qaStartDate, 1) : quickAddDate ?? undefined}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qa-loc" style={{ color: "rgb(var(--text))" }}>
                      Location
                    </Label>
                    <Input
                      id="qa-loc"
                      value={qaLocation}
                      onChange={(e) => setQaLocation(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <DialogFooter className="flex flex-row gap-2 sm:gap-3 mt-4">
                  <Button type="button" variant="outline" className="flex-1" asChild>
                    <Link href="/dashboard/schedule">Open full schedule</Link>
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 text-white"
                    onClick={handleQuickAddSubmit}
                    disabled={qaSaving}
                    style={{ backgroundColor: "rgb(var(--accent))" }}
                  >
                    {qaSaving ? "Saving…" : "Add to schedule"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
