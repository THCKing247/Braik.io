"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { CalendarWidget } from "./calendar-widget"

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
  defaultView?: "day" | "week" | "month"
}

export function ScheduleManager({ teamId, events: initialEvents, canEdit, defaultView = "day" }: ScheduleManagerProps) {
  const [events, setEvents] = useState(initialEvents)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const [type, setType] = useState("practice")
  const [title, setTitle] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [audience, setAudience] = useState("all")
  const [files, setFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleAddEvent = async () => {
    if (!title || !start || !end) {
      alert("Title, start, and end are required")
      return
    }

    setLoading(true)
    try {
      // Create the event first
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          type,
          title,
          start,
          end,
          location: location || null,
          notes: notes || null,
          audience,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to add event")
      }

      const newEvent = await response.json()

      // Upload and link files if any
      if (files.length > 0) {
        setUploadingFiles(true)
        try {
          for (const file of files) {
            // Upload the document
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

            // Link document to event
            await fetch(`/api/documents/${document.id}/link`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                linkType: "event",
                targetId: newEvent.id,
              }),
            })
          }
        } catch (error) {
          console.error("Error uploading files:", error)
          // Don't fail the entire operation if file upload fails
        } finally {
          setUploadingFiles(false)
        }
      }

      // Update events state with the new event
      // The linked documents will be loaded when the page refreshes or when viewing the event
      setEvents([...events, {
        ...newEvent,
        type: type,
        start: new Date(newEvent.start),
        end: new Date(newEvent.end),
        location: newEvent.location,
        notes: newEvent.description || newEvent.notes,
        audience: audience,
        linkedDocuments: [], // Will be populated on next page load
      }])

      // Reset form
      setTitle("")
      setStart("")
      setEnd("")
      setLocation("")
      setNotes("")
      setFiles([])
      setShowAddForm(false)
    } catch (error) {
      alert("Error adding event")
    } finally {
      setLoading(false)
    }
  }

  // Convert events to calendar format
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
    <div>
      {canEdit && (
        <div className="mb-6">
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)}>Add Event</Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Add Event</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="flex h-10 w-full rounded-lg border-2 border-[#3B82F6] bg-white px-3 py-2 text-sm text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:border-[#3B82F6] transition-all duration-200"
                      >
                        <option value="practice">Practice</option>
                        <option value="game">Game</option>
                        <option value="meeting">Meeting</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start *</Label>
                      <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>End *</Label>
                      <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                    </div>
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
                      className="flex min-h-[80px] w-full rounded-lg border-2 border-[#3B82F6] bg-white px-3 py-2 text-sm text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:border-[#3B82F6] transition-all duration-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="flex h-10 w-full rounded-lg border-2 border-[#3B82F6] bg-white px-3 py-2 text-sm text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 focus-visible:border-[#3B82F6] transition-all duration-200"
                    >
                      <option value="all">All</option>
                      <option value="players">Players</option>
                      <option value="parents">Parents</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Attach Files (Practice Sheets, etc.)</Label>
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    {files.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 rounded border"
                            style={{
                              borderColor: "rgb(var(--border))",
                              backgroundColor: "rgb(var(--platinum))",
                            }}
                          >
                            <span className="text-sm" style={{ color: "rgb(var(--text))" }}>
                              {file.name}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                      Upload practice sheets, playbooks, or other files to attach to this event
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <Button onClick={handleAddEvent} disabled={loading}>
                    {loading ? "Adding..." : "Add Event"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <CalendarWidget
        teamId={teamId}
        events={calendarEvents}
        canEdit={canEdit}
        defaultView={defaultView}
        onCreateEvent={canEdit ? () => setShowAddForm(true) : undefined}
      />
    </div>
  )
}

