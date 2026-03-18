"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
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

function combineDateAndTime(date: Date, timeHHmm: string): Date {
  const [h, m] = timeHHmm.split(":").map((x) => parseInt(x, 10))
  const out = new Date(date)
  out.setHours(Number.isFinite(h) ? h : 16, Number.isFinite(m) ? m : 0, 0, 0)
  return out
}

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
  const [qaStartTime, setQaStartTime] = useState("16:00")
  const [qaEndTime, setQaEndTime] = useState("17:30")
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
    setQaTitle("")
    setQaType("practice")
    setQaStartTime("16:00")
    setQaEndTime("17:30")
    setQaLocation("")
    setQaAudience("all")
    setQuickAddOpen(true)
  }

  const handleQuickAddSubmit = async () => {
    if (!quickAddDate) return
    const title = qaTitle.trim()
    if (!title) {
      alert("Please enter a title for the event.")
      return
    }
    const start = combineDateAndTime(quickAddDate, qaStartTime)
    const end = combineDateAndTime(quickAddDate, qaEndTime)
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
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
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
    <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
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

          <div className="grid grid-cols-7 gap-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
              <div key={day} className="text-center text-xs font-semibold py-1" style={{ color: "rgb(var(--muted))" }}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDate(day)
              const isToday = isSameDay(day, new Date())
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const cellClass = `min-h-[60px] border rounded p-1.5 cursor-pointer hover:shadow-sm transition-all text-left w-full ${
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
              <DialogContent className="max-w-md">
                <DialogHeader>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="qa-start" style={{ color: "rgb(var(--text))" }}>
                        Start
                      </Label>
                      <Input id="qa-start" type="time" value={qaStartTime} onChange={(e) => setQaStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="qa-end" style={{ color: "rgb(var(--text))" }}>
                        End
                      </Label>
                      <Input id="qa-end" type="time" value={qaEndTime} onChange={(e) => setQaEndTime(e.target.value)} />
                    </div>
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
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button type="button" variant="outline" onClick={() => setQuickAddOpen(false)} disabled={qaSaving}>
                    Cancel
                  </Button>
                  <Button type="button" variant="ghost" asChild className="hidden sm:inline-flex">
                    <Link href="/dashboard/schedule">Open full schedule</Link>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleQuickAddSubmit}
                    disabled={qaSaving}
                    style={{ backgroundColor: "rgb(var(--accent))" }}
                    className="text-white"
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
