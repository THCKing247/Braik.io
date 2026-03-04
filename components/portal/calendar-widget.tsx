"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, startOfWeek, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { EventDetailModal } from "./event-detail-modal"

interface CalendarEvent {
  id: string
  eventType: string
  title: string
  start: string
  end: string
  location?: string
  color?: string
  highlight: boolean
}

interface CalendarWidgetProps {
  teamId: string
  events: CalendarEvent[]
  canEdit: boolean
  onEventClick?: (event: CalendarEvent) => void
  onCreateEvent?: () => void
  defaultView?: "day" | "week" | "month"
}

export function CalendarWidget({
  teamId,
  events: initialEvents,
  canEdit,
  onEventClick,
  onCreateEvent,
  defaultView = "day",
}: CalendarWidgetProps) {
  const router = useRouter()
  const [view, setView] = useState<"day" | "week" | "month">(defaultView)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState(initialEvents)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventDetail, setShowEventDetail] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Default handler: show event detail modal
  const handleEventClick = (event: CalendarEvent) => {
    if (onEventClick) {
      onEventClick(event)
    } else {
      // Default behavior: show event detail modal
      setSelectedEvent(event)
      setShowEventDetail(true)
    }
  }

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  // Update current time every minute (for day view current time indicator)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start)
      return isSameDay(eventDate, date)
    })
  }

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

    return (
      <div className="space-y-4">
        <div className="text-2xl font-athletic font-bold uppercase mb-6 tracking-wide border-b pb-3" style={{ color: "rgb(var(--text))", borderColor: "rgb(var(--border))" }}>
          Week of {format(weekStart, "MMMM d, yyyy")}
        </div>
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dayEvents = getEventsForDate(day)
            const isToday = isSameDay(day, new Date())
            return (
              <div
                key={day.toISOString()}
                className={`border rounded-lg p-3 transition-all duration-200 min-h-[200px] ${
                  isToday 
                    ? "border-2 shadow-sm" 
                    : ""
                }`}
                style={{ 
                  backgroundColor: "#FFFFFF",
                  borderColor: isToday ? "rgb(var(--accent))" : "rgb(var(--border))",
                  borderWidth: isToday ? "2px" : "1px"
                }}
              >
                <div className="text-sm font-athletic font-bold mb-3 uppercase" style={{ color: "rgb(var(--text))" }}>
                  <div>{format(day, "EEE")}</div>
                  <div className="text-lg">{format(day, "d")}</div>
                </div>
                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className="text-xs p-2 rounded-md cursor-pointer transition-all hover:scale-105 font-medium border-l-2"
                      style={{ 
                        backgroundColor: "#FFFFFF",
                        borderLeftColor: "rgb(var(--accent))",
                        borderLeftWidth: "2px"
                      }}
                      title={event.title}
                    >
                      <div className="font-semibold" style={{ color: "rgb(var(--text))" }}>{format(new Date(event.start), "h:mm a")}</div>
                      <div className="truncate" style={{ color: "rgb(var(--text))" }}>{event.title}</div>
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

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarStart = weekStart
    const calendarEnd = endOfMonth(addDays(monthEnd, 6 - monthEnd.getDay()))
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-2 border-b pb-2" style={{ borderColor: "rgb(var(--border))" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-sm font-athletic font-semibold uppercase tracking-wide" style={{ color: "rgb(var(--text))" }}>
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const dayEvents = getEventsForDate(day)
            const isToday = isSameDay(day, new Date())
            const isCurrentMonth = isSameMonth(day, currentDate)
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] border rounded-lg p-2 transition-all duration-200 ${
                  isToday 
                    ? "border-2 shadow-sm" 
                    : ""
                } ${!isCurrentMonth ? "opacity-40" : ""}`}
                style={{ 
                  backgroundColor: "#FFFFFF",
                  borderColor: isToday ? "rgb(var(--accent))" : "rgb(var(--border))",
                  borderWidth: isToday ? "2px" : "1px"
                }}
              >
                <div className="text-xs font-athletic font-bold mb-1.5" style={{ color: "rgb(var(--text))" }}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className="text-[10px] p-1.5 rounded cursor-pointer truncate font-medium transition-all hover:scale-105 border-l-2"
                      style={{ 
                        backgroundColor: "#FFFFFF",
                        borderLeftColor: "rgb(var(--accent))",
                        borderLeftWidth: "2px"
                      }}
                      title={event.title}
                    >
                      <span style={{ color: "rgb(var(--text))" }}>{event.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] font-medium" style={{ color: "rgb(var(--muted))" }}>+{dayEvents.length - 2}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate).sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )

    // Generate time slots from 5am to 12am (midnight)
    const timeSlots: Date[] = []
    const startHour = 5
    const endHour = 24 // 12am (midnight)
    
    for (let hour = startHour; hour < endHour; hour++) {
      const slot = new Date(currentDate)
      slot.setHours(hour, 0, 0, 0)
      timeSlots.push(slot)
    }

    // Calculate current time position (only show if viewing today)
    const isToday = isSameDay(currentDate, new Date())
    const getCurrentTimePosition = () => {
      if (!isToday) return null
      const now = currentTime
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const totalMinutes = currentHour * 60 + currentMinute
      
      // If before 4:45am (before 285 minutes) or after 11:59pm (1440 minutes = midnight), show at bottom
      if (totalMinutes < 285 || totalMinutes >= 1440) {
        return 1140 // Bottom of the timeline (19 hours * 60px = 1140px)
      }
      
      // If between 4:45am (285 minutes) and 5:00am (300 minutes), show at top
      if (totalMinutes >= 285 && totalMinutes < 300) {
        return 0 // Top of the timeline
      }
      
      // If 5:00am or later and before midnight, calculate actual position
      // Day starts at 5:00am (300 minutes), so subtract 300 minutes
      const minutesFrom5AM = totalMinutes - 300
      // Each minute = 1px (since we have 60px per hour = 1px per minute)
      // Clamp to max 1140px (end of day at 12am)
      return Math.min(minutesFrom5AM, 1140)
    }

    const currentTimePosition = getCurrentTimePosition()

    // Calculate event positions and heights
    const getEventPosition = (eventStart: Date) => {
      const dayStart = new Date(currentDate)
      dayStart.setHours(5, 0, 0, 0)
      const minutesFromStart = (eventStart.getTime() - dayStart.getTime()) / (1000 * 60)
      return minutesFromStart
    }

    const getEventHeight = (eventStart: Date, eventEnd: Date) => {
      const minutes = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60)
      return Math.max(minutes, 30) // Minimum 30 minutes height
    }

    return (
      <div className="space-y-4">
        <div className="text-2xl font-athletic font-bold uppercase mb-6 tracking-wide border-b pb-3" style={{ color: "rgb(var(--text))", borderColor: "rgb(var(--border))" }}>
          {format(currentDate, "EEEE, MMMM d, yyyy")}
        </div>
        
        <div className="relative" style={{ minHeight: "1140px" }}>
          {/* Time slots */}
          <div className="relative">
            {timeSlots.map((slot, index) => {
              const hour = slot.getHours()
              const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
              const ampm = hour >= 12 ? "PM" : "AM"
              
              return (
                <div
                  key={slot.toISOString()}
                  className="absolute border-t"
                  style={{
                    top: `${index * 60}px`,
                    left: 0,
                    right: 0,
                    borderColor: "rgb(var(--border))",
                    borderWidth: "1px",
                    height: "60px",
                  }}
                >
                  <div
                    className="absolute left-0 top-0 px-3 text-xs font-medium"
                    style={{
                      color: "rgb(var(--text2))",
                      transform: "translateY(-50%)",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    {displayHour}:00 {ampm}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Current time indicator - Electric Blue Line */}
          {isToday && currentTimePosition !== null && currentTimePosition >= 0 && currentTimePosition <= 1140 && (
            <div
              className="absolute left-0 right-0 z-10 group"
              style={{
                top: `${currentTimePosition}px`,
                pointerEvents: "auto",
              }}
            >
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: "#3B82F6",
                    marginLeft: "80px",
                    boxShadow: "0 0 0 2px rgba(255, 255, 255, 1), 0 0 0 3px #3B82F6",
                  }}
                />
                <div
                  className="flex-1 h-1"
                  style={{
                    backgroundColor: "#3B82F6",
                    boxShadow: "0 0 4px rgba(59, 130, 246, 0.5)",
                  }}
                />
                {/* Time display on hover - right side */}
                <div
                  className="absolute right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                  style={{
                    transform: "translateY(-50%)",
                    marginRight: "20px",
                  }}
                >
                  <div
                    className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap"
                    style={{
                      backgroundColor: "#3B82F6",
                      color: "#FFFFFF",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                    }}
                  >
                    {format(currentTime, "h:mm a")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Events positioned on timeline */}
          <div className="absolute inset-0" style={{ marginLeft: "80px", marginRight: "20px" }}>
            {dayEvents.map((event) => {
              const eventStart = new Date(event.start)
              const eventEnd = new Date(event.end)
              const position = getEventPosition(eventStart)
              const height = getEventHeight(eventStart, eventEnd)

              // Only show if event is within the visible range (5am-12am)
              if (position < 0 || position >= 1140) return null

              return (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="absolute left-0 right-0 p-2 rounded cursor-pointer hover:shadow-md transition-all border-l-4"
                  style={{
                    top: `${position}px`,
                    height: `${height}px`,
                    minHeight: "30px",
                    backgroundColor: "#FFFFFF",
                    borderLeftColor: event.color || "rgb(var(--accent))",
                    borderColor: "rgb(var(--border))",
                    borderWidth: "1px",
                    borderLeftWidth: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div className="font-semibold text-sm" style={{ color: "rgb(var(--text))" }}>
                    {format(eventStart, "h:mm a")} - {format(eventEnd, "h:mm a")}
                  </div>
                  <div className="font-medium text-sm truncate" style={{ color: "rgb(var(--text))" }}>
                    {event.title}
                  </div>
                  {event.location && (
                    <div className="text-xs mt-1 truncate" style={{ color: "rgb(var(--text2))" }}>
                      📍 {event.location}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const navigateDate = (direction: "prev" | "next") => {
    if (view === "week") {
      setCurrentDate(direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
    } else if (view === "month") {
      setCurrentDate(
        direction === "next"
          ? new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
          : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      )
    } else {
      setCurrentDate(
        direction === "next" ? addDays(currentDate, 1) : addDays(currentDate, -1)
      )
    }
  }

  return (
    <Card 
      className="border"
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: "rgb(var(--border))",
        borderWidth: "1px",
      }}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-3xl" style={{ color: "rgb(var(--text))" }}>Calendar</CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 border rounded-lg p-1" style={{ borderColor: "rgb(var(--border))", borderWidth: "1px", backgroundColor: "#FFFFFF" }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("day")}
                className="font-athletic uppercase"
                style={{ 
                  color: "rgb(var(--text))",
                  borderBottom: view === "day" ? `2px solid rgb(var(--accent))` : "none",
                  borderRadius: 0
                }}
              >
                Day
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("week")}
                className="font-athletic uppercase"
                style={{ 
                  color: "rgb(var(--text))",
                  borderBottom: view === "week" ? `2px solid rgb(var(--accent))` : "none",
                  borderRadius: 0
                }}
              >
                Week
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("month")}
                className="font-athletic uppercase"
                style={{ 
                  color: "rgb(var(--text))",
                  borderBottom: view === "month" ? `2px solid rgb(var(--accent))` : "none",
                  borderRadius: 0
                }}
              >
                Month
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateDate("prev")} 
                className="rounded-lg"
                style={{ 
                  color: "rgb(var(--text))", 
                  borderColor: "rgb(var(--border))",
                  backgroundColor: "#FFFFFF"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgb(var(--platinum))"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#FFFFFF"}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateDate("next")} 
                className="rounded-lg"
                style={{ 
                  color: "rgb(var(--text))", 
                  borderColor: "rgb(var(--border))",
                  backgroundColor: "#FFFFFF"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgb(var(--platinum))"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#FFFFFF"}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {canEdit && onCreateEvent && (
              <Button size="sm" onClick={onCreateEvent} className="font-athletic uppercase">
                <Plus className="h-4 w-4 mr-1" />
                Add Event
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {view === "day" && renderDayView()}
        {view === "week" && renderWeekView()}
        {view === "month" && renderMonthView()}
      </CardContent>
    </Card>
  )
}
