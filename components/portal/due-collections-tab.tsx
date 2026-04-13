"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, LayoutGrid, List, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { DatePicker, dateToYmd, ymdToDate } from "@/components/portal/date-time-picker"

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

/** `amount_due` is stored as total collection goal; split evenly across targeted recipients. */
function evenSharePerRecipient(total: number, recipientCount: number): number {
  if (recipientCount <= 0 || !Number.isFinite(total)) return 0
  return Math.round((total / recipientCount) * 100) / 100
}

export type DueCollectionRow = {
  id: string
  team_id?: string
  season_year: number
  description: string
  amount_due: number
  due_date: string
  status: "pending" | "in_progress" | "completed"
  notes: string | null
  created_at?: string
  target_all?: boolean
  target_assistant_coaches?: boolean
  target_players?: boolean
  target_parents?: boolean
  total_targets?: number
  collected_count?: number
  pending_count?: number
}

type DetailRecipient = {
  id: string
  user_id: string
  role_kind: string
  player_id: string | null
  contribution_status: string
  received_note: string | null
  updated_at: string
  display_name: string
  position_group: string | null
}

function targetSummary(row: DueCollectionRow): string {
  if (row.target_all) return "All"
  const parts: string[] = []
  if (row.target_assistant_coaches) parts.push("Assistant coaches")
  if (row.target_players) parts.push("Players")
  if (row.target_parents) parts.push("Parents")
  return parts.length ? parts.join(" + ") : "—"
}

function progressMeta(row: DueCollectionRow): { label: string; sub: string; pct: number | null } {
  const total = row.total_targets ?? 0
  const collected = row.collected_count ?? 0
  if (total === 0) {
    return { label: "Pending", sub: "No recipients matched targets yet", pct: null }
  }
  const pct = Math.round((collected / total) * 100)
  if (collected === total) {
    return { label: "Completed", sub: `${collected} of ${total} collected`, pct: 100 }
  }
  if (collected > 0) {
    return { label: "In progress", sub: `${collected} of ${total} collected`, pct }
  }
  return { label: "Pending", sub: `${collected} of ${total} collected`, pct: 0 }
}

function roleLabel(kind: string): string {
  if (kind === "assistant_coach") return "Assistant coach"
  if (kind === "player") return "Player"
  if (kind === "parent") return "Parent"
  return kind
}

const PAGE_SIZES = [10, 25, 50] as const

