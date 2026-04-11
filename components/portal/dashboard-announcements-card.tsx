"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Megaphone, Plus, X, Pin } from "lucide-react"
import {
  AUDIENCE_LABELS,
  formatAnnouncementDateTime,
  isAnnouncementEffectivelyPinned,
  sortTeamAnnouncementsForViewer,
  toggleAnnouncementPinOverride,
  userCanEditTeamAnnouncement,
  type TeamAnnouncementRow,
} from "@/lib/team-announcements"
import {
  loadAnnouncementPinOverrides,
  saveAnnouncementPinOverrides,
} from "@/lib/navigation/dashboard-announcement-pins"
import { ROLES, type Role } from "@/lib/auth/roles"
import { ScrollFadeContainer } from "@/components/ui/scroll-fade-container"
import { cn } from "@/lib/utils"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"
import {
  useNotificationPollIntervalMs,
  useNotificationsPollingActive,
} from "@/lib/hooks/use-notifications-polling"

function sessionRoleToRole(s?: string | null): Role {
  const u = (s || "").toUpperCase().replace(/-/g, "_")
  if (u === ROLES.HEAD_COACH) return ROLES.HEAD_COACH
  if (u === ROLES.ASSISTANT_COACH) return ROLES.ASSISTANT_COACH
  if (u === ROLES.ATHLETIC_DIRECTOR) return ROLES.ATHLETIC_DIRECTOR
  if (u === ROLES.PARENT) return ROLES.PARENT
  if (u === ROLES.SCHOOL_ADMIN || u === "ADMIN") return ROLES.SCHOOL_ADMIN
  return ROLES.PLAYER
}

const BODY_PREVIEW_LEN = 100

function bodyPreview(body: string, max = BODY_PREVIEW_LEN) {
  const t = body.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function AnnouncementPinControl({
  row,
  effectivePinned,
  onToggle,
  size = "sm",
}: {
  row: TeamAnnouncementRow
  effectivePinned: boolean
  onToggle: (row: TeamAnnouncementRow) => void
  size?: "sm" | "md"
}) {
  const iconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"
  return (
    <button
      type="button"
      className="flex shrink-0 items-center justify-center rounded-md p-1.5 transition-colors hover:bg-[rgb(var(--platinum))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--accent))] touch-manipulation"
      style={{ color: effectivePinned ? undefined : "rgb(var(--muted))" }}
      aria-label={effectivePinned ? "Unpin announcement" : "Pin announcement"}
      aria-pressed={effectivePinned}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle(row)
      }}
    >
      <Pin
        className={cn("shrink-0", iconClass, effectivePinned && "fill-amber-600 text-amber-600")}
        aria-hidden
      />
    </button>
  )
}

