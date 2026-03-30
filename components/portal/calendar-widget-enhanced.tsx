"use client"

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react"
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  getYear,
  getMonth,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfDay,
  endOfDay,
  isToday as isTodayDate,
  isSameYear,
  addHours,
} from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react"
import { EventDetailModal } from "./event-detail-modal"
import { DayEventsModal } from "./day-events-modal"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface CalendarEvent {
  id: string
  eventType: string
  title: string
  start: string
  end: string
  location?: string
  color?: string
  highlight: boolean
  description?: string | null
  linkedFollowUpId?: string
  followUpPlayerId?: string
}

type CalendarView = "agenda" | "day" | "week" | "month" | "year"

interface CalendarWidgetProps {
  teamId: string
  events: CalendarEvent[]
  canEdit: boolean
  onEventClick?: (event: CalendarEvent) => void
  /** Open create-event modal; optional start/end from day/week grid selection */
  onCreateEvent?: (opts?: { start: Date; end: Date }) => void
  defaultView?: "day" | "week" | "month" | "year"
  /** Fired when the visible date range or view changes — parent can refetch events for that window. */
  onVisibleRangeChange?: (payload: {
    start: Date
    end: Date
    view: CalendarView
  }) => void
  /** After follow-up resolved from event detail or similar — parent should refetch calendar */
  onEventWrite?: () => void
}

/** One day column height in px (24h × px/hour). Day and week time grids render a single bounded range — no stacked copies. */
const DAY_VIEW_HOUR_HEIGHT = 60
const DAY_VIEW_HOURS_PER_DAY = 24
const DAY_VIEW_DAY_HEIGHT = DAY_VIEW_HOUR_HEIGHT * DAY_VIEW_HOURS_PER_DAY
const SLOT_SNAP_MINUTES = 15
const AGENDA_WEEKS_INITIAL = 2
const AGENDA_WEEKS_MAX = 16
const SWIPE_THRESHOLD_PX = 56

function pxToSnappedMinutes(py: number): number {
  const m = (py / DAY_VIEW_HOUR_HEIGHT) * 60
  return Math.max(0, Math.min(24 * 60 - SLOT_SNAP_MINUTES, Math.round(m / SLOT_SNAP_MINUTES) * SLOT_SNAP_MINUTES))
}

interface CalendarFilter {
  id: string
  name: string
  color: string
  enabled: boolean
}