export function DueCollectionsTab({
  teamId,
  rows,
  seasonYear,
  canEdit,
  onSaved,
}: {
  teamId: string
  rows: DueCollectionRow[]
  seasonYear: number
  canEdit: boolean
  onSaved: () => Promise<void>
}) {
  const [layout, setLayout] = useState<"cards" | "list">("cards")
  const [editor, setEditor] = useState<DueCollectionRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    description: "",
    amountDue: "",
    dueDate: new Date().toISOString().slice(0, 10),
    status: "pending" as "pending" | "in_progress" | "completed",
    notes: "",
    targetAll: false,
    targetAssistantCoaches: false,
    targetPlayers: false,
    targetParents: false,
  })

  const [trackId, setTrackId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailCollection, setDetailCollection] = useState<DueCollectionRow | null>(null)
  const [detailRecipients, setDetailRecipients] = useState<DetailRecipient[]>([])
  const [detailSearch, setDetailSearch] = useState("")
  const [detailPos, setDetailPos] = useState<string>("ALL")
  const [detailPage, setDetailPage] = useState(1)
  const [detailPageSize, setDetailPageSize] = useState<(typeof PAGE_SIZES)[number]>(25)

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/fundraising`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert((j as { error?: string }).error || "Request failed")
      return false
    }
    return true
  }

  const loadDetail = useCallback(async () => {
    if (!trackId) return
    setDetailLoading(true)
    try {
      const r = await fetch(
        `/api/teams/${encodeURIComponent(teamId)}/fundraising/due-collections/${encodeURIComponent(trackId)}`
      )
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error || "Failed to load")
      }
      const j = (await r.json()) as { collection: DueCollectionRow; recipients: DetailRecipient[] }
      setDetailCollection(j.collection)
      setDetailRecipients(j.recipients ?? [])
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error")
      setTrackId(null)
    } finally {
      setDetailLoading(false)
    }
  }, [teamId, trackId])

  useEffect(() => {
    if (trackId) void loadDetail()
  }, [trackId, loadDetail])

  useEffect(() => {
    setDetailPage(1)
  }, [detailSearch, detailPos, detailPageSize])

  const positionOptions = useMemo(() => {
    const s = new Set<string>()
    for (const r of detailRecipients) {
      if (r.role_kind === "player" && r.position_group?.trim()) s.add(r.position_group.trim())
    }
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [detailRecipients])

  const filteredRecipients = useMemo(() => {
    const q = detailSearch.trim().toLowerCase()
    return detailRecipients.filter((r) => {
      if (q && !r.display_name.toLowerCase().includes(q)) return false
      if (detailPos === "ALL") return true
      if (r.role_kind !== "player") return true
      return (r.position_group ?? "").trim() === detailPos
    })
  }, [detailRecipients, detailSearch, detailPos])

  const pageCount = Math.max(1, Math.ceil(filteredRecipients.length / detailPageSize) || 1)
  const safePage = Math.min(detailPage, pageCount)
  const pageStart = (safePage - 1) * detailPageSize
  const pageSlice = filteredRecipients.slice(pageStart, pageStart + detailPageSize)
  const showFrom = filteredRecipients.length === 0 ? 0 : pageStart + 1
  const showTo = Math.min(pageStart + pageSlice.length, filteredRecipients.length)

  useEffect(() => {
    if (detailPage > pageCount) setDetailPage(pageCount)
  }, [detailPage, pageCount])

  const save = async () => {
    if (!draft.description.trim()) {
      alert("Enter a description.")
      return
    }
    const hasTarget =
      draft.targetAll ||
      draft.targetAssistantCoaches ||
      draft.targetPlayers ||
      draft.targetParents
    if (!hasTarget) {
      alert("Select at least one recipient target.")
      return
    }
    const ok = editor
      ? await post({
          action: "update_due_collection",
          id: editor.id,
          description: draft.description.trim(),
          amountDue: Number(draft.amountDue) || 0,
          dueDate: draft.dueDate,
          status: draft.status,
          notes: draft.notes.trim() || null,
        })
      : await post({
          action: "add_due_collection",
          seasonYear,
          description: draft.description.trim(),
          amountDue: Number(draft.amountDue) || 0,
          dueDate: draft.dueDate,
          status: draft.status,
          notes: draft.notes.trim() || null,
          targetAll: draft.targetAll,
          targetAssistantCoaches: draft.targetAssistantCoaches,
          targetPlayers: draft.targetPlayers,
          targetParents: draft.targetParents,
        })
    if (!ok) return
    setEditor(null)
    setCreating(false)
    await onSaved()
  }

  const deleteRow = async (id: string) => {
    if (!confirm("Remove this due collection entry?")) return
    const ok = await post({ action: "delete_due_collection", id })
    if (ok) await onSaved()
  }

  const updateRecipientStatus = async (recipientId: string, contributionStatus: "pending" | "collected") => {
    if (!trackId || !detailCollection) return
    const ok = await post({
      action: "update_due_recipient",
      collectionId: trackId,
      recipientId,
      contributionStatus,
    })
    if (!ok) return
    await onSaved()
    await loadDetail()
  }

  const openCreate = () => {
    setCreating(true)
    setEditor(null)
    setDraft({
      description: "",
      amountDue: "",
      dueDate: new Date().toISOString().slice(0, 10),
      status: "pending",
      notes: "",
      targetAll: false,
      targetAssistantCoaches: false,
      targetPlayers: false,
      targetParents: false,
    })
  }

  const openEdit = (row: DueCollectionRow) => {
    setEditor(row)
    setCreating(false)
    setDraft({
      description: row.description,
      amountDue: String(row.amount_due ?? 0),
      dueDate: String(row.due_date).slice(0, 10),
      status: row.status === "completed" ? "completed" : row.status === "in_progress" ? "in_progress" : "pending",
      notes: row.notes ?? "",
      targetAll: Boolean(row.target_all),
      targetAssistantCoaches: Boolean(row.target_assistant_coaches),
      targetPlayers: Boolean(row.target_players),
      targetParents: Boolean(row.target_parents),
    })
  }

  const openTrack = (row: DueCollectionRow) => {
    setDetailSearch("")
    setDetailPos("ALL")
    setDetailPage(1)
    setDetailPageSize(25)
    setTrackId(row.id)
  }

  const setTargetAll = (on: boolean) => {
    setDraft((d) =>
      on
        ? {
            ...d,
            targetAll: true,
            targetAssistantCoaches: false,
            targetPlayers: false,
            targetParents: false,
          }
        : { ...d, targetAll: false }
    )
  }

  const toggleSpecific = (key: "targetAssistantCoaches" | "targetPlayers" | "targetParents", on: boolean) => {
    setDraft((d) => ({
      ...d,
      targetAll: false,
      [key]: on,
    }))
  }

  const dTotal = detailRecipients.length
  const dCollected = detailRecipients.filter((r) => r.contribution_status === "collected").length
  const detailGoalTotal = detailCollection ? Number(detailCollection.amount_due) || 0 : 0
  const detailShareEach = evenSharePerRecipient(detailGoalTotal, dTotal)
  const detailSummary = useMemo(() => {
    if (!detailCollection) return null
    return progressMeta({
      ...detailCollection,
      total_targets: dTotal,
      collected_count: dCollected,
      pending_count: Math.max(0, dTotal - dCollected),
    })
  }, [detailCollection, dTotal, dCollected])

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
        Track contribution status for program dues or shared costs. This is internal tracking only — not invoicing,
        billing, or in-app payment collection.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add due collection
          </Button>
        )}
        <div className="ml-auto flex rounded-lg border p-0.5" style={{ borderColor: "rgb(var(--border))" }}>
          <Button
            type="button"
            variant={layout === "cards" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2"
            onClick={() => setLayout("cards")}
            aria-pressed={layout === "cards"}
          >
            <LayoutGrid className="mr-1 h-4 w-4" />
            Cards
          </Button>
          <Button
            type="button"
            variant={layout === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2"
            onClick={() => setLayout("list")}
            aria-pressed={layout === "list"}
          >
            <List className="mr-1 h-4 w-4" />
            List
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="px-4 py-10 text-center text-sm" style={{ color: "rgb(var(--muted))" }}>
            No due collection entries for this season. {canEdit ? "Add one to start tracking contributions." : null}
          </CardContent>
        </Card>
      ) : layout === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const pm = progressMeta(r)
            const goal = Number(r.amount_due) || 0
            const n = r.total_targets ?? 0
            const share = evenSharePerRecipient(goal, n)
            return (
              <Card
                key={r.id}
                className="border transition-shadow hover:shadow-md"
                style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
              >
                <CardContent className="space-y-3 p-4">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => openTrack(r)}
                    aria-label={`Open tracking for ${r.description}`}
                  >
                    <p className="text-sm font-semibold leading-snug" style={{ color: "rgb(var(--text))" }}>
                      {r.description}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "rgb(var(--muted))" }}>
                      Due {String(r.due_date).slice(0, 10)} · {targetSummary(r)}
                    </p>
                    <p className="mt-2 text-lg font-semibold tabular-nums" style={{ color: "rgb(var(--text))" }}>
                      {formatMoney(goal)}
                    </p>
                    <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                      Total collection goal
                      {n > 0 ? (
                        <>
                          {" "}
                          · ~{formatMoney(share)} each ({n} {n === 1 ? "recipient" : "recipients"})
                        </>
                      ) : null}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor:
                            pm.label === "Completed"
                              ? "rgba(34,197,94,0.12)"
                              : pm.label === "In progress"
                                ? "rgba(59,130,246,0.12)"
                                : "rgba(148,163,184,0.15)",
                          color: "rgb(var(--text))",
                        }}
                      >
                        {pm.label}
                      </span>
                      <span className="text-xs tabular-nums" style={{ color: "rgb(var(--muted))" }}>
                        {pm.sub}
                        {pm.pct != null ? ` · ${pm.pct}%` : ""}
                      </span>
                    </div>
                  </button>
                  {canEdit ? (
                    <div className="flex justify-end gap-1 border-t pt-2" style={{ borderColor: "rgb(var(--border))" }}>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => void deleteRow(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="border" style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: "rgb(var(--border))" }}>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Goal / share</th>
                    <th className="px-4 py-2">Due</th>
                    <th className="px-4 py-2">Targets</th>
                    <th className="px-4 py-2">Progress</th>
                    <th className="px-4 py-2">Status</th>
                    {canEdit ? <th className="px-4 py-2 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const pm = progressMeta(r)
                    const goal = Number(r.amount_due) || 0
                    const n = r.total_targets ?? 0
                    const share = evenSharePerRecipient(goal, n)
                    return (
                      <tr key={r.id} className="border-b" style={{ borderColor: "rgb(var(--border))" }}>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            className="text-left font-medium hover:underline"
                            style={{ color: "rgb(var(--text))" }}
                            onClick={() => openTrack(r)}
                          >
                            {r.description}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <div className="tabular-nums font-medium" style={{ color: "rgb(var(--text))" }}>
                            {formatMoney(goal)}
                          </div>
                          {n > 0 ? (
                            <div className="text-xs tabular-nums" style={{ color: "rgb(var(--muted))" }}>
                              ~{formatMoney(share)} each
                            </div>
                          ) : (
                            <div className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                              No recipients yet
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">{String(r.due_date).slice(0, 10)}</td>
                        <td className="px-4 py-2 text-xs" style={{ color: "rgb(var(--muted))" }}>
                          {targetSummary(r)}
                        </td>
                        <td className="px-4 py-2 text-xs tabular-nums" style={{ color: "rgb(var(--muted))" }}>
                          {pm.sub}
                          {pm.pct != null ? ` · ${pm.pct}%` : ""}
                        </td>
                        <td className="px-4 py-2">
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs">{pm.label}</span>
                        </td>
                        {canEdit ? (
                          <td className="px-4 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => void deleteRow(r.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={creating || !!editor}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditor(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor ? "Edit due collection" : "Add due collection"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dc-desc">Description</Label>
              <Input
                id="dc-desc"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="e.g. Team travel share"
                className="mt-1 bg-white text-foreground"
              />
            </div>
            <div>
              <Label htmlFor="dc-amt">Total collection goal</Label>
              <Input
                id="dc-amt"
                inputMode="decimal"
                value={draft.amountDue}
                onChange={(e) => setDraft((d) => ({ ...d, amountDue: e.target.value }))}
                className="mt-1 bg-white text-foreground"
              />
              <p className="mt-1 text-xs" style={{ color: "rgb(var(--muted))" }}>
                Enter the full amount to collect across the group. Each targeted recipient’s expected share is this total
                divided evenly (same for everyone).
              </p>
            </div>
            <DatePicker
              id="dc-date"
              label="Due date"
              value={ymdToDate(draft.dueDate)}
              onChange={(d) => setDraft((prev) => ({ ...prev, dueDate: d ? dateToYmd(d) : prev.dueDate }))}
              placeholder="Select due date"
            />
            <div>
              <Label htmlFor="dc-status">Status</Label>
              <select
                id="dc-status"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-foreground"
                value={draft.status}
                onChange={(e) => {
                  const v = e.target.value
                  setDraft((d) => ({
                    ...d,
                    status: v === "completed" ? "completed" : v === "in_progress" ? "in_progress" : "pending",
                  }))
                }}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
              <p className="mt-1 text-xs" style={{ color: "rgb(var(--muted))" }}>
                You can also leave this as Pending; it updates automatically as contributions are recorded.
              </p>
            </div>
            <div>
              <Label htmlFor="dc-notes">Notes (optional)</Label>
              <textarea
                id="dc-notes"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                className={cn(
                  "mt-1 flex min-h-[72px] w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
                  "disabled:cursor-not-allowed disabled:opacity-50 transition-colors input-theme"
                )}
              />
            </div>

            {!editor ? (
              <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "rgb(var(--border))" }}>
                <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                  Recipient targets
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={draft.targetAll} onCheckedChange={(c) => setTargetAll(Boolean(c))} />
                  <span style={{ color: "rgb(var(--text))" }}>All</span>
                </label>
                <label
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    draft.targetAll ? "opacity-45 pointer-events-none" : ""
                  )}
                >
                  <Checkbox
                    checked={draft.targetAssistantCoaches}
                    disabled={draft.targetAll}
                    onCheckedChange={(c) => toggleSpecific("targetAssistantCoaches", Boolean(c))}
                  />
                  <span style={{ color: "rgb(var(--text))" }}>Assistant coaches</span>
                </label>
                <label
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    draft.targetAll ? "opacity-45 pointer-events-none" : ""
                  )}
                >
                  <Checkbox
                    checked={draft.targetPlayers}
                    disabled={draft.targetAll}
                    onCheckedChange={(c) => toggleSpecific("targetPlayers", Boolean(c))}
                  />
                  <span style={{ color: "rgb(var(--text))" }}>Players</span>
                </label>
                <label
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    draft.targetAll ? "opacity-45 pointer-events-none" : ""
                  )}
                >
                  <Checkbox
                    checked={draft.targetParents}
                    disabled={draft.targetAll}
                    onCheckedChange={(c) => toggleSpecific("targetParents", Boolean(c))}
                  />
                  <span style={{ color: "rgb(var(--text))" }}>Parents</span>
                </label>
                {draft.targetAll ? (
                  <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                    All includes assistant coaches, players, and parents linked to active roster players.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "rgb(var(--border))" }}>
                <p className="font-medium" style={{ color: "rgb(var(--text))" }}>
                  Recipient targets
                </p>
                <p className="mt-1" style={{ color: "rgb(var(--muted))" }}>
                  {targetSummary(editor)} — targets are fixed after creation. Delete and add a new collection to change
                  targets.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => (setCreating(false), setEditor(null))}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!trackId}
        onOpenChange={(o) => {
          if (!o) setTrackId(null)
        }}
      >
        <DialogContent
          showMobileSheetHandle={false}
          className="flex max-h-[min(90dvh,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-[56rem] flex-col overflow-hidden p-0 md:p-0"
        >
          <div className="border-b px-4 py-4 md:px-6" style={{ borderColor: "rgb(var(--border))" }}>
            <DialogHeader>
              <DialogTitle className="text-left">
                {detailCollection?.description ?? "Contribution tracking"}
              </DialogTitle>
            </DialogHeader>
            {detailCollection ? (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: "rgb(var(--muted))" }}>
                <span>
                  Total goal:{" "}
                  <strong className="tabular-nums" style={{ color: "rgb(var(--text))" }}>
                    {formatMoney(detailGoalTotal)}
                  </strong>
                  {dTotal > 0 ? (
                    <>
                      {" "}
                      · ~{formatMoney(detailShareEach)} each ({dTotal} {dTotal === 1 ? "recipient" : "recipients"})
                    </>
                  ) : null}
                </span>
                <span>Due {String(detailCollection.due_date).slice(0, 10)}</span>
                <span>Targets: {targetSummary(detailCollection)}</span>
              </div>
            ) : null}
            {detailSummary ? (
              <p className="mt-2 text-sm" style={{ color: "rgb(var(--text))" }}>
                <strong>{detailSummary.label}</strong>
                {detailSummary.sub ? ` · ${detailSummary.sub}` : ""}
              </p>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-hidden px-4 py-3 md:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                <Input
                  placeholder="Search by name"
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  className="bg-white pl-9 text-foreground"
                  aria-label="Search recipients"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="dc-pos" className="whitespace-nowrap text-xs sm:text-sm">
                  Position group
                </Label>
                <select
                  id="dc-pos"
                  className="h-10 min-w-[140px] rounded-md border border-input bg-white px-3 text-sm text-foreground"
                  value={detailPos}
                  onChange={(e) => setDetailPos(e.target.value)}
                >
                  <option value="ALL">All</option>
                  {positionOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "rgb(var(--border))" }}>
              <span style={{ color: "rgb(var(--muted))" }}>Summary · </span>
              <span className="tabular-nums" style={{ color: "rgb(var(--text))" }}>
                {dCollected} collected
              </span>
              <span style={{ color: "rgb(var(--muted))" }}> · </span>
              <span className="tabular-nums" style={{ color: "rgb(var(--text))" }}>
                {Math.max(0, dTotal - dCollected)} pending
              </span>
              <span style={{ color: "rgb(var(--muted))" }}> · </span>
              <span className="tabular-nums" style={{ color: "rgb(var(--text))" }}>
                {dTotal} targeted
              </span>
            </div>

            {detailLoading ? (
              <div className="space-y-2 py-6">
                <div className="h-10 animate-pulse rounded-md bg-muted" />
                <div className="h-10 animate-pulse rounded-md bg-muted" />
                <div className="h-10 animate-pulse rounded-md bg-muted" />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border" style={{ borderColor: "rgb(var(--border))" }}>
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="sticky top-0 z-[1] border-b bg-card" style={{ borderColor: "rgb(var(--border))" }}>
                    <tr className="text-left">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Group</th>
                      <th className="px-3 py-2">Position</th>
                      <th className="px-3 py-2">Expected share</th>
                      <th className="px-3 py-2">Contribution status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageSlice.map((rec) => (
                      <tr key={rec.id} className="border-b" style={{ borderColor: "rgb(var(--border))" }}>
                        <td className="px-3 py-2 font-medium" style={{ color: "rgb(var(--text))" }}>
                          {rec.display_name}
                        </td>
                        <td className="px-3 py-2">{roleLabel(rec.role_kind)}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: "rgb(var(--muted))" }}>
                          {rec.role_kind === "player" ? rec.position_group ?? "—" : "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {detailCollection && dTotal > 0 ? formatMoney(detailShareEach) : detailCollection ? "—" : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <select
                              className="h-9 w-full max-w-[160px] rounded-md border border-input bg-white px-2 text-sm text-foreground"
                              value={rec.contribution_status === "collected" ? "collected" : "pending"}
                              onChange={(e) =>
                                void updateRecipientStatus(
                                  rec.id,
                                  e.target.value === "collected" ? "collected" : "pending"
                                )
                              }
                            >
                              <option value="pending">Pending</option>
                              <option value="collected">Collected</option>
                            </select>
                          ) : (
                            <span className="capitalize">{rec.contribution_status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {pageSlice.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-sm" style={{ color: "rgb(var(--muted))" }}>
                          No recipients match filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "rgb(var(--border))" }}>
              <p className="text-xs tabular-nums" style={{ color: "rgb(var(--muted))" }}>
                Showing {showFrom}–{showTo} of {filteredRecipients.length}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs" style={{ color: "rgb(var(--muted))" }}>
                  Rows
                  <select
                    className="h-9 rounded-md border border-input bg-white px-2 text-sm text-foreground"
                    value={detailPageSize}
                    onChange={(e) => setDetailPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number])}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={safePage <= 1}
                    onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={safePage >= pageCount}
                    onClick={() => setDetailPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-4 py-3 md:px-6" style={{ borderColor: "rgb(var(--border))" }}>
            <Button type="button" variant="outline" onClick={() => setTrackId(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