export function DashboardAnnouncementsCard({
  teamId,
  canCreate,
  viewerUserId,
  viewerRole,
  /** When set (including []), seed list from dashboard bootstrap and skip the first GET. */
  initialAnnouncements,
  /** True while parent is loading `/api/dashboard/bootstrap` — avoids duplicate GET until bootstrap settles. */
  bootstrapLoading,
}: {
  teamId: string
  canCreate: boolean
  viewerUserId: string
  viewerRole?: string | null
  initialAnnouncements?: TeamAnnouncementRow[]
  bootstrapLoading?: boolean
}) {
  const role = sessionRoleToRole(viewerRole)
  const [announcements, setAnnouncements] = useState<TeamAnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [viewOpen, setViewOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const [createTitle, setCreateTitle] = useState("")
  const [createBody, setCreateBody] = useState("")
  const [createAudience, setCreateAudience] = useState<string>("all")
  const [createPinned, setCreatePinned] = useState(false)
  const [createNotify, setCreateNotify] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const [expandedInView, setExpandedInView] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [editAudience, setEditAudience] = useState("all")
  const [editPinned, setEditPinned] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const [userPinnedIds, setUserPinnedIds] = useState<Set<string>>(() => new Set())
  const [userUnpinnedIds, setUserUnpinnedIds] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    if (!teamId) return
    try {
      const res = await fetchWithTimeout(
        `/api/teams/${encodeURIComponent(teamId)}/team-announcements`,
        { credentials: "same-origin" }
      )
      if (!res.ok) return
      const data = await res.json()
      setAnnouncements(Array.isArray(data.announcements) ? data.announcements : [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [teamId])

  const pollingAllowed = useNotificationsPollingActive()
  const annPollMs = useNotificationPollIntervalMs()

  useEffect(() => {
    if (!teamId) return
    if (bootstrapLoading) {
      setLoading(true)
      return
    }
    if (initialAnnouncements !== undefined) {
      setAnnouncements(initialAnnouncements)
      setLoading(false)
      return
    }
    setLoading(true)
    load()
  }, [teamId, load, initialAnnouncements, bootstrapLoading])

  useEffect(() => {
    if (!teamId || !pollingAllowed) return
    const ms = Math.max(annPollMs, 60_000)
    const id = window.setInterval(() => {
      load()
    }, ms)
    return () => clearInterval(id)
  }, [teamId, load, pollingAllowed, annPollMs])

  useEffect(() => {
    if (!viewerUserId || !teamId) return
    const loaded = loadAnnouncementPinOverrides(viewerUserId, teamId)
    setUserPinnedIds(loaded.pinned)
    setUserUnpinnedIds(loaded.unpinned)
  }, [viewerUserId, teamId])

  const sortedAnnouncements = useMemo(
    () => sortTeamAnnouncementsForViewer(announcements, userPinnedIds, userUnpinnedIds),
    [announcements, userPinnedIds, userUnpinnedIds]
  )

  const toggleUserPin = useCallback(
    (row: TeamAnnouncementRow) => {
      if (!viewerUserId || !teamId) return
      const next = toggleAnnouncementPinOverride(row, userPinnedIds, userUnpinnedIds)
      setUserPinnedIds(next.pinned)
      setUserUnpinnedIds(next.unpinned)
      saveAnnouncementPinOverrides(viewerUserId, teamId, next.pinned, next.unpinned)
    },
    [viewerUserId, teamId, userPinnedIds, userUnpinnedIds]
  )

  const openCreate = () => {
    setCreateError(null)
    setCreateTitle("")
    setCreateBody("")
    setCreateAudience("all")
    setCreatePinned(false)
    setCreateNotify(false)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    const t = createTitle.trim()
    const b = createBody.trim()
    if (!t || !b) {
      setCreateError("Title and message are required.")
      return
    }
    setCreateError(null)
    setCreateSubmitting(true)
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticRow: TeamAnnouncementRow = {
      id: optimisticId,
      team_id: teamId,
      title: t,
      body: b,
      author_id: viewerUserId,
      author_name: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_pinned: createPinned,
      audience: createAudience,
      send_notification: createNotify,
    }
    setAnnouncements((prev) => [optimisticRow, ...prev.filter((a) => !a.id.startsWith("optimistic-"))])
    setCreateOpen(false)
    try {
      const res = await fetchWithTimeout(`/api/teams/${encodeURIComponent(teamId)}/team-announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          body: b,
          audience: createAudience,
          is_pinned: createPinned,
          send_notification: createNotify,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== optimisticId))
        setCreateError(typeof j.error === "string" ? j.error : "Could not post announcement.")
        setCreateOpen(true)
        return
      }
      const row = j as unknown as TeamAnnouncementRow
      if (row?.id && typeof row.id === "string" && row.team_id) {
        setAnnouncements((prev) => prev.map((a) => (a.id === optimisticId ? row : a)))
      } else {
        await load()
      }
    } catch {
      setAnnouncements((prev) => prev.filter((a) => a.id !== optimisticId))
      setCreateError("Network error. Try again.")
      setCreateOpen(true)
    } finally {
      setCreateSubmitting(false)
    }
  }

  const startEdit = (row: TeamAnnouncementRow) => {
    setEditingId(row.id)
    setEditTitle(row.title)
    setEditBody(row.body)
    setEditAudience(row.audience || "all")
    setEditPinned(row.is_pinned)
    setEditError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError(null)
  }

  const saveEdit = async (id: string) => {
    const t = editTitle.trim()
    const b = editBody.trim()
    if (!t || !b) {
      setEditError("Title and message are required.")
      return
    }
    setEditError(null)
    setEditSaving(true)
    const prevSnap = announcements
    setAnnouncements((p) =>
      p.map((a) =>
        a.id === id
          ? {
              ...a,
              title: t,
              body: b,
              audience: editAudience,
              is_pinned: editPinned,
              updated_at: new Date().toISOString(),
            }
          : a
      )
    )
    try {
      const res = await fetchWithTimeout(
        `/api/teams/${encodeURIComponent(teamId)}/team-announcements/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t,
            body: b,
            audience: editAudience,
            is_pinned: editPinned,
          }),
        }
      )
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAnnouncements(prevSnap)
        setEditError(typeof (j as { error?: string }).error === "string" ? (j as { error: string }).error : "Could not save.")
        return
      }
      setEditingId(null)
      await load()
    } catch {
      setAnnouncements(prevSnap)
      setEditError("Network error.")
    } finally {
      setEditSaving(false)
    }
  }

  const canEditRow = (row: TeamAnnouncementRow) =>
    viewerUserId && userCanEditTeamAnnouncement(viewerUserId, role, row.author_id)

  return (
    <>
      <Card
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05] md:rounded-lg md:border md:shadow-sm md:ring-0"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-6 md:pb-3 md:pt-6">
          <CardTitle
            className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold md:text-base md:font-semibold"
            style={{ color: "rgb(var(--text))" }}
          >
            <Megaphone className="h-4 w-4 shrink-0 md:h-4" style={{ color: "rgb(var(--accent))" }} />
            Announcements
          </CardTitle>
          <div className="flex shrink-0 items-center gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-3 text-xs font-medium md:h-7 md:px-2"
              style={{ color: "rgb(var(--accent))" }}
              onClick={() => setViewOpen(true)}
            >
              View
            </Button>
            {canCreate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 p-0 md:h-7 md:w-7"
                style={{ color: "rgb(var(--accent))" }}
                onClick={openCreate}
                aria-label="Create announcement"
              >
                <Plus className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <ScrollFadeContainer
            variant="light"
            fadeHeight="h-6"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            scrollClassName="announcements-container max-h-[min(20rem,50vh)] flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4 pt-0 md:px-6 md:pb-6 [scrollbar-gutter:stable]"
          >
          {loading ? (
            <div className="space-y-3 py-6" aria-busy="true" aria-label="Loading announcements">
              <div className="h-4 max-w-[200px] animate-pulse rounded bg-[rgb(var(--platinum))]" />
              <div className="h-16 w-full animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
              <div className="h-16 w-full animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
            </div>
          ) : sortedAnnouncements.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgb(var(--platinum))" }}
              >
                <Megaphone className="h-5 w-5" style={{ color: "rgb(var(--muted))" }} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                  No announcements yet
                </p>
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  Team news and updates will appear here{canCreate ? ". Use + to post." : "."}
                </p>
              </div>
            </div>
          ) : (
            sortedAnnouncements.map((a) => {
              const effectivePinned = isAnnouncementEffectivelyPinned(a, userPinnedIds, userUnpinnedIds)
              return (
                <div
                  key={a.id}
                  className={`flex w-full items-start gap-2 rounded-lg border p-2.5 transition-colors hover:opacity-95 ${
                    a.id.startsWith("optimistic-") ? "opacity-80" : ""
                  }`}
                  style={{ backgroundColor: "rgba(37,99,235,0.06)", borderColor: "rgba(37,99,235,0.2)" }}
                >
                  <AnnouncementPinControl
                    row={a}
                    effectivePinned={effectivePinned}
                    onToggle={toggleUserPin}
                  />
                  <button
                    type="button"
                    onClick={() => setViewOpen(true)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "rgb(var(--text))" }}>
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-xs line-clamp-2" style={{ color: "rgb(var(--muted))" }}>
                      {bodyPreview(a.body)}
                    </p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "rgb(var(--muted))" }}>
                      {a.author_name ? `${a.author_name} · ` : ""}
                      {formatAnnouncementDateTime(a.created_at)}
                    </p>
                  </button>
                </div>
              )
            })
          )}
          </ScrollFadeContainer>
        </CardContent>
      </Card>

      {/* View all modal */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="relative flex max-h-[min(90vh,900px)] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden border border-[rgb(var(--border))] bg-white p-0">
          <button
            type="button"
            className="absolute right-3 top-3 z-10 rounded-lg p-1.5 transition-colors hover:bg-[rgb(var(--platinum))]"
            onClick={() => setViewOpen(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" style={{ color: "rgb(var(--muted))" }} />
          </button>
          <DialogHeader className="mb-0 shrink-0 border-b border-[rgb(var(--border))] bg-white px-6 pb-4 pt-6 pr-14">
            <DialogTitle className="text-xl text-[rgb(var(--text))]">Announcements</DialogTitle>
          </DialogHeader>
          <ScrollFadeContainer
            variant="light"
            fadeHeight="h-8"
            className="flex min-h-0 flex-1 flex-col"
            scrollClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-8 pt-2"
          >
            {sortedAnnouncements.length === 0 ? (
              <div className="py-12 text-center">
                <Megaphone className="mx-auto h-10 w-10 opacity-30" style={{ color: "rgb(var(--muted))" }} />
                <p className="mt-3 text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                  No announcements yet
                </p>
                <p className="mt-1 text-xs" style={{ color: "rgb(var(--muted))" }}>
                  {canCreate ? "Use the + button on this card to post the first announcement." : "Check back later."}
                </p>
              </div>
            ) : (
              <ul className="space-y-6">
                {sortedAnnouncements.map((a) => {
                  const expanded = expandedInView[a.id]
                  const long = a.body.length > 400
                  const showBody = !long || expanded ? a.body : `${a.body.slice(0, 400)}…`
                  const edited = a.updated_at !== a.created_at
                  const effectivePinned = isAnnouncementEffectivelyPinned(a, userPinnedIds, userUnpinnedIds)

                  return (
                    <li
                      key={a.id}
                      className="rounded-xl border p-4"
                      style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--snow))" }}
                    >
                      {editingId === a.id ? (
                        <div className="space-y-3">
                          {editError && (
                            <p className="text-sm text-red-600" role="alert">
                              {editError}
                            </p>
                          )}
                          <div>
                            <Label className="text-xs">Title</Label>
                            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Message</Label>
                            <textarea
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              className="mt-1 min-h-[140px] w-full rounded-md border px-3 py-2 text-sm"
                              style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={editPinned}
                                onChange={(e) => setEditPinned(e.target.checked)}
                              />
                              Pin
                            </label>
                            <select
                              value={editAudience}
                              onChange={(e) => setEditAudience(e.target.value)}
                              className="rounded-md border px-2 py-1 text-xs"
                              style={{ borderColor: "rgb(var(--border))" }}
                            >
                              <option value="all">Everyone</option>
                              <option value="staff">Staff only</option>
                              <option value="players">Players</option>
                              <option value="parents">Parents</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={editSaving}
                              onClick={() => saveEdit(a.id)}
                              style={{ backgroundColor: "rgb(var(--accent))", color: "#fff" }}
                            >
                              {editSaving ? "Saving…" : "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <AnnouncementPinControl
                                row={a}
                                effectivePinned={effectivePinned}
                                onToggle={toggleUserPin}
                                size="md"
                              />
                              <h3 className="min-w-0 pt-0.5 text-lg font-semibold leading-tight" style={{ color: "rgb(var(--text))" }}>
                                {a.title}
                              </h3>
                            </div>
                            {canEditRow(a) && (
                              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => startEdit(a)}>
                                Edit
                              </Button>
                            )}
                          </div>
                          <span
                            className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                            style={{
                              backgroundColor: "rgb(var(--platinum))",
                              color: "rgb(var(--muted))",
                            }}
                          >
                            {AUDIENCE_LABELS[(a.audience as keyof typeof AUDIENCE_LABELS) || "all"] || a.audience}
                          </span>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "rgb(var(--text))" }}>
                            {showBody}
                          </p>
                          {long && (
                            <button
                              type="button"
                              className="mt-1 text-xs font-medium"
                              style={{ color: "rgb(var(--accent))" }}
                              onClick={() =>
                                setExpandedInView((prev) => ({ ...prev, [a.id]: !prev[a.id] }))
                              }
                            >
                              {expanded ? "Show less" : "Read more"}
                            </button>
                          )}
                          <div className="mt-4 space-y-0.5 border-t pt-3 text-xs" style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--muted))" }}>
                            <p>
                              Posted by {a.author_name || "Team staff"} · {formatAnnouncementDateTime(a.created_at)}
                            </p>
                            {edited && (
                              <p>Updated {formatAnnouncementDateTime(a.updated_at)}</p>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </ScrollFadeContainer>
        </DialogContent>
      </Dialog>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="relative max-w-lg w-[calc(100%-2rem)] border border-[rgb(var(--border))] bg-white">
          <button
            type="button"
            className="absolute right-3 top-3 rounded-lg p-1.5 hover:bg-[rgb(var(--platinum))]"
            onClick={() => setCreateOpen(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" style={{ color: "rgb(var(--muted))" }} />
          </button>
          <DialogHeader className="pr-10">
            <DialogTitle className="text-[rgb(var(--text))]">Create Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {createError && (
              <p className="text-sm text-red-600" role="alert">
                {createError}
              </p>
            )}
            <div>
              <Label htmlFor="ann-title">Title *</Label>
              <Input
                id="ann-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="mt-1.5"
                style={{ backgroundColor: "#FFFFFF", color: "rgb(var(--text))", borderColor: "rgb(var(--border))" }}
                placeholder="Short headline"
                maxLength={500}
              />
            </div>
            <div>
              <Label htmlFor="ann-body">Message *</Label>
              <textarea
                id="ann-body"
                value={createBody}
                onChange={(e) => setCreateBody(e.target.value)}
                className="mt-1.5 min-h-[140px] w-full rounded-md border px-3 py-2 text-sm"
                style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                placeholder="What should the team know?"
              />
            </div>
            <div>
              <Label htmlFor="ann-audience">Audience</Label>
              <select
                id="ann-audience"
                value={createAudience}
                onChange={(e) => setCreateAudience(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
              >
                <option value="all">Everyone on the team</option>
                <option value="staff">Staff only</option>
                <option value="players">Players</option>
                <option value="parents">Parents</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm" style={{ color: "rgb(var(--text))" }}>
                <input type="checkbox" checked={createPinned} onChange={(e) => setCreatePinned(e.target.checked)} />
                Pin to top of list
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: "rgb(var(--text))" }}>
                <input type="checkbox" checked={createNotify} onChange={(e) => setCreateNotify(e.target.checked)} />
                Send notification (saved for future delivery)
              </label>
            </div>
          </div>
          <DialogFooter className="mt-6 flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createSubmitting}
              onClick={submitCreate}
              className="text-white"
              style={{ backgroundColor: "rgb(var(--accent))" }}
            >
              {createSubmitting ? "Posting…" : "Post Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
