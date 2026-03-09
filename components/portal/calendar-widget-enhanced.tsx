"use client"

import { useState, useEffect, useMemo } from "react"
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
  isToday as isTodayDate,
  isSameYear
} from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus, Search, Settings, HelpCircle, Calendar as CalendarIcon } from "lucide-react"
import { EventDetailModal } from "./event-detail-modal"
import { DayEventsModal } from "./day-events-modal"

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
  defaultView?: "day" | "week" | "month" | "year"
}

type CalendarView = "day" | "week" | "month" | "year"

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
}: CalendarWidgetProps) {
  const [view, setView] = useState<CalendarView>(defaultView as CalendarView)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState(initialEvents)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventDetail, setShowEventDetail] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showDayEvents, setShowDayEvents] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(new Date())
  
  // Calendar filters (like Google Calendar's "My calendars")
  const [calendarFilters, setCalendarFilters] = useState<CalendarFilter[]>([
    { id: "all", name: "Team Events", color: "#3B82F6", enabled: true },
    { id: "practice", name: "Practices", color: "#10B981", enabled: true },
    { id: "game", name: "Games", color: "#EF4444", enabled: true },
    { id: "meeting", name: "Meetings", color: "#F59E0B", enabled: true },
    { id: "other", name: "Other", color: "#8B5CF6", enabled: true },
  ])

  // Filter events based on enabled calendars
  const filteredEvents = useMemo(() => {
    if (calendarFilters.every(f => f.enabled)) {
      return events
    }
    return events.filter(event => {
      const eventType = event.eventType.toLowerCase()
      const filter = calendarFilters.find(f => f.id === eventType || f.id === "all")
      return filter?.enabled ?? true
    })
  }, [events, calendarFilters])

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

  const navigateDate = (direction: "prev" | "next") => {
    if (view === "week") {
      setCurrentDate(direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
    } else if (view === "month") {
      setCurrentDate(direction === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
    } else if (view === "year") {
      setCurrentDate(direction === "next" ? addYears(currentDate, 1) : subYears(currentDate, 1))
    } else {
      setCurrentDate(direction === "next" ? addDays(currentDate, 1) : addDays(currentDate, -1))
    }
  }

  const handleMiniCalendarDateClick = (date: Date) => {
    setCurrentDate(date)
    if (view === "month") {
      setMiniCalendarMonth(date)
    }
  }

  // Render Year View
  const renderYearView = () => {
    const yearStart = startOfYear(currentDate)
    const yearEnd = endOfYear(currentDate)
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd })

    return (
      <div className="space-y-4">
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
                            onClick={() => handleMiniCalendarDateClick(day)}
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
                                    style={{ backgroundColor: event.color || "#3B82F6" }}
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

  // Render Week View (enhanced)
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

    // Generate time slots
    const timeSlots: Date[] = []
    for (let hour = 0; hour < 24; hour++) {
      const slot = new Date(weekStart)
      slot.setHours(hour, 0, 0, 0)
      timeSlots.push(slot)
    }

    const isCurrentWeek = weekDays.some(day => isTodayDate(day))
    const getCurrentTimePosition = () => {
      if (!isCurrentWeek) return null
      const now = currentTime
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      return currentHour * 60 + currentMinute
    }

    const currentTimePosition = getCurrentTimePosition()

    return (
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-full">
          {/* Day headers */}
          <div className="grid calendar-grid border-b sticky top-0 bg-white z-20" style={{ borderColor: "rgb(var(--border))" }}>
            <div className="p-2 border-r" style={{ borderColor: "rgb(var(--border))" }}></div>
            {weekDays.map((day) => {
              const isToday = isTodayDate(day)
              const dayEvents = getEventsForDate(day)
              return (
                <div
                  key={day.toISOString()}
                  className="p-2 border-r text-center"
                  style={{ borderColor: "rgb(var(--border))" }}
                >
                  <div className="text-xs font-medium" style={{ color: "rgb(var(--muted))" }}>
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={`text-lg font-semibold mt-1 ${
                      isToday ? "bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto" : ""
                    }`}
                    style={!isToday ? { color: "rgb(var(--text))" } : {}}
                  >
                    {format(day, "d")}
                  </div>
                  {dayEvents.length > 0 && (
                    <div className="text-xs mt-1" style={{ color: "rgb(var(--muted))" }}>
                      {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Time grid - same calendar-grid as header for alignment */}
          <div className="relative grid calendar-grid" style={{ minHeight: "1440px" }}>
            {/* Time column (first column, 80px) */}
            <div className="relative border-r bg-white z-10" style={{ borderColor: "rgb(var(--border))" }}>
              {timeSlots.map((slot, index) => {
                const hour = slot.getHours()
                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                const ampm = hour >= 12 ? "PM" : "AM"
                return (
                  <div
                    key={slot.toISOString()}
                    className="absolute text-xs pr-2 text-right"
                    style={{
                      top: `${index * 60}px`,
                      left: 0,
                      right: 0,
                      color: "rgb(var(--text2))",
                      transform: "translateY(-50%)",
                    }}
                  >
                    {index % 2 === 0 ? `${displayHour} ${ampm}` : ""}
                  </div>
                )
              })}
            </div>

            {/* Day columns (7 columns) - events */}
            {weekDays.map((day) => {
                const dayEvents = getEventsForDate(day).sort(
                  (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
                )
                return (
                  <div
                    key={day.toISOString()}
                    className="border-r relative"
                    style={{ borderColor: "rgb(var(--border))", minHeight: "1440px" }}
                  >
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
                          onClick={() => handleEventClick(event)}
                          className="absolute left-1 right-1 p-1 rounded text-xs cursor-pointer hover:shadow-md border-l-2"
                          style={{
                            top: `${startMinutes}px`,
                            height: `${height}px`,
                            backgroundColor: "#FFFFFF",
                            borderLeftColor: event.color || "#3B82F6",
                            borderColor: "rgb(var(--border))",
                            overflow: "hidden",
                          }}
                        >
                          <div className="font-semibold truncate" style={{ color: "rgb(var(--text))" }}>
                            {format(eventStart, "h:mm a")}
                          </div>
                          <div className="truncate" style={{ color: "rgb(var(--text))" }}>
                            {event.title}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}

            {/* Overlay: hour lines and current time (does not take a grid cell) */}
            <div
              className="absolute top-0 bottom-0 left-[80px] right-0 pointer-events-none z-20"
              aria-hidden
            >
              {timeSlots.map((slot, index) => (
                <div
                  key={`line-${slot.toISOString()}`}
                  className="absolute border-t"
                  style={{
                    top: `${index * 60}px`,
                    left: 0,
                    right: 0,
                    borderColor: "rgb(var(--border))",
                    opacity: 0.3,
                  }}
                />
              ))}
              {isCurrentWeek && currentTimePosition !== null && (
                <div
                  className="absolute left-0 right-0 z-30"
                  style={{ top: `${currentTimePosition}px` }}
                >
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: "#EA4335",
                        marginLeft: "-6px",
                        boxShadow: "0 0 0 2px rgba(255, 255, 255, 1), 0 0 0 3px #EA4335",
                      }}
                    />
                    <div className="flex-1 h-0.5" style={{ backgroundColor: "#EA4335" }} />
                  </div>
                </div>
              )}
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
      <div className="space-y-2">
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
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEventClick(event)
                          }}
                          className="text-xs p-1 rounded truncate cursor-pointer hover:shadow-sm border-l-2"
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderLeftColor: event.color || "#3B82F6",
                            borderLeftWidth: "3px",
                          }}
                        >
                          <span style={{ color: "rgb(var(--text))" }}>{event.title}</span>
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

  // Render Day View (enhanced)
  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate).sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )

    const timeSlots: Date[] = []
    for (let hour = 0; hour < 24; hour++) {
      const slot = new Date(currentDate)
      slot.setHours(hour, 0, 0, 0)
      timeSlots.push(slot)
    }

    const isToday = isTodayDate(currentDate)
    const getCurrentTimePosition = () => {
      if (!isToday) return null
      const now = currentTime
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      return currentHour * 60 + currentMinute
    }

    const currentTimePosition = getCurrentTimePosition()

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="relative" style={{ minHeight: "1440px" }}>
          {/* Time column */}
          <div className="absolute left-0 top-0 bottom-0 w-20 border-r z-10" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
            {timeSlots.map((slot, index) => {
              const hour = slot.getHours()
              const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
              const ampm = hour >= 12 ? "PM" : "AM"
              return (
                <div
                  key={slot.toISOString()}
                  className="absolute"
                  style={{
                    top: `${index * 60}px`,
                    left: 0,
                    right: 0,
                    height: "60px",
                  }}
                >
                  <div
                    className="absolute left-0 top-0 px-2 text-xs font-medium"
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

          {/* Hour lines - full width with reduced opacity */}
          {timeSlots.map((slot, index) => (
            <div
              key={`line-${slot.toISOString()}`}
              className="absolute border-t"
              style={{
                top: `${index * 60}px`,
                left: "80px", // After time column
                right: "0",
                borderColor: "rgb(var(--border))",
                opacity: 0.3, // Reduced opacity
              }}
            />
          ))}

          {/* Current time indicator */}
          {isToday && currentTimePosition !== null && (
            <div
              className="absolute left-20 right-0 z-10"
              style={{
                top: `${currentTimePosition}px`,
              }}
            >
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: "#EA4335",
                    marginLeft: "-6px",
                    boxShadow: "0 0 0 2px rgba(255, 255, 255, 1), 0 0 0 3px #EA4335",
                  }}
                />
                <div
                  className="flex-1 h-0.5"
                  style={{
                    backgroundColor: "#EA4335",
                  }}
                />
              </div>
            </div>
          )}

          {/* Events */}
          <div className="ml-20 pr-4">
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
                  onClick={() => handleEventClick(event)}
                  className="absolute left-0 right-0 p-2 rounded cursor-pointer hover:shadow-md border-l-4"
                  style={{
                    top: `${startMinutes}px`,
                    height: `${height}px`,
                    minHeight: "30px",
                    backgroundColor: "#FFFFFF",
                    borderLeftColor: event.color || "#3B82F6",
                    borderColor: "rgb(var(--border))",
                    borderWidth: "1px",
                    borderLeftWidth: "4px",
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
                          style={{ backgroundColor: dayEvents[0]?.color || "#3B82F6" }}
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

  // Get formatted date display based on view
  const getDateDisplay = () => {
    if (view === "year") {
      return format(currentDate, "yyyy")
    } else if (view === "month") {
      return format(currentDate, "MMMM yyyy")
    } else if (view === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
      const weekEnd = addDays(weekStart, 6)
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
    } else {
      return format(currentDate, "EEEE, MMMM d, yyyy")
    }
  }

  return (
    <>
      <div className="flex flex-col h-full" style={{ backgroundColor: "#FFFFFF" }}>
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgb(var(--border))" }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" style={{ color: "rgb(var(--accent))" }} />
              <h1 className="text-xl font-semibold" style={{ color: "rgb(var(--text))" }}>
                Calendar
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="font-medium"
            >
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate("prev")}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate("next")}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm font-medium px-3" style={{ color: "rgb(var(--text))", minWidth: "200px", textAlign: "center" }}>
              {getDateDisplay()}
            </div>
            <div className="flex items-center gap-1 border-l pl-2" style={{ borderColor: "rgb(var(--border))" }}>
              <Button
                variant={view === "day" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("day")}
                className="font-medium"
              >
                Day
              </Button>
              <Button
                variant={view === "week" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("week")}
                className="font-medium"
              >
                Week
              </Button>
              <Button
                variant={view === "month" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("month")}
                className="font-medium"
              >
                Month
              </Button>
              <Button
                variant={view === "year" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("year")}
                className="font-medium"
              >
                Year
              </Button>
            </div>
            {canEdit && onCreateEvent && (
              <Button size="sm" onClick={onCreateEvent} className="ml-2">
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-64 border-r p-4 overflow-y-auto" style={{ borderColor: "rgb(var(--border))" }}>
            <div className="space-y-6">
              {/* Mini Calendar */}
              <div>
                <MiniCalendar />
              </div>

              {/* Calendar Filters */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "rgb(var(--muted))" }}>
                  My calendars
                </div>
                <div className="space-y-1">
                  {calendarFilters.map((filter) => (
                    <label
                      key={filter.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
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
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: filter.color }}
                      />
                      <span className="text-sm" style={{ color: "rgb(var(--text))" }}>
                        {filter.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Time Insights (placeholder) */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "rgb(var(--muted))" }}>
                  Time Insights
                </div>
                <div className="text-sm" style={{ color: "rgb(var(--text2))" }}>
                  {view === "week" && (
                    <>
                      <div>{format(startOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d")} - {format(addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), 6), "MMM d, yyyy")}</div>
                      <div className="mt-1">
                        {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
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
                </div>
              </div>
            </div>
          </div>

          {/* Main Calendar View */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              {view === "day" && renderDayView()}
              {view === "week" && renderWeekView()}
              {view === "month" && renderMonthView()}
              {view === "year" && renderYearView()}
            </div>
          </div>
        </div>
      </div>

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
            description: null,
            creator: { name: null, email: "" },
            linkedDocuments: [],
          }}
          isOpen={showEventDetail}
          onClose={() => {
            setShowEventDetail(false)
            setSelectedEvent(null)
          }}
          teamId={teamId}
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
        />
      )}
    </>
  )
}
