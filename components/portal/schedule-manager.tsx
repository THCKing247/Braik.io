"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addHours } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CalendarWidgetEnhanced } from "./calendar-widget-enhanced"
import { DateTimePicker } from "./date-time-picker"

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

function defaultCreateWindow(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
  if (start <= now) start.setMinutes(start.getMinutes() + 15)
  return { start, end: addHours(start, 1) }
}

export function ScheduleManager({ teamId, events: initialEvents, canEdit, defaultView = "day" }: ScheduleManagerProps) {
  const [events, setEvents] = useState(initialEvents)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [type, setType] = useState("practice")
  const [title, setTitle] = useState("")
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [audience, setAudience] = useState("all")
  const [files, setFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const openCreateModal = useCallback((opts?: { start: Date; end: Date }) => {
    const { start, end } = opts ?? defaultCreateWindow()
    setStartDate(start)
    setEndDate(end <= start ? addHours(start, 1) : end)
    setTitle("")
    setType("practice")
    setLocation("")
    setNotes("")
    setAudience("all")
    setFiles([])
    setCreateModalOpen(true)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  useEffect(() => {
    if (!startDate) return
    if (!endDate || endDate < startDate) {
      setEndDate(addHours(startDate, 1))
    }
  }, [startDate])

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  const handleCreateEvent = async () => {
    if (!title?.trim() || !startDate || !endDate) {
      alert("Title, start, and end are required.")
      return
    }
    if (endDate < startDate) {
      alert("End must be after start.")
      return
    }
    if (!teamId) {
      alert("No team selected. Switch to a team in the header and try again.")
      return
    }

    setLoading(true)
    try {
      const start = startDate.toISOString()
      const end = endDate.toISOString()
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/calendar/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          start,
          end,
          location: location || null,
          notes: notes || null,
          audience,
        }),
      })

      const errBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (!response.ok) {
        const nested = errBody.error
        const code =
          typeof nested === "object" && nested !== null && "code" in nested
            ? String((nested as { code?: string }).code)
            : ""
        let msg =
          (typeof errBody.message === "string" && errBody.message) ||
          (typeof nested === "object" &&
            nested !== null &&
            typeof (nested as { message?: string }).message === "string" &&
            (nested as { message: string }).message) ||
          (typeof nested === "string" && nested) ||
          "Failed to create event."
        if (code === "TEAM_NOT_FOUND") {
          msg = "Team not found. Try switching teams in the header or refreshing the page."
        } else if (code === "TEAM_ACCESS_DENIED" || code === "PERMISSION_DENIED") {
          msg = "You don't have permission to create events for this team."
        } else if (code === "TEAM_ID_REQUIRED") {
          msg = "No team selected. Switch to a team in the header and try again."
        }
        throw new Error(msg)
      }

      const newEvent = errBody as Record<string, unknown>
      const eventId = typeof newEvent.id === "string" ? newEvent.id : ""
      const startRaw = newEvent.start as string
      const endRaw = newEvent.end as string

      if (files.length > 0 && eventId) {
        setUploadingFiles(true)
        try {
          for (const file of files) {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("teamId", teamId)
            formData.append("title", file.name)
            formData.append("category", "other")
            formData.append("visibility", "all")

            const docResponse = await fetch("/api/documents", {
              method: "POST",
              body: formData,
            })

            if (!docResponse.ok) {
              console.error("Failed to upload file:", file.name)
              continue
            }

            const document = await docResponse.json()

            await fetch(`/api/documents/${document.id}/link`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                linkType: "event",
                targetId: eventId,
              }),
            })
          }
        } catch (error) {
          console.error("Error uploading files:", error)
        } finally {
          setUploadingFiles(false)
        }
      }

      setEvents([
        ...events,
        {
          id: eventId || crypto.randomUUID(),
          type,
          title: title.trim(),
          start: new Date(startRaw || start),
          end: new Date(endRaw || end),
          location: (newEvent.location as string | null | undefined) ?? (location.trim() || null),
          notes: (newEvent.description as string | null | undefined) ?? (notes.trim() || null),
          audience,
          creator: events[0]?.creator ?? { name: null, email: "" },
          rsvps: [],
          linkedDocuments: [],
        },
      ])

      setTitle("")
      setStartDate(null)
      setEndDate(null)
      setLocation("")
      setNotes("")
      setFiles([])
      setCreateModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error creating event"
      alert(message)
    } finally {
      setLoading(false)
    }
  }

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
    <div className="flex h-full min-h-0 flex-col">
      {canEdit && (
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[rgb(var(--text))]">Create event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="flex h-10 w-full rounded-lg border-2 border-[#3B82F6] bg-white px-3 py-2 text-sm text-[#0F172A] focus-visible:border-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
                  >
                    <option value="practice">Practice</option>
                    <option value="game">Game</option>
                    <option value="meeting">Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DateTimePicker
                  label="Start *"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Start date and time"
                  id="create-event-start"
                />
                <DateTimePicker
                  label="End *"
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="End date and time"
                  minDate={startDate}
                  defaultTime={startDate ? addHours(startDate, 1) : null}
                  id="create-event-end"
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-lg border-2 border-[#3B82F6] bg-white px-3 py-2 text-sm text-[#0F172A] focus-visible:border-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
                />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="flex h-10 w-full rounded-lg border-2 border-[#3B82F6] bg-white px-3 py-2 text-sm text-[#0F172A] focus-visible:border-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
                >
                  <option value="all">All</option>
                  <option value="players">Players</option>
                  <option value="parents">Parents</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Attach files</Label>
                <Input type="file" multiple onChange={handleFileChange} className="cursor-pointer" />
                {files.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded border p-2"
                        style={{
                          borderColor: "rgb(var(--border))",
                          backgroundColor: "rgb(var(--platinum))",
                        }}
                      >
                        <span className="text-sm" style={{ color: "rgb(var(--text))" }}>
                          {file.name}
                        </span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)} className="h-6 w-6 p-0">
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)} disabled={loading || uploadingFiles}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateEvent}
                disabled={loading || uploadingFiles}
                className="text-white"
                style={{ backgroundColor: "rgb(var(--accent))" }}
              >
                {uploadingFiles ? "Uploading…" : loading ? "Creating…" : "Create event"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
