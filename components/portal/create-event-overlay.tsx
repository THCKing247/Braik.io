"use client"

import { useState, useEffect, useCallback } from "react"
import { addHours } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateTimePicker } from "@/components/portal/date-time-picker"
import { useMinWidthLg } from "@/lib/hooks/use-min-width-lg"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

export function defaultCreateWindow(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
  if (start <= now) start.setMinutes(start.getMinutes() + 15)
  return { start, end: addHours(start, 1) }
}

export type CreateEventCreatedPayload = {
  id: string
  type: string
  title: string
  start: string
  end: string
  location: string | null
  notes: string | null
  audience: string
  /** When set, parent should drop the optimistic row with this id. */
  replacesTempId?: string
}

const selectClass = "mobile-select"

export type CreateEventEditingValues = {
  id: string
  /** Form values: practice | game | film | meeting | other */
  type: string
  title: string
  start: Date
  end: Date
  location: string | null
  notes: string | null
  audience: string
}

type CreateEventOverlayProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  mode?: "create" | "edit"
  /** Required when mode is edit — current event fields to prefill. */
  editingEvent?: CreateEventEditingValues | null
  /** When opening, use this range; if omitted, uses smart default from "now". */
  initialRange?: { start: Date; end: Date } | null
  /** Bumped each time the parent opens the overlay so the form re-inits. */
  openKey: number
  onCreated?: (payload: CreateEventCreatedPayload) => void
  /** After a successful PATCH (edit mode). */
  onUpdated?: (payload: CreateEventCreatedPayload) => void
  /** Only used when there are no file attachments — safe optimistic row on the calendar. */
  onOptimisticCreate?: (draft: {
    tempId: string
    type: string
    title: string
    start: string
    end: string
    location: string | null
    notes: string | null
    audience: string
  }) => void
  onOptimisticRollback?: (tempId: string) => void
}

