"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Calendar, Pencil, Trash2 } from "lucide-react"
import { format } from "date-fns"

interface CalendarEvent {
  id: string
  eventType: string
  title: string
  start: string
  end: string
  location?: string
  color?: string
  highlight: boolean
  linkedGameId?: string
  linkedFollowUpId?: string
  linkedInjuryId?: string
}

interface DayEventsModalProps {
  date: Date
  events: CalendarEvent[]
  isOpen: boolean
  onClose: () => void
  onEventClick: (event: CalendarEvent) => void
  /** Opens shared Create Event flow for this day */
  canCreate?: boolean
  onCreateEvent?: () => void
  canManageEvent?: (event: CalendarEvent) => boolean
  onRequestEditEvent?: (event: CalendarEvent) => void
  onRequestDeleteEvent?: (event: CalendarEvent) => void
}

export function DayEventsModal({
  date,
  events,
  isOpen,
  onClose,
  onEventClick,
  canCreate,
  onCreateEvent,
  canManageEvent,
  onRequestEditEvent,
  onRequestDeleteEvent,
}: DayEventsModalProps) {
  if (!isOpen) return null

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl" style={{ color: "rgb(var(--text))" }}>
              {format(date, "EEEE, MMMM d, yyyy")}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {sortedEvents.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted"
                >
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">
                    No events today
                  </p>
                  <p className="text-sm text-muted-foreground">
                    There are no scheduled events for this day.
                  </p>
                </div>
                {canCreate && onCreateEvent && (
                  <Button
                    type="button"
                    className="mt-2 w-full max-w-xs text-white sm:w-auto"
                    style={{ backgroundColor: "rgb(var(--accent))" }}
                    onClick={() => {
                      onCreateEvent()
                      onClose()
                    }}
                  >
                    Create event
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedEvents.map((event) => {
                  const showActions =
                    canManageEvent?.(event) && onRequestEditEvent && onRequestDeleteEvent
                  return (
                    <div
                      key={event.id}
                      className="flex items-stretch gap-2 rounded-lg border transition-all hover:shadow-md sm:gap-3"
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "rgb(var(--border))",
                        borderLeftWidth: "4px",
                        borderLeftColor: event.color || "rgb(var(--accent))",
                      }}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 cursor-pointer p-4 text-left"
                        onClick={() => {
                          onEventClick(event)
                          onClose()
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="px-2 py-0.5 text-xs rounded border"
                            style={{
                              backgroundColor: "rgb(var(--platinum))",
                              borderColor: "rgb(var(--border))",
                              color: "rgb(var(--text2))",
                            }}
                          >
                            {event.eventType}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold mb-1" style={{ color: "rgb(var(--text))" }}>
                          {event.title}
                        </h3>
                        <div className="text-sm mb-1" style={{ color: "rgb(var(--text2))" }}>
                          {format(new Date(event.start), "h:mm a")} - {format(new Date(event.end), "h:mm a")}
                        </div>
                        {event.location && (
                          <div className="text-sm" style={{ color: "rgb(var(--text2))" }}>
                            📍 {event.location}
                          </div>
                        )}
                      </button>
                      {showActions ? (
                        <div
                          className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-border py-2 pr-2 pl-1 sm:flex-row sm:py-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-[rgb(var(--text))]"
                            aria-label="Edit event"
                            onClick={() => {
                              onRequestEditEvent(event)
                              onClose()
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive"
                            aria-label="Delete event"
                            onClick={() => {
                              onRequestDeleteEvent(event)
                              onClose()
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
            {canCreate && onCreateEvent && sortedEvents.length > 0 && (
              <div className="border-t pt-4" style={{ borderColor: "rgb(var(--border))" }}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-semibold sm:w-auto"
                  style={{ borderColor: "rgb(var(--accent))", color: "rgb(var(--accent))" }}
                  onClick={() => {
                    onCreateEvent()
                    onClose()
                  }}
                >
                  Create event this day
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
