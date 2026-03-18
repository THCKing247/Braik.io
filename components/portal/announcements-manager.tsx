"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Megaphone, Pin } from "lucide-react"
import {
  AUDIENCE_LABELS,
  formatAnnouncementDateTime,
  userCanEditTeamAnnouncement,
  type TeamAnnouncementRow,
} from "@/lib/team-announcements"
import { ROLES, type Role } from "@/lib/auth/roles"

function sessionRoleToRole(s?: string | null): Role {
  const u = (s || "").toUpperCase().replace(/-/g, "_")
  if (u === ROLES.HEAD_COACH) return ROLES.HEAD_COACH
  if (u === ROLES.ASSISTANT_COACH) return ROLES.ASSISTANT_COACH
  if (u === ROLES.ATHLETIC_DIRECTOR) return ROLES.ATHLETIC_DIRECTOR
  if (u === ROLES.PARENT) return ROLES.PARENT
  if (u === ROLES.SCHOOL_ADMIN || u === "ADMIN") return ROLES.SCHOOL_ADMIN
  return ROLES.PLAYER
}

export function AnnouncementsManager({
  teamId,
  canPost,
  viewerUserId,
  viewerRole,
}: {
  teamId: string
  canPost: boolean
  viewerUserId: string
  viewerRole: string
}) {
  const role = sessionRoleToRole(viewerRole)
  const [announcements, setAnnouncements] = useState<TeamAnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState("all")
  const [isPinned, setIsPinned] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [editAudience, setEditAudience] = useState("all")
  const [editPinned, setEditPinned] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const load = useCallback(async () => {
    if (!teamId) return
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/team-announcements`)
      if (!res.ok) {
        setPageError("Could not load announcements.")
        return
      }
      const data = await res.json()
      setAnnouncements(Array.isArray(data.announcements) ? data.announcements : [])
      setPageError(null)
    } catch {
      setPageError("Could not load announcements.")
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const handleAddAnnouncement = async () => {
    if (!title.trim() || !body.trim()) {
      setPageError("Title and message are required.")
      return
    }
    setPageError(null)
    setSubmitLoading(true)
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/team-announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience,
          is_pinned: isPinned,
          send_notification: false,
        }),
      })
      const j = await response.json().catch(() => ({}))
      if (!response.ok) {
        setPageError(typeof j.error === "string" ? j.error : "Failed to post")
        return
      }
      setTitle("")
      setBody("")
      setAudience("all")
      setIsPinned(false)
      setShowAddForm(false)
      await load()
    } catch {
      setPageError("Network error.")
    } finally {
      setSubmitLoading(false)
    }
  }

  const startEdit = (a: TeamAnnouncementRow) => {
    setEditingId(a.id)
    setEditTitle(a.title)
    setEditBody(a.body)
    setEditAudience(a.audience || "all")
    setEditPinned(a.is_pinned)
    setEditError(null)
  }

  const saveEdit = async (id: string) => {
    if (!editTitle.trim() || !editBody.trim()) {
      setEditError("Title and message are required.")
      return
    }
    setEditError(null)
    setEditSaving(true)
    try {
      const res = await fetch(
        `/api/teams/${encodeURIComponent(teamId)}/team-announcements/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim(),
            body: editBody.trim(),
            audience: editAudience,
            is_pinned: editPinned,
          }),
        }
      )
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEditError(typeof j.error === "string" ? j.error : "Save failed")
        return
      }
      setEditingId(null)
      await load()
    } catch {
      setEditError("Network error.")
    } finally {
      setEditSaving(false)
    }
  }

  const canEdit = (a: TeamAnnouncementRow) =>
    viewerUserId && userCanEditTeamAnnouncement(viewerUserId, role, a.author_id)

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {pageError && !showAddForm && (
        <p className="text-sm text-red-600" role="alert">
          {pageError}
        </p>
      )}

      {canPost && (
        <div>
          {!showAddForm ? (
            <Button
              onClick={() => {
                setShowAddForm(true)
                setPageError(null)
              }}
              style={{ backgroundColor: "rgb(var(--accent))" }}
              className="text-white"
            >
              Post Announcement
            </Button>
          ) : (
            <Card className="border" style={{ borderColor: "rgb(var(--border))" }}>
              <CardHeader>
                <CardTitle style={{ color: "rgb(var(--text))" }}>Post Announcement</CardTitle>
              </CardHeader>
              <CardContent>
                {pageError && <p className="mb-3 text-sm text-red-600">{pageError}</p>}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} />
                  </div>
                  <div className="space-y-2">
                    <Label>Message *</Label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="flex min-h-[120px] w-full rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: "rgb(var(--border))" }}
                    >
                      <option value="all">Everyone</option>
                      <option value="staff">Staff only</option>
                      <option value="players">Players</option>
                      <option value="parents">Parents</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm" style={{ color: "rgb(var(--text))" }}>
                    <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
                    Pin to top
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={handleAddAnnouncement} disabled={submitLoading} className="text-white" style={{ backgroundColor: "rgb(var(--accent))" }}>
                    {submitLoading ? "Posting…" : "Post Announcement"}
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

      <div className="grid gap-4">
        {announcements.length === 0 && !canPost && (
          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
            No announcements yet.
          </p>
        )}
        {announcements.map((announcement) => (
          <Card key={announcement.id} className="border" style={{ borderColor: "rgb(var(--border))" }}>
            <CardContent className="pt-6">
              {editingId === announcement.id ? (
                <div className="space-y-3">
                  {editError && <p className="text-sm text-red-600">{editError}</p>}
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Message</Label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="mt-1 min-h-[120px] w-full rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: "rgb(var(--border))" }}
                    />
                  </div>
                  <select
                    value={editAudience}
                    onChange={(e) => setEditAudience(e.target.value)}
                    className="rounded-md border px-2 py-1 text-sm"
                    style={{ borderColor: "rgb(var(--border))" }}
                  >
                    <option value="all">Everyone</option>
                    <option value="staff">Staff</option>
                    <option value="players">Players</option>
                    <option value="parents">Parents</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editPinned} onChange={(e) => setEditPinned(e.target.checked)} />
                    Pinned
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={editSaving}
                      onClick={() => saveEdit(announcement.id)}
                      className="text-white"
                      style={{ backgroundColor: "rgb(var(--accent))" }}
                    >
                      {editSaving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div style={{ color: "rgb(var(--accent))" }}>
                    <Megaphone className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {announcement.is_pinned && <Pin className="mt-1 h-4 w-4 shrink-0 text-amber-600" />}
                        <h3 className="text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
                          {announcement.title}
                        </h3>
                      </div>
                      {canEdit(announcement) && (
                        <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => startEdit(announcement)}>
                          Edit
                        </Button>
                      )}
                    </div>
                    <span
                      className="mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                      style={{ backgroundColor: "rgb(var(--platinum))", color: "rgb(var(--muted))" }}
                    >
                      {AUDIENCE_LABELS[(announcement.audience as keyof typeof AUDIENCE_LABELS) || "all"]}
                    </span>
                    <p className="mb-4 whitespace-pre-wrap" style={{ color: "rgb(var(--text))" }}>
                      {announcement.body}
                    </p>
                    <div className="space-y-0.5 text-xs" style={{ color: "rgb(var(--muted))" }}>
                      <p>
                        {formatAnnouncementDateTime(announcement.created_at)} · By {announcement.author_name || "Staff"}
                      </p>
                      {announcement.updated_at !== announcement.created_at && (
                        <p>Updated {formatAnnouncementDateTime(announcement.updated_at)}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