export function CreateEventOverlay({
  open,
  onOpenChange,
  teamId,
  mode = "create",
  editingEvent = null,
  initialRange,
  openKey,
  onCreated,
  onUpdated,
  onOptimisticCreate,
  onOptimisticRollback,
}: CreateEventOverlayProps) {
  const isLg = useMinWidthLg()
  const [type, setType] = useState("practice")
  const [title, setTitle] = useState("")
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [audience, setAudience] = useState("all")
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const resetFormFromRange = useCallback(() => {
    const base = initialRange ?? defaultCreateWindow()
    let s = new Date(base.start)
    let e = new Date(base.end)
    if (e <= s) e = addHours(s, 1)
    setStartDate(s)
    setEndDate(e)
    setTitle("")
    setType("practice")
    setLocation("")
    setNotes("")
    setAudience("all")
    setFiles([])
  }, [initialRange])

  const applyEditingEvent = useCallback(() => {
    if (!editingEvent) return
    setType(editingEvent.type)
    setTitle(editingEvent.title)
    let s = new Date(editingEvent.start)
    let e = new Date(editingEvent.end)
    if (e <= s) e = addHours(s, 1)
    setStartDate(s)
    setEndDate(e)
    setLocation(editingEvent.location ?? "")
    setNotes(editingEvent.notes ?? "")
    setAudience(editingEvent.audience)
    setFiles([])
  }, [editingEvent])

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && editingEvent) {
      applyEditingEvent()
      return
    }
    resetFormFromRange()
  }, [open, openKey, mode, editingEvent, applyEditingEvent, resetFormFromRange])

  useEffect(() => {
    if (!startDate) return
    if (!endDate || endDate < startDate) {
      setEndDate(addHours(startDate, 1))
    }
  }, [startDate])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files))
  }

  const removeFile = (index: number) => {
    setFiles((f) => f.filter((_, i) => i !== index))
  }

  const close = () => onOpenChange(false)

  const submit = async () => {
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
    if (mode === "edit" && !editingEvent?.id) {
      alert("Missing event to update.")
      return
    }

    const start = startDate.toISOString()
    const end = endDate.toISOString()
    const tempId = mode === "create" && files.length === 0 ? `tmp-cal-${Date.now()}` : null
    if (tempId) {
      onOptimisticCreate?.({
        tempId,
        type,
        title: title.trim(),
        start,
        end,
        location: location || null,
        notes: notes.trim() || null,
        audience,
      })
    }

    setLoading(true)
    try {
      const isEdit = mode === "edit" && editingEvent
      const url = isEdit
        ? `/api/teams/${encodeURIComponent(teamId)}/calendar/events/${encodeURIComponent(editingEvent.id)}`
        : `/api/teams/${encodeURIComponent(teamId)}/calendar/events`
      const response = await fetchWithTimeout(url, {
        method: isEdit ? "PATCH" : "POST",
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
          (isEdit ? "Failed to update event." : "Failed to create event.")
        if (code === "TEAM_NOT_FOUND") {
          msg = "Team not found. Try switching teams in the header or refreshing the page."
        } else if (code === "TEAM_ACCESS_DENIED" || code === "PERMISSION_DENIED") {
          msg = isEdit
            ? "You don't have permission to update events for this team."
            : "You don't have permission to create events for this team."
        } else if (code === "TEAM_ID_REQUIRED") {
          msg = "No team selected. Switch to a team in the header and try again."
        } else if (code === "EVENT_LINKED_TO_GAME") {
          msg =
            "This event is tied to a scheduled game. Edit it from Schedule / Games instead of the calendar form."
        } else if (code === "EVENT_LINKED_TO_FOLLOW_UP") {
          msg = "This event is linked to a roster follow-up. Manage it from the follow-up, not here."
        } else if (code === "EVENT_LINKED_TO_INJURY") {
          msg = "This event is linked to an injury record. Update it from the injury timeline, not here."
        }
        throw new Error(msg)
      }

      const newEvent = errBody as Record<string, unknown>
      const eventId = typeof newEvent.id === "string" ? newEvent.id : isEdit ? editingEvent.id : ""
      const startRaw = newEvent.start as string
      const endRaw = newEvent.end as string

      if (!isEdit && files.length > 0 && eventId) {
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
            if (!docResponse.ok) continue
            const document = await docResponse.json()
            await fetch(`/api/documents/${document.id}/link`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ linkType: "event", targetId: eventId }),
            })
          }
        } catch {
          /* non-fatal */
        } finally {
          setUploadingFiles(false)
        }
      }

      const payload: CreateEventCreatedPayload = {
        id: eventId || crypto.randomUUID(),
        type,
        title: title.trim(),
        start: startRaw || start,
        end: endRaw || end,
        location: (newEvent.location as string | null | undefined) ?? (location.trim() || null),
        notes: (newEvent.description as string | null | undefined) ?? (notes.trim() || null),
        audience,
        replacesTempId: tempId ?? undefined,
      }
      if (isEdit) {
        onUpdated?.(payload)
      } else {
        onCreated?.(payload)
      }
      close()
    } catch (error) {
      if (tempId) onOptimisticRollback?.(tempId)
      alert(error instanceof Error ? error.message : mode === "edit" ? "Error updating event" : "Error creating event")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const shell = (
    <>
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4 pt-2 sm:px-8 sm:pb-6 sm:pt-3"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
                <option value="practice">Practice</option>
                <option value="game">Game</option>
                <option value="film">Film session</option>
                <option value="meeting">Meeting</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event name"
                className="h-11"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            <DateTimePicker
              label="Start *"
              value={startDate}
              onChange={setStartDate}
              placeholder="Start date and time"
              id="shared-create-start"
            />
            <DateTimePicker
              label="End *"
              value={endDate}
              onChange={setEndDate}
              placeholder="End date and time"
              minDate={startDate}
              defaultTime={startDate ? addHours(startDate, 1) : null}
              id="shared-create-end"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-11" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mobile-textarea"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Audience</Label>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className={selectClass}>
              <option value="all">All</option>
              <option value="players">Players</option>
              <option value="parents">Parents</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          {mode === "create" ? (
          <div className="flex flex-col gap-2">
            <Label>Attach files</Label>
            <Input type="file" multiple onChange={handleFileChange} className="h-11 cursor-pointer py-2" />
            {files.length > 0 && (
              <div className="mt-1 space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded border p-2"
                    style={{
                      borderColor: "rgb(var(--border))",
                      backgroundColor: "rgb(var(--platinum))",
                    }}
                  >
                    <span className="min-w-0 truncate text-sm" style={{ color: "rgb(var(--text))" }}>
                      {file.name}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)} className="h-8 w-8 shrink-0 p-0">
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-card px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-8 max-md:[&>button]:w-full">
        <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={close} disabled={loading || uploadingFiles}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={loading || uploadingFiles}
          className="h-11 w-full text-white sm:w-auto"
          style={{ backgroundColor: "rgb(var(--accent))" }}
        >
          {uploadingFiles
            ? "Uploading…"
            : loading
              ? mode === "edit"
                ? "Saving…"
                : "Creating…"
              : mode === "edit"
                ? "Save changes"
                : "Create event"}
        </Button>
      </div>
    </>
  )

  if (isLg) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 sm:p-6"
        role="presentation"
        onClick={close}
      >
        <div
          className="flex max-h-[min(90vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-event-title"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-6 py-4 sm:px-8 sm:py-5">
            <h2 id="create-event-title" className="text-xl font-semibold text-[rgb(var(--text))] pr-8">
              {mode === "edit" ? "Edit event" : "Create event"}
            </h2>
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={close} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
          {shell}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/50" role="presentation" onClick={close}>
      <div
        className="flex max-h-[min(92dvh,900px)] w-full flex-col overflow-hidden rounded-t-3xl border-t border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-event-title-mobile"
      >
        <div className="flex shrink-0 items-center justify-center pt-3 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-muted" aria-hidden />
        </div>
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-5 pb-3 pt-1">
          <h2 id="create-event-title-mobile" className="text-lg font-semibold text-[rgb(var(--text))]">
            {mode === "edit" ? "Edit event" : "Create event"}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={close} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        {shell}
      </div>
    </div>
  )
}