export function CalendarWidgetEnhanced({
  teamId,
  events: initialEvents,
  canEdit,
  onEventClick,
  onCreateEvent,
  defaultView = "day",
  onVisibleRangeChange,
  onEventWrite,
}: CalendarWidgetProps) {
  const [view, setView] = useState<CalendarView>((defaultView as CalendarView) || "week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [mobileCalendarsOpen, setMobileCalendarsOpen] = useState(false)

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    if (mq.matches) return
    if (window.innerWidth < 768) setView("agenda")
    else setView("day")
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const onChange = () => {
      if (mq.matches) {
        setView((prev) =>
          prev === "agenda" ? ((defaultView as CalendarView) || "week") : prev
        )
        return
      }
      const narrow = window.innerWidth < 768
      setView((prev) => {
        if (narrow && (prev === "week" || prev === "month" || prev === "year")) return "agenda"
        if (!narrow && prev === "agenda") return "day"
        return prev
      })
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [defaultView])
  const [events, setEvents] = useState(initialEvents)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventDetail, setShowEventDetail] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showDayEvents, setShowDayEvents] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(new Date())
  const timeGridScrollRef = useRef<HTMLDivElement | null>(null)
  const agendaLoadMoreRef = useRef<HTMLDivElement | null>(null)
  const [agendaWeekSpan, setAgendaWeekSpan] = useState(AGENDA_WEEKS_INITIAL)
  const swipeRef = useRef<{ x: number; t: number } | null>(null)
  /** Picked time on the grid (blue dashed line) — separate from the red “now” line */
  const [slotPreview, setSlotPreview] = useState<{ dateKey: string; minutes: number } | null>(null)

  const visibleRange = useMemo(() => {
    if (view === "day") {
      const start = startOfDay(currentDate)
      return { start, end: endOfDay(currentDate) }
    }
    if (view === "week" || view === "agenda") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      const end = endOfDay(addDays(start, view === "agenda" ? agendaWeekSpan * 7 - 1 : 6))
      return { start, end }
    }
    if (view === "month") {
      return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }
    }
    if (view === "year") {
      return { start: startOfYear(currentDate), end: endOfYear(currentDate) }
    }
    return { start: startOfDay(currentDate), end: endOfDay(currentDate) }
  }, [view, currentDate, agendaWeekSpan])

  useEffect(() => {
    onVisibleRangeChange?.({ start: visibleRange.start, end: visibleRange.end, view })
  }, [visibleRange.start, visibleRange.end, view, onVisibleRangeChange])

  const getSlotFromPointer = useCallback(
    (clientX: number, clientY: number): { dateKey: string; minutes: number } | null => {
      const el = timeGridScrollRef.current
      if (!el || (view !== "day" && view !== "week")) return null
      const rect = el.getBoundingClientRect()
      if (clientY < rect.top || clientY > rect.bottom) return null
      const yContent = clientY - rect.top + el.scrollTop
      const clampedY = Math.max(0, Math.min(DAY_VIEW_DAY_HEIGHT - 1, yContent))
      const minutes = pxToSnappedMinutes(clampedY)
      if (view === "day") {
        if (clientX - rect.left < 80) return null
        return { dateKey: format(currentDate, "yyyy-MM-dd"), minutes }
      }
      const xContent = clientX - rect.left + el.scrollLeft
      if (xContent < 80) return null
      const totalW = Math.max(el.scrollWidth - 80, 1)
      const colW = totalW / 7
      const col = Math.min(6, Math.max(0, Math.floor((xContent - 80) / colW)))
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 })
      const day = addDays(ws, col)
      return { dateKey: format(day, "yyyy-MM-dd"), minutes }
    },
    [view, currentDate]
  )

  const handleTimeGridPointerMove = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit || !onCreateEvent) return
      if ((e.target as HTMLElement).closest("[data-calendar-event]")) {
        setSlotPreview(null)
        return
      }
      const slot = getSlotFromPointer(e.clientX, e.clientY)
      setSlotPreview(slot)
    },
    [canEdit, onCreateEvent, getSlotFromPointer]
  )

  const handleTimeGridPointerLeave = useCallback(() => {
    setSlotPreview(null)
  }, [])

  const handleTimeGridClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit || !onCreateEvent) return
      if ((e.target as HTMLElement).closest("[data-calendar-event]")) return
      const slot = getSlotFromPointer(e.clientX, e.clientY)
      if (!slot) return
      const [yy, mm, dd] = slot.dateKey.split("-").map(Number)
      const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0)
      start.setMinutes(slot.minutes)
      onCreateEvent({ start, end: addHours(start, 1) })
    },
    [canEdit, onCreateEvent, getSlotFromPointer]
  )
  
  // Event-type filters only. Events that do not map to a type (team/default) are always shown.
  const [calendarFilters, setCalendarFilters] = useState<CalendarFilter[]>([
    { id: "practice", name: "Practices", color: "#10B981", enabled: true },
    { id: "game", name: "Games", color: "#EF4444", enabled: true },
    { id: "meeting", name: "Meetings", color: "#F59E0B", enabled: true },
    { id: "other", name: "Other", color: "#8B5CF6", enabled: true },
  ])

  const mapEventToTypeFilterId = useCallback((eventType: string): string | null => {
    const t = (eventType || "").toLowerCase()
    if (t === "practice") return "practice"
    if (t === "game") return "game"
    if (t === "meeting") return "meeting"
    if (t === "custom" || t === "other") return "other"
    return null
  }, [])

  // Map event type to sidebar category color so schedule blocks match "My calendars" colors
  const getEventTypeColor = useCallback((eventType: string) => {
    const t = (eventType || "").toLowerCase()
    if (t === "practice") return "#10B981"
    if (t === "game") return "#EF4444"
    if (t === "meeting") return "#F59E0B"
    if (t === "custom" || t === "other") return "#8B5CF6"
    return "#3B82F6" // Team Events / default
  }, [])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const fid = mapEventToTypeFilterId(event.eventType)
      if (fid === null) return true
      const filter = calendarFilters.find((f) => f.id === fid)
      return filter?.enabled ?? true
    })
  }, [events, calendarFilters, mapEventToTypeFilterId])

  const filteredEventsInVisibleRange = useMemo(() => {
    return filteredEvents.filter((ev) => {
      const d = new Date(ev.start)
      return d >= visibleRange.start && d <= visibleRange.end
    })
  }, [filteredEvents, visibleRange])

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Helper: current time offset in pixels (60px per hour). Used for now-line position and initial scroll.
  const getNowOffsetPx = useCallback(() => {
    const now = currentTime
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    return (nowMinutes / 60) * DAY_VIEW_HOUR_HEIGHT
  }, [currentTime])

  // Auto-scroll once when entering day/week: bring “now” into view (single bounded grid, no loop).
  useEffect(() => {
    if ((view !== "day" && view !== "week") || !timeGridScrollRef.current) return
    const el = timeGridScrollRef.current
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const nowOffset = (nowMinutes / 60) * DAY_VIEW_HOUR_HEIGHT
    const maxScroll = Math.max(0, DAY_VIEW_DAY_HEIGHT - el.clientHeight)
    if (view === "day") {
      const desiredViewportOffset = 0.3 * el.clientHeight
      const targetScroll = nowOffset - desiredViewportOffset
      el.scrollTop = Math.max(0, Math.min(maxScroll, targetScroll))
    } else {
      el.scrollTop = Math.max(0, Math.min(maxScroll, nowOffset - el.clientHeight * 0.15))
    }
  }, [view, currentDate])

  useEffect(() => {
    if (view === "agenda") setAgendaWeekSpan(AGENDA_WEEKS_INITIAL)
  }, [view, currentDate])

  useEffect(() => {
    if (view !== "agenda") return
    const sentinel = agendaLoadMoreRef.current
    if (!sentinel) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setAgendaWeekSpan((w) => Math.min(AGENDA_WEEKS_MAX, w + 1))
        }
      },
      { root: null, rootMargin: "240px", threshold: 0 }
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [view, agendaWeekSpan])

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter((event) => {
      const eventDate = new Date(event.start)
      return isSameDay(eventDate, date)
    })
  }

  const handleDayClick = (day: Date) => {
    setSelectedDay(day)
    setShowDayEvents(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    if (onEventClick) {
      onEventClick(event)
    } else {
      setSelectedEvent(event)
      setShowEventDetail(true)
    }
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setMiniCalendarMonth(today)
  }

  const navigateDate = useCallback(
    (direction: "prev" | "next") => {
      if (view === "week" || view === "agenda") {
        const next = direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)
        setCurrentDate(next)
        setMiniCalendarMonth(next)
      } else if (view === "month") {
        setCurrentDate(direction === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
      } else if (view === "year") {
        setCurrentDate(direction === "next" ? addYears(currentDate, 1) : subYears(currentDate, 1))
      } else {
        setCurrentDate(direction === "next" ? addDays(currentDate, 1) : addDays(currentDate, -1))
      }
    },
    [view, currentDate]
  )

  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    if (typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches) return
    if (view !== "day" && view !== "week") return
    const t = e.touches[0]
    if (!t) return
    swipeRef.current = { x: t.clientX, t: Date.now() }
  }, [view])

  const handleSwipeTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches) return
      if (view !== "day" && view !== "week") return
      const start = swipeRef.current
      swipeRef.current = null
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
      if (Date.now() - start.t > 600) return
      if (dx < 0) navigateDate("next")
      else navigateDate("prev")
    },
    [view, navigateDate]
  )

  const handleMiniCalendarDateClick = (date: Date) => {
    setCurrentDate(date)
    setMiniCalendarMonth(date)
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileCalendarsOpen(false)
    }
  }

  const renderAgendaView = () => {
    const anchorWeekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const agendaDays = Array.from({ length: agendaWeekSpan * 7 }, (_, i) => addDays(anchorWeekStart, i))
    const todayStart = startOfDay(new Date())
    const tomorrowStart = addDays(todayStart, 1)

    return (
      <div
        className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden pb-[max(7rem,calc(5.25rem+env(safe-area-inset-bottom,0px)))] md:pb-[max(8rem,calc(5.75rem+env(safe-area-inset-bottom,0px)))] lg:space-y-4 lg:pb-6"
      >
        {agendaDays.map((day) => {
          const dayEvents = getEventsForDate(day).sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
          )
          let sectionLabel: string
          if (isSameDay(day, todayStart)) sectionLabel = `Today · ${format(day, "MMM d")}`
          else if (isSameDay(day, tomorrowStart)) sectionLabel = `Tomorrow · ${format(day, "MMM d")}`
          else sectionLabel = format(day, "EEEE, MMM d")

          return (
            <section
              key={day.toISOString()}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "rgb(var(--border))" }}
            >
              <div
                className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b bg-white/95 px-4 py-3 backdrop-blur-sm"
                style={{ borderColor: "rgb(var(--border))" }}
              >
                <h2 className="min-w-0 text-sm font-semibold tracking-tight" style={{ color: "rgb(var(--text))" }}>
                  {sectionLabel}
                </h2>
                {canEdit && onCreateEvent && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 px-2.5 text-xs font-semibold"
                    onClick={() => {
                      const s = new Date(day)
                      s.setHours(9, 0, 0, 0)
                      onCreateEvent({ start: s, end: addHours(s, 1) })
                    }}
                  >
                    Add
                  </Button>
                )}
              </div>
              <div className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
                {dayEvents.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-4 py-5 text-center">
                    <span className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                      No events
                    </span>
                    {canEdit && onCreateEvent && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs font-semibold"
                        style={{ color: "rgb(var(--accent))" }}
                        onClick={() => {
                          const s = new Date(day)
                          s.setHours(9, 0, 0, 0)
                          onCreateEvent({ start: s, end: addHours(s, 1) })
                        }}
                      >
                        Create event
                      </Button>
                    )}
                  </div>
                ) : (
                  dayEvents.map((event) => {
                    const es = new Date(event.start)
                    const ee = new Date(event.end)
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => handleEventClick(event)}
                        className="flex w-full min-w-0 gap-3 px-4 py-5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
                      >
                        <div
                          className="mt-0.5 h-14 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: getEventTypeColor(event.eventType) }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold leading-tight" style={{ color: "rgb(var(--text))" }}>
                            {event.title}
                          </div>
                          <div className="mt-1.5 text-sm" style={{ color: "rgb(var(--text2))" }}>
                            {format(es, "h:mm a")} – {format(ee, "h:mm a")}
                          </div>
                          <div className="mt-1 text-xs font-medium capitalize" style={{ color: "rgb(var(--muted))" }}>
                            {event.eventType}
                          </div>
                          {event.location ? (
                            <div className="mt-1.5 truncate text-sm" style={{ color: "rgb(var(--text2))" }}>
                              📍 {event.location}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </section>
          )
        })}
        {agendaWeekSpan < AGENDA_WEEKS_MAX ? (
          <div ref={agendaLoadMoreRef} className="h-8 w-full shrink-0" aria-hidden />
        ) : null}
      </div>
    )
  }

  // Render Year View
  const renderYearView = () => {
    const yearStart = startOfYear(currentDate)
    const yearEnd = endOfYear(currentDate)
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd })

    return (
      <div className="w-full max-w-full min-w-0 space-y-4 pb-[max(7rem,calc(5.25rem+env(safe-area-inset-bottom,0px)))] md:pb-[max(8rem,calc(5.75rem+env(safe-area-inset-bottom,0px)))] lg:pb-0">
        <div className="grid grid-cols-3 gap-6">
          {months.map((month) => {
            const monthStart = startOfMonth(month)
            const monthEnd = endOfMonth(month)
            // Only get days from the current month
            const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

            // Group days by week
            const weeks: Date[][] = []
            let currentWeek: Date[] = []

            monthDays.forEach((day) => {
              const dayOfWeek = day.getDay()

              if (dayOfWeek === 0 && currentWeek.length > 0) {
                weeks.push(currentWeek)
                currentWeek = []
              }
              
              if (weeks.length === 0 && currentWeek.length === 0 && dayOfWeek !== 0) {
                for (let i = 0; i < dayOfWeek; i++) {
                  currentWeek.push(null as any)
                }
              }
              
              currentWeek.push(day)
              
              if (dayOfWeek === 6) {
                weeks.push(currentWeek)
                currentWeek = []
              }
            })
            
            if (currentWeek.length > 0) {
              while (currentWeek.length < 7) {
                currentWeek.push(null as any)
              }
              weeks.push(currentWeek)
            }

            return (
              <div key={month.toISOString()} className="space-y-2">
                <div className="text-sm font-semibold text-center" style={{ color: "rgb(var(--text))" }}>
                  {format(month, "MMMM yyyy")}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                    <div key={day} className="text-center text-xs font-medium" style={{ color: "rgb(var(--muted))" }}>
                      {day}
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-7 gap-1">
                      {week.map((day, dayIndex) => {
                        if (!day) {
                          return <div key={`empty-${dayIndex}`} className="text-xs" />
                        }
                        
                        const dayEvents = getEventsForDate(day)
                        const isToday = isTodayDate(day)
                        const isSelected = isSameDay(day, currentDate)

                        return (
                          <div
                            key={day.toISOString()}
                            onClick={() => {
                              if (dayEvents.length > 0) {
                                setSelectedDay(day)
                                setShowDayEvents(true)
                              } else if (canEdit && onCreateEvent) {
                                const s = new Date(day)
                                s.setHours(9, 0, 0, 0)
                                setCurrentDate(day)
                                onCreateEvent({ start: s, end: addHours(s, 1) })
                              } else {
                                handleMiniCalendarDateClick(day)
                              }
                            }}
                            className={`text-xs p-1 rounded cursor-pointer transition-all text-center ${
                              isToday ? "font-bold" : ""
                            } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                            style={{
                              backgroundColor: isToday ? "rgba(59, 130, 246, 0.1)" : "transparent",
                              color: isToday ? "#3B82F6" : "rgb(var(--text))",
                            }}
                          >
                            <div className="text-center">{format(day, "d")}</div>
                            {dayEvents.length > 0 && (
                              <div className="flex justify-center gap-0.5 mt-0.5">
                                {dayEvents.slice(0, 3).map((event, idx) => (
                                  <div
                                    key={idx}
                                    className="w-1 h-1 rounded-full"
                                    style={{ backgroundColor: getEventTypeColor(event.eventType) }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render Week View — one bounded week; body scrolls within a single 24h strip (no stacked copies).
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

    const timeSlots: Date[] = []
    for (let hour = 0; hour < 24; hour++) {
      const slot = new Date(weekStart)
      slot.setHours(hour, 0, 0, 0)
      timeSlots.push(slot)
    }

    const isCurrentWeek = weekDays.some((day) => isTodayDate(day))
    const currentTimePosition = isCurrentWeek
      ? currentTime.getHours() * 60 + currentTime.getMinutes()
      : null

    const weekBodyHeight = DAY_VIEW_DAY_HEIGHT

    return (
      <div className="flex min-h-0 min-w-full max-lg:min-w-[780px] flex-1 flex-col">
        {/* Weekday headers — fixed above scroll; not part of looping content; grid aligns with body columns */}
        <div
          className="grid calendar-grid flex-shrink-0 border-b bg-white shadow-[0_2px_4px_rgba(0,0,0,0.06)]"
          style={{ borderColor: "rgb(var(--border))", zIndex: 10 }}
        >
          <div
            className="w-[80px] min-w-0 flex-shrink-0 border-r p-2"
            style={{ borderColor: "rgb(var(--border))" }}
            aria-hidden
          />
          {weekDays.map((day) => {
            const isToday = isTodayDate(day)
            const dayEvents = getEventsForDate(day)
            return (
              <div
                key={day.toISOString()}
                className="min-w-0 border-r p-2 text-center"
                style={{ borderColor: "rgb(var(--border))" }}
              >
                <div className="text-xs font-medium" style={{ color: "rgb(var(--muted))" }}>
                  {format(day, "EEE")}
                </div>
                <div
                  className={`mt-1 text-lg font-semibold ${
                    isToday ? "mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white" : ""
                  }`}
                  style={!isToday ? { color: "rgb(var(--text))" } : {}}
                >
                  {format(day, "d")}
                </div>
                {dayEvents.length > 0 && (
                  <div className="mt-1 text-xs" style={{ color: "rgb(var(--muted))" }}>
                    {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Single bounded week body */}
        <div
          ref={timeGridScrollRef}
          data-schedule-scroll="time-grid"
          className="scrollbar-hidden min-h-[min(50vh,400px)] flex-1 cursor-crosshair overflow-y-auto overflow-x-auto max-lg:pb-[max(6.5rem,calc(5rem+env(safe-area-inset-bottom,0px)))] md:max-lg:pb-[max(7.5rem,calc(5.75rem+env(safe-area-inset-bottom,0px)))] lg:pb-0"
          onMouseMove={handleTimeGridPointerMove}
          onMouseLeave={handleTimeGridPointerLeave}
          onClick={handleTimeGridClick}
          onTouchStart={handleSwipeTouchStart}
          onTouchEnd={handleSwipeTouchEnd}
          title={canEdit && onCreateEvent ? "Move to choose a time, click empty space to create an event" : undefined}
        >
          <div className="relative" style={{ height: weekBodyHeight }}>
            <div className="relative grid h-full calendar-grid" style={{ minHeight: DAY_VIEW_DAY_HEIGHT }}>
              <div
                className="sticky left-0 relative z-20 min-w-0 w-[80px] flex-shrink-0 border-r"
                style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
              >
                {timeSlots.map((slot, index) => {
                  const hour = index
                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                  const ampm = hour >= 12 ? "PM" : "AM"
                  return (
                    <div
                      key={slot.toISOString()}
                      className="absolute text-right whitespace-nowrap"
                      style={{
                        top: `${index * 60}px`,
                        left: 0,
                        right: 0,
                        maxWidth: "80px",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <span className="relative z-10 bg-white px-2 text-sm" style={{ color: "rgb(var(--text2))" }}>
                        {`${displayHour} ${ampm}`}
                      </span>
                    </div>
                  )
                })}
              </div>

              {weekDays.map((day) => {
                const dayEvents = getEventsForDate(day).sort(
                  (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
                )
                return (
                  <div
                    key={day.toISOString()}
                    className="relative min-w-0 border-r"
                    style={{ borderColor: "rgb(var(--border))", minHeight: DAY_VIEW_DAY_HEIGHT }}
                  >
                    {slotPreview &&
                      slotPreview.dateKey === format(day, "yyyy-MM-dd") &&
                      canEdit &&
                      onCreateEvent &&
                      !getEventsForDate(day).some((ev) => {
                        const es = new Date(ev.start)
                        const ee = new Date(ev.end)
                        const startM = es.getHours() * 60 + es.getMinutes()
                        const endM = ee.getHours() * 60 + ee.getMinutes()
                        const slotM = slotPreview.minutes
                        return slotM >= startM && slotM < endM
                      }) && (
                        <div
                          className="pointer-events-none absolute left-1 right-1 z-[25]"
                          style={{ top: `${(slotPreview.minutes / 60) * DAY_VIEW_HOUR_HEIGHT}px` }}
                          aria-hidden
                        >
                          <div className="flex items-center">
                            <div
                              className="h-2 w-2 shrink-0 rounded-full border border-white bg-blue-600"
                              style={{ marginLeft: "-4px" }}
                            />
                            <div className="h-0 flex-1 border-t-2 border-dashed border-blue-600" />
                          </div>
                        </div>
                      )}
                    {dayEvents.map((event) => {
                      const eventStart = new Date(event.start)
                      const eventEnd = new Date(event.end)
                      const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes()
                      const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes()
                      const duration = endMinutes - startMinutes
                      const height = Math.max(duration, 30)
                      return (
                        <div
                          key={event.id}
                          data-calendar-event
                          role="button"
                          tabIndex={0}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            handleEventClick(event)
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                              ev.preventDefault()
                              ev.stopPropagation()
                              handleEventClick(event)
                            }
                          }}
                          className="absolute left-1 right-1 z-20 cursor-pointer rounded border-l-2 p-1 text-xs shadow-md hover:shadow-md"
                          style={{
                            top: `${startMinutes}px`,
                            height: `${height}px`,
                            backgroundColor: getEventTypeColor(event.eventType),
                            borderLeftColor: "rgba(0,0,0,0.2)",
                            borderColor: "rgba(0,0,0,0.1)",
                            overflow: "hidden",
                            color: "#FFFFFF",
                          }}
                          title="Click for event details"
                        >
                          <div className="font-semibold truncate">{format(eventStart, "h:mm a")}</div>
                          <div className="truncate">{event.title}</div>
                        </div>
                      )
                    })}
                    {isCurrentWeek &&
                      isTodayDate(day) &&
                      currentTimePosition !== null && (
                        <div
                          className="pointer-events-none absolute left-1 right-1 z-30"
                          style={{ top: `${currentTimePosition}px` }}
                          aria-hidden
                        >
                          <div className="flex items-center">
                            <div
                              className="h-3 w-3 flex-shrink-0 rounded-full"
                              style={{
                                backgroundColor: "#EA4335",
                                marginLeft: "-6px",
                                boxShadow: "0 0 0 2px rgba(255, 255, 255, 1), 0 0 0 3px #EA4335",
                              }}
                            />
                            <div className="h-0.5 flex-1" style={{ backgroundColor: "#EA4335" }} />
                          </div>
                        </div>
                      )}
                  </div>
                )
              })}

              <div className="pointer-events-none absolute top-0 bottom-0 left-[80px] right-0 z-10" aria-hidden>
                {timeSlots.map((slot, index) => (
                  <div
                    key={`line-${slot.toISOString()}`}
                    className="absolute z-0 border-t"
                    style={{
                      top: `${index * 60}px`,
                      left: 0,
                      right: 0,
                      borderColor: "rgb(var(--border))",
                      opacity: 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render Month View (enhanced)
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    // Only get days from the current month
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    
    // Group days by week
    const weeks: Date[][] = []
    let currentWeek: Date[] = []
    
    monthDays.forEach((day) => {
      const dayOfWeek = day.getDay() // 0 = Sunday, 6 = Saturday
      
      // If it's Sunday and we have days in current week, start a new week
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek)
        currentWeek = []
      }
      
      // Fill in empty days at the start of the first week
      if (weeks.length === 0 && currentWeek.length === 0 && dayOfWeek !== 0) {
        for (let i = 0; i < dayOfWeek; i++) {
          currentWeek.push(null as any) // Placeholder for empty cells
        }
      }
      
      currentWeek.push(day)
      
      // If it's Saturday, close the week
      if (dayOfWeek === 6) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    })
    
    // Add remaining days in the last week
    if (currentWeek.length > 0) {
      // Fill remaining days to make 7
      while (currentWeek.length < 7) {
        currentWeek.push(null as any)
      }
      weeks.push(currentWeek)
    }

    return (
      <div className="w-full max-w-full min-w-0 space-y-2 pb-[max(7rem,calc(5.25rem+env(safe-area-inset-bottom,0px)))] md:pb-[max(8rem,calc(5.75rem+env(safe-area-inset-bottom,0px)))] lg:pb-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 border-b pb-2" style={{ borderColor: "rgb(var(--border))" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-sm font-semibold py-2" style={{ color: "rgb(var(--text))" }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <div key={`empty-${dayIndex}`} className="min-h-[100px]" />
                }
                
                const dayEvents = getEventsForDate(day)
                const isToday = isTodayDate(day)

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[100px] border rounded p-2 cursor-pointer hover:shadow-sm transition-all ${
                      isToday ? "ring-2 ring-blue-500" : ""
                    }`}
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderColor: isToday ? "#3B82F6" : "rgb(var(--border))",
                    }}
                  >
                    <div
                      className={`text-sm font-semibold mb-1 ${
                        isToday ? "text-blue-500" : ""
                      }`}
                      style={!isToday ? { color: "rgb(var(--text))" } : {}}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEventClick(event)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              e.stopPropagation()
                              handleEventClick(event)
                            }
                          }}
                          className="text-xs p-1 rounded truncate cursor-pointer hover:shadow-sm border-l-2"
                          style={{
                            backgroundColor: getEventTypeColor(event.eventType),
                            borderLeftColor: "rgba(0,0,0,0.2)",
                            borderLeftWidth: "3px",
                            color: "#FFFFFF",
                          }}
                          title="Click for event details"
                        >
                          <span>{event.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs font-medium" style={{ color: "rgb(var(--muted))" }}>
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render Day View — single bounded day timeline; use prev/next or swipe to change date.
  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate).sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )

    const timeSlots: Date[] = []
    for (let hour = 0; hour < DAY_VIEW_HOURS_PER_DAY; hour++) {
      const slot = new Date(currentDate)
      slot.setHours(hour, 0, 0, 0)
      timeSlots.push(slot)
    }

    const isToday = isTodayDate(currentDate)
    const nowOffsetPx = getNowOffsetPx()

    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={timeGridScrollRef}
          data-schedule-scroll="time-grid"
          className="scrollbar-hidden min-h-[min(50vh,400px)] flex-1 cursor-crosshair overflow-y-auto overflow-x-hidden max-lg:pb-[max(6.5rem,calc(5rem+env(safe-area-inset-bottom,0px)))] md:max-lg:pb-[max(7.5rem,calc(5.75rem+env(safe-area-inset-bottom,0px)))] lg:pb-0"
          onMouseMove={handleTimeGridPointerMove}
          onMouseLeave={handleTimeGridPointerLeave}
          onClick={handleTimeGridClick}
          onTouchStart={handleSwipeTouchStart}
          onTouchEnd={handleSwipeTouchEnd}
          title={canEdit && onCreateEvent ? "Move to choose a time, click empty space to create an event" : undefined}
        >
          <div className="relative w-full" style={{ height: DAY_VIEW_DAY_HEIGHT }}>
            <div
              className="absolute left-0 top-0 bottom-0 z-20 w-20 border-r"
              style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
            >
              {timeSlots.map((slot, index) => {
                const hour = index
                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                const ampm = hour >= 12 ? "PM" : "AM"
                return (
                  <div
                    key={slot.toISOString()}
                    className="absolute"
                    style={{
                      top: `${index * DAY_VIEW_HOUR_HEIGHT}px`,
                      left: 0,
                      right: 0,
                      height: `${DAY_VIEW_HOUR_HEIGHT}px`,
                    }}
                  >
                    <span
                      className="relative z-10 inline-block whitespace-nowrap bg-white px-2 text-sm font-medium"
                      style={{
                        color: "rgb(var(--text2))",
                        transform: "translateY(-50%)",
                      }}
                    >
                      {displayHour}:00 {ampm}
                    </span>
                  </div>
                )
              })}
            </div>

            {timeSlots.map((slot, index) => (
              <div
                key={`line-${slot.toISOString()}`}
                className="absolute z-0 border-t"
                style={{
                  top: `${index * DAY_VIEW_HOUR_HEIGHT}px`,
                  left: "80px",
                  right: 0,
                  borderColor: "rgb(var(--border))",
                  opacity: 0.3,
                }}
              />
            ))}

            {isToday && (
              <div
                className="pointer-events-none absolute left-20 right-0 z-30"
                style={{ top: `${nowOffsetPx}px` }}
                aria-hidden
              >
                <div className="flex items-center">
                  <div
                    className="h-3 w-3 flex-shrink-0 rounded-full"
                    style={{
                      backgroundColor: "#EA4335",
                      marginLeft: "-6px",
                      boxShadow: "0 0 0 2px rgba(255, 255, 255, 1), 0 0 0 3px #EA4335",
                    }}
                  />
                  <div className="h-0.5 flex-1" style={{ backgroundColor: "#EA4335" }} />
                </div>
              </div>
            )}

            {slotPreview &&
              slotPreview.dateKey === format(currentDate, "yyyy-MM-dd") &&
              canEdit &&
              onCreateEvent &&
              !getEventsForDate(currentDate).some((ev) => {
                const es = new Date(ev.start)
                const ee = new Date(ev.end)
                const startM = es.getHours() * 60 + es.getMinutes()
                const endM = ee.getHours() * 60 + ee.getMinutes()
                const slotM = slotPreview.minutes
                return slotM >= startM && slotM < endM
              }) && (
                <div
                  className="pointer-events-none absolute left-20 right-4 z-[25]"
                  style={{ top: `${(slotPreview.minutes / 60) * DAY_VIEW_HOUR_HEIGHT}px` }}
                  aria-hidden
                >
                  <div className="flex items-center">
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-blue-600 shadow-sm"
                      style={{ marginLeft: "-5px" }}
                    />
                    <div className="h-0 flex-1 border-t-2 border-dashed border-blue-600" />
                  </div>
                  <div className="ml-1 mt-0.5 text-[11px] font-semibold text-blue-700">
                    {format(
                      (() => {
                        const d = new Date()
                        d.setHours(0, slotPreview.minutes, 0, 0)
                        return d
                      })(),
                      "h:mm a"
                    )}
                  </div>
                </div>
              )}

            <div className="pointer-events-none absolute inset-0 ml-20 pr-4">
              {dayEvents.map((event) => {
                const eventStart = new Date(event.start)
                const eventEnd = new Date(event.end)
                const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes()
                const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes()
                const duration = endMinutes - startMinutes
                const height = Math.max(duration, 30)
                return (
                  <div
                    key={event.id}
                    data-calendar-event
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      handleEventClick(event)
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault()
                        ev.stopPropagation()
                        handleEventClick(event)
                      }
                    }}
                    className="pointer-events-auto absolute left-0 right-0 flex cursor-pointer flex-row items-start justify-between gap-2 rounded border border-[rgba(0,0,0,0.1)] border-l-4 p-2 hover:shadow-md"
                    style={{
                      top: `${startMinutes}px`,
                      height: `${height}px`,
                      minHeight: "30px",
                      backgroundColor: getEventTypeColor(event.eventType),
                      borderLeftColor: "rgba(0,0,0,0.2)",
                      borderLeftWidth: "4px",
                      color: "#FFFFFF",
                    }}
                    title="Click for event details"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <div className="text-sm font-semibold">
                        {format(eventStart, "h:mm a")} - {format(eventEnd, "h:mm a")}
                      </div>
                      <div className="truncate text-sm font-medium">{event.title}</div>
                    </div>
                    {event.location && (
                      <div className="max-w-[45%] shrink-0 truncate text-xs" style={{ opacity: 0.95 }}>
                        📍 {event.location}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mini Calendar Component
  const MiniCalendar = () => {
    const monthStart = startOfMonth(miniCalendarMonth)
    const monthEnd = endOfMonth(miniCalendarMonth)
    // Only get days from the current month
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    
    // Group days by week
    const weeks: Date[][] = []
    let currentWeek: Date[] = []
    
    monthDays.forEach((day) => {
      const dayOfWeek = day.getDay()
      
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek)
        currentWeek = []
      }
      
      if (weeks.length === 0 && currentWeek.length === 0 && dayOfWeek !== 0) {
        for (let i = 0; i < dayOfWeek; i++) {
          currentWeek.push(null as any)
        }
      }
      
      currentWeek.push(day)
      
      if (dayOfWeek === 6) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    })
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null as any)
      }
      weeks.push(currentWeek)
    }

    const prevMonth = () => {
      setMiniCalendarMonth(subMonths(miniCalendarMonth, 1))
    }

    const nextMonth = () => {
      setMiniCalendarMonth(addMonths(miniCalendarMonth, 1))
    }

    return (
      <div className="space-y-2">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevMonth}
            className="h-6 w-6 p-0"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <div className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
            {format(miniCalendarMonth, "MMMM yyyy")}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={nextMonth}
            className="h-6 w-6 p-0"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
            <div key={day} className="text-center text-xs font-medium py-1" style={{ color: "rgb(var(--muted))" }}>
              {day}
            </div>
          ))}
        </div>

        {/* Date grid - only show days from current month */}
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <div key={`empty-${dayIndex}`} className="text-xs" />
                }
                
                const isToday = isTodayDate(day)
                const isSelected = isSameDay(day, currentDate)
                const dayEvents = getEventsForDate(day)

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleMiniCalendarDateClick(day)}
                    className={`text-xs p-1 rounded cursor-pointer transition-all text-center ${
                      isToday ? "font-bold" : ""
                    } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                    style={{
                      backgroundColor: isToday
                        ? "rgba(59, 130, 246, 0.1)"
                        : isSelected
                        ? "rgba(59, 130, 246, 0.2)"
                        : "transparent",
                      color: isToday ? "#3B82F6" : "rgb(var(--text))",
                    }}
                  >
                    {format(day, "d")}
                    {dayEvents.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-0.5">
                        <div
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: getEventTypeColor(dayEvents[0]?.eventType) }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const getDateDisplay = () => {
    if (view === "year") return format(currentDate, "yyyy")
    if (view === "month") return format(currentDate, "MMMM yyyy")
    if (view === "week" || view === "agenda") {
      return `${format(visibleRange.start, "MMM d")} – ${format(visibleRange.end, "MMM d, yyyy")}`
    }
    return format(currentDate, "EEEE, MMMM d, yyyy")
  }

  const viewPillClass = (active: boolean) =>
    cn(
      "inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-medium shadow-sm lg:h-10 lg:px-4",
      active
        ? "bg-[rgb(var(--accent))] text-white hover:bg-[rgb(var(--accent))]/90"
        : "text-[rgb(var(--text))] hover:bg-gray-100"
    )

  const calendarFiltersBlock = (
    <div className="space-y-1">
      {calendarFilters.map((filter) => (
        <label
          key={filter.id}
          className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            checked={filter.enabled}
            onChange={(e) => {
              setCalendarFilters((prev) =>
                prev.map((f) => (f.id === filter.id ? { ...f, enabled: e.target.checked } : f))
              )
            }}
            className="rounded"
            style={{ accentColor: filter.color }}
          />
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: filter.color }} />
          <span className="text-sm" style={{ color: "rgb(var(--text))" }}>
            {filter.name}
          </span>
        </label>
      ))}
    </div>
  )

  return (
    <>
      <div
        className="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-hidden bg-white"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <header
          className="sticky top-0 z-20 flex-shrink-0 border-b bg-white px-4 py-3.5 lg:relative lg:px-4 lg:py-4"
          style={{ borderColor: "rgb(var(--border))" }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-start">
              <div className="flex min-w-0 items-center gap-2.5">
                <CalendarIcon className="h-5 w-5 shrink-0" style={{ color: "rgb(var(--accent))" }} />
                <h1
                  className="truncate text-lg font-semibold tracking-tight lg:text-xl"
                  style={{ color: "rgb(var(--text))" }}
                >
                  Calendar
                </h1>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 shrink-0 px-3 text-sm font-medium lg:hidden"
                onClick={() => setMobileCalendarsOpen(true)}
              >
                Calendars
              </Button>
            </div>

            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center md:justify-end lg:gap-3">
              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="h-10 shrink-0 px-4 font-medium"
                >
                  Today
                </Button>
                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-transparent lg:border-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateDate("prev")}
                    className="h-10 w-10 p-0"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateDate("next")}
                    className="h-10 w-10 p-0"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
                <div
                  className="min-w-0 w-full max-w-full px-1 text-center text-sm font-semibold leading-snug sm:min-w-[11rem] sm:max-w-[22rem] sm:flex-1 lg:min-w-[12rem]"
                  style={{ color: "rgb(var(--text))" }}
                >
                  <span className="break-words">{getDateDisplay()}</span>
                </div>
              </div>

              <div
                className="flex flex-wrap items-center justify-center gap-2 border-t border-transparent pt-2 sm:border-t-0 sm:pt-0 lg:border-l lg:pl-4 lg:pt-0"
                style={{ borderColor: "rgb(var(--border))" }}
              >
                <div className="flex flex-wrap justify-center gap-2 md:hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("agenda")}
                    className={viewPillClass(view === "agenda")}
                  >
                    Agenda
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("day")}
                    className={viewPillClass(view === "day")}
                  >
                    Day
                  </Button>
                </div>
                <div className="hidden flex-wrap justify-center gap-2 md:flex lg:hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("agenda")}
                    className={viewPillClass(view === "agenda")}
                  >
                    Agenda
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("day")}
                    className={viewPillClass(view === "day")}
                  >
                    Day
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("week")}
                    className={viewPillClass(view === "week")}
                  >
                    Week
                  </Button>
                </div>
                <div className="hidden flex-wrap justify-center gap-2 lg:flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("day")}
                    className={viewPillClass(view === "day")}
                  >
                    Day
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("week")}
                    className={viewPillClass(view === "week")}
                  >
                    Week
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("month")}
                    className={viewPillClass(view === "month")}
                  >
                    Month
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setView("year")}
                    className={viewPillClass(view === "year")}
                  >
                    Year
                  </Button>
                </div>
                {canEdit && onCreateEvent && (
                  <Button size="sm" onClick={() => onCreateEvent()} className="ml-0 hidden shrink-0 lg:inline-flex">
                    <Plus className="mr-1 h-4 w-4" />
                    Create
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div
          className="scrollbar-hidden flex gap-2.5 overflow-x-auto border-b py-2.5 pl-4 pr-6 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
          style={{ borderColor: "rgb(var(--border))" }}
        >
          {calendarFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() =>
                setCalendarFilters((prev) =>
                  prev.map((f) => (f.id === filter.id ? { ...f, enabled: !f.enabled } : f))
                )
              }
              className={cn(
                "min-h-[40px] shrink-0 touch-manipulation rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors active:scale-[0.98]",
                filter.enabled
                  ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10"
                  : "border-gray-200 bg-gray-50 opacity-75"
              )}
              style={filter.enabled ? { color: "rgb(var(--text))" } : undefined}
            >
              {filter.name}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 min-w-0 flex-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside
            className="scrollbar-hidden hidden min-h-0 w-full max-w-full flex-col overflow-y-auto overflow-x-hidden border-r p-4 lg:flex"
            style={{ borderColor: "rgb(var(--border))" }}
          >
            <div className="space-y-6">
              <div>
                <MiniCalendar />
              </div>
              <div>
                <div
                  className="mb-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "rgb(var(--muted))" }}
                >
                  My calendars
                </div>
                {calendarFiltersBlock}
              </div>
              <div>
                <div
                  className="mb-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "rgb(var(--muted))" }}
                >
                  Time Insights
                </div>
                <div className="text-sm" style={{ color: "rgb(var(--text2))" }}>
                  {(view === "week" || view === "agenda") && (
                    <>
                      <div>
                        {format(visibleRange.start, "MMM d")} – {format(visibleRange.end, "MMM d, yyyy")}
                      </div>
                      <div className="mt-1">
                        {filteredEventsInVisibleRange.length} event{filteredEventsInVisibleRange.length !== 1 ? "s" : ""}{" "}
                        in this range
                      </div>
                    </>
                  )}
                  {view === "month" && (
                    <>
                      <div>{format(currentDate, "MMMM yyyy")}</div>
                      <div className="mt-1">
                        {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
                      </div>
                    </>
                  )}
                  {(view === "day" || view === "year") && (
                    <div className="mt-1">
                      {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <div
            className={cn(
              "flex min-h-0 min-w-0 max-w-full flex-col overflow-x-hidden",
              view === "week" && "overflow-x-auto lg:overflow-x-hidden",
              view === "day" || view === "week"
                ? "overflow-y-hidden"
                : "scrollbar-hidden overflow-y-auto"
            )}
          >
            <div
              className={cn(
                "min-h-0 min-w-0 max-w-full flex-1 px-3 py-3 sm:px-4 sm:py-4",
                view === "day" || view === "week" ? "flex min-h-0 flex-col overflow-hidden" : ""
              )}
            >
              {view === "agenda" && renderAgendaView()}
              {view === "day" && renderDayView()}
              {view === "week" && renderWeekView()}
              {view === "month" && renderMonthView()}
              {view === "year" && renderYearView()}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={mobileCalendarsOpen} onOpenChange={setMobileCalendarsOpen}>
        <DialogContent className="flex max-h-[min(88dvh,640px)] w-[calc(100vw-1.25rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-h-[85vh]">
          <DialogHeader className="shrink-0 border-b border-[rgb(var(--border))] px-5 pb-3 pt-5 sm:px-6">
            <DialogTitle>Calendars & date</DialogTitle>
          </DialogHeader>
          <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 pb-[max(1.5rem,calc(1rem+env(safe-area-inset-bottom,0px)))] sm:px-6 md:pb-[max(2rem,calc(1.25rem+env(safe-area-inset-bottom,0px)))]">
            <div className="space-y-6">
              <MiniCalendar />
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--muted))" }}>
                  My calendars
                </div>
                {calendarFiltersBlock}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {canEdit && onCreateEvent && (
        <Button
          type="button"
          size="icon"
          className="fixed right-[max(1rem,env(safe-area-inset-right,0px))] z-[45] h-14 w-14 rounded-full shadow-lg lg:hidden bottom-[var(--mobile-fab-bottom)]"
          onClick={() => onCreateEvent()}
          aria-label="Create event"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={{
            id: selectedEvent.id,
            eventType: selectedEvent.eventType,
            title: selectedEvent.title,
            start: selectedEvent.start,
            end: selectedEvent.end,
            location: selectedEvent.location || null,
            description: selectedEvent.description ?? null,
            creator: { name: null, email: "" },
            linkedDocuments: [],
            linkedFollowUpId: selectedEvent.linkedFollowUpId ?? null,
            followUpPlayerId: selectedEvent.followUpPlayerId ?? null,
          }}
          isOpen={showEventDetail}
          onClose={() => {
            setShowEventDetail(false)
            setSelectedEvent(null)
          }}
          teamId={teamId}
          canEdit={canEdit}
          onFollowUpResolved={() => {
            onEventWrite?.()
            setShowEventDetail(false)
            setSelectedEvent(null)
          }}
        />
      )}

      {/* Day Events Modal */}
      {selectedDay && (
        <DayEventsModal
          date={selectedDay}
          events={getEventsForDate(selectedDay)}
          isOpen={showDayEvents}
          onClose={() => {
            setShowDayEvents(false)
            setSelectedDay(null)
          }}
          onEventClick={handleEventClick}
          canCreate={canEdit && !!onCreateEvent}
          onCreateEvent={() => {
            if (!selectedDay || !onCreateEvent) return
            const s = new Date(selectedDay)
            s.setHours(9, 0, 0, 0)
            onCreateEvent({ start: s, end: addHours(s, 1) })
          }}
        />
      )}
    </>
  )
}
