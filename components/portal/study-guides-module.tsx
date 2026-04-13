"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, BarChart3, TrendingUp, Sparkles, Loader2 } from "lucide-react"

type CoachTab = "assignments" | "library" | "mastery" | "progress"

const COACH_TABS: { id: CoachTab; label: string }[] = [
  { id: "assignments", label: "Assignments" },
  { id: "library", label: "Library" },
  { id: "mastery", label: "Mastery" },
  { id: "progress", label: "Progress" },
]

export function StudyGuidesModule({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  if (!canEdit) {
    return <StudyGuidesPlayerView teamId={teamId} />
  }
  return <StudyGuidesCoachView teamId={teamId} />
}

function StudyGuidesPlayerView({ teamId }: { teamId: string }) {
  const [list, setList] = useState<
    {
      id: string
      title: string
      due_date: string | null
      myStatus?: string
      items: { item_type: string; item_id: string }[]
    }[]
  >([])
  const [playbookMap, setPlaybookMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/teams/${encodeURIComponent(teamId)}/study/my`).then((r) => (r.ok ? r.json() : { assignments: [] })),
      fetch(`/api/playbooks?teamId=${encodeURIComponent(teamId)}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([assignData, pb]) => {
        if (cancelled) return
        setList(assignData.assignments ?? [])
        const arr = Array.isArray(pb) ? pb : []
        const m: Record<string, string> = {}
        for (const row of arr as { id?: string; name?: string }[]) {
          if (row.id && typeof row.name === "string") m[row.id] = row.name
        }
        setPlaybookMap(m)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#0B2A5B] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-8 md:px-0">
      <h1 className="text-2xl font-bold text-[#0F172A]">Study guides</h1>
      <p className="text-sm text-[#64748B]">
        Assignments from your coaches. Open each item in Playbooks as linked from your team.
      </p>
      <div className="space-y-3">
        {list.length === 0 && <p className="text-sm text-[#64748B]">No assignments yet.</p>}
        {list.map((a) => (
          <Card key={a.id} className="border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#0F172A]">{a.title}</p>
                  <p className="text-xs text-[#64748B]">
                    Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"} · Status: {a.myStatus ?? "—"}
                  </p>
                </div>
              </div>
              <ul className="mt-2 space-y-1.5 text-sm text-[#64748B]">
                {a.items.map((it, i) => {
                  if (it.item_type === "playbook") {
                    const name = playbookMap[it.item_id] ?? "Playbook"
                    return (
                      <li key={i}>
                        <Link
                          href={`/dashboard/playbooks/${encodeURIComponent(it.item_id)}`}
                          className="font-medium text-[#2563EB] underline-offset-2 hover:text-[#1D4ED8] hover:underline"
                        >
                          {name}
                        </Link>
                        <span className="ml-1.5 text-xs text-[#94A3B8]">(playbook)</span>
                      </li>
                    )
                  }
                  return (
                    <li key={i} className="list-inside list-disc">
                      {it.item_type} · {it.item_id.slice(0, 8)}…
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

type AssignmentRow = {
  id: string
  title: string
  due_date: string | null
  assigned_to_type: string
  assigned_position_group?: string | null
  counts: { notStarted: number; inProgress: number; completed: number; total: number }
}

function assignmentTargetLabel(a: Pick<AssignmentRow, "assigned_to_type" | "assigned_position_group">): string {
  if (a.assigned_to_type === "team") return "Entire Team"
  if (a.assigned_to_type === "position_group") {
    const g = a.assigned_position_group?.trim()
    return g ? g : "Position group"
  }
  if (a.assigned_to_type === "players") return "Selected Players"
  return a.assigned_to_type
}

function completionPercent(counts: AssignmentRow["counts"]): number {
  if (counts.total <= 0) return 0
  return Math.round((counts.completed / counts.total) * 100)
}

function progressBarClass(pct: number): string {
  if (pct >= 80) return "bg-green-500"
  if (pct >= 40) return "bg-amber-500"
  return "bg-slate-300"
}

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) {
    return (
      <span className="inline-flex items-center rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-2 py-0.5 text-xs font-medium text-[#64748B]">
        No due date
      </span>
    )
  }
  const d = new Date(dueDate)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((dueDay.getTime() - startToday.getTime()) / 86400000)

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        Past due
      </span>
    )
  }
  if (diffDays <= 3) {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
        {diffDays === 0 ? "Due today" : diffDays === 1 ? "Due tomorrow" : `Due in ${diffDays} days`}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-2 py-0.5 text-xs font-medium text-[#64748B]">
      Due {d.toLocaleDateString()}
    </span>
  )
}

function StudyGuidesCoachView({ teamId }: { teamId: string }) {
  const [tab, setTab] = useState<CoachTab>("assignments")
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [packs, setPacks] = useState<{ id: string; title: string; description: string | null; items: unknown[] }[]>([])
  const [playbooks, setPlaybooks] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [createPrefill, setCreatePrefill] = useState<{ title?: string; playbookId?: string; notes?: string } | null>(
    null
  )
  const [coachBOpen, setCoachBOpen] = useState(false)

  const base = `/api/teams/${encodeURIComponent(teamId)}/study`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, p, pb] = await Promise.all([
        fetch(`${base}/assignments`).then((r) => (r.ok ? r.json() : { assignments: [] })),
        fetch(`${base}/packs`).then((r) => (r.ok ? r.json() : { packs: [] })),
        fetch(`/api/playbooks?teamId=${encodeURIComponent(teamId)}`).then((r) => (r.ok ? r.json() : [])),
      ])
      setAssignments(a.assignments ?? [])
      setPacks(p.packs ?? [])
      setPlaybooks(Array.isArray(pb) ? pb.map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })) : [])
    } finally {
      setLoading(false)
    }
  }, [base, teamId])

  useEffect(() => {
    load()
  }, [load])

  const openNewAssignment = () => {
    setCreatePrefill(null)
    setCreateOpen(true)
  }

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-4 px-4 pb-8 md:px-0">
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Study guides</h1>
          <p className="mt-1 text-sm text-[#64748B]">Assignments, library packs, quizzes, and progress.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {tab === "assignments" && (
            <>
              <Button type="button" size="sm" className="rounded-lg" onClick={openNewAssignment}>
                <Plus className="mr-1 h-4 w-4" />
                New Assignment
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setCoachBOpen(true)}>
                <Sparkles className="mr-1 h-4 w-4" />
                Create with Coach B
              </Button>
            </>
          )}
        </div>
      </div>

      <PortalUnderlineTabs tabs={COACH_TABS} value={tab} onValueChange={(id) => setTab(id as CoachTab)} ariaLabel="Study guides" />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#0B2A5B] border-t-transparent" />
        </div>
      ) : (
        <>
          {tab === "assignments" && (
            <div className="space-y-3">
              {assignments.map((a) => {
                const pct = completionPercent(a.counts)
                return (
                  <Card key={a.id} className="border-[#E5E7EB]">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#0F172A]">{a.title}</p>
                          <p className="mt-1 text-xs text-[#64748B]">
                            Target: {assignmentTargetLabel(a)}
                          </p>
                        </div>
                        <DueDateBadge dueDate={a.due_date} />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-[#64748B]">
                          <span>Progress</span>
                          <span className="tabular-nums font-medium text-[#0F172A]">
                            {a.counts.completed}/{a.counts.total} completed ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                          <div
                            className={`h-full rounded-full transition-all ${progressBarClass(pct)}`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {assignments.length === 0 && <p className="text-sm text-[#64748B]">No assignments yet.</p>}
            </div>
          )}
          {tab === "library" && (
            <div className="space-y-3">
              {packs.map((p) => (
                <Card key={p.id} className="border-[#E5E7EB]">
                  <CardContent className="p-4">
                    <p className="font-medium text-[#0F172A]">{p.title}</p>
                    <p className="text-sm text-[#64748B]">{p.description || "—"}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">{p.items?.length ?? 0} content items</p>
                  </CardContent>
                </Card>
              ))}
              {packs.length === 0 && (
                <p className="text-sm text-[#64748B]">No study packs yet. Create packs via API or a future editor.</p>
              )}
            </div>
          )}
          {tab === "mastery" && (
            <Card className="border-[#E5E7EB]">
              <CardContent className="flex items-center gap-3 p-6 text-sm text-[#64748B]">
                <BarChart3 className="h-8 w-8 shrink-0 text-[#94A3B8]" />
                Quiz tracking and scores per assignment will appear here as quizzes are added to assignments.
              </CardContent>
            </Card>
          )}
          {tab === "progress" && (
            <Card className="border-[#E5E7EB]">
              <CardContent className="flex items-center gap-3 p-6 text-sm text-[#64748B]">
                <TrendingUp className="h-8 w-8 shrink-0 text-[#94A3B8]" />
                Team-wide completion and “not started” alerts will aggregate here from assignment player rows.
              </CardContent>
            </Card>
          )}
        </>
      )}

      <CoachBStudyAssignmentDialog
        open={coachBOpen}
        onClose={() => setCoachBOpen(false)}
        teamId={teamId}
        playbooks={playbooks}
        onUseSuggestion={(prefill) => {
          setCoachBOpen(false)
          setCreatePrefill(prefill)
          setCreateOpen(true)
        }}
      />

      <CreateAssignmentDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setCreatePrefill(null)
        }}
        teamId={teamId}
        playbooks={playbooks}
        prefill={createPrefill}
        onCreated={async () => {
          setCreateOpen(false)
          setCreatePrefill(null)
          await load()
        }}
      />
    </div>
  )
}

function parseCoachBAssignmentResponse(text: string): { title: string; description: string; playbookName: string | null } {
  const titleM = text.match(/TITLE:\s*(.+)/im)
  const descM = text.match(/DESCRIPTION:\s*([\s\S]*?)(?=\n\s*PLAYBOOK:|$)/i)
  const pbM = text.match(/PLAYBOOK:\s*(.+)/im)
  let title = (titleM?.[1] ?? "").trim()
  const description = (descM?.[1] ?? "").trim()
  let playbookName: string | null = (pbM?.[1] ?? "").trim()
  if (!playbookName || /^none$/i.test(playbookName)) playbookName = null
  if (!title && text.trim()) title = text.trim().slice(0, 120)
  return { title, description, playbookName }
}

function buildCoachBStudyPrompt(userPrompt: string, playbookNames: string[]): string {
  const list = playbookNames.length ? playbookNames.join("; ") : "(No playbooks listed — suggest PLAYBOOK: NONE)"
  return `You are helping a high school football coach draft a study guide assignment for their team.

Available team playbooks (reference by exact name when recommending one): ${list}

Coach request:
${userPrompt.trim()}

Reply using exactly these lines:
TITLE: <short assignment title>
DESCRIPTION: <2-4 sentences: what players should review>
PLAYBOOK: <exact playbook name from the list above, or NONE>`
}

function CoachBStudyAssignmentDialog({
  open,
  onClose,
  teamId,
  playbooks,
  onUseSuggestion,
}: {
  open: boolean
  onClose: () => void
  teamId: string
  playbooks: { id: string; name: string }[]
  onUseSuggestion: (prefill: { title?: string; playbookId?: string; notes?: string }) => void
}) {
  const [prompt, setPrompt] = useState("")
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPrompt("")
      setOutput("")
      setError(null)
      setLoading(false)
    }
  }, [open])

  const generate = async () => {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    setOutput("")
    try {
      const names = playbooks.map((p) => p.name)
      const message = buildCoachBStudyPrompt(text, names)
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          message,
          conversationHistory: [],
          enableActionTools: false,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not generate")
        return
      }
      if (data.type === "action_proposal" && typeof data.message === "string") {
        setOutput(data.message)
        return
      }
      if (typeof data.response === "string") {
        setOutput(data.response)
        return
      }
      setError("Unexpected response from Coach B.")
    } catch {
      setError("Network error.")
    } finally {
      setLoading(false)
    }
  }

  const useThis = () => {
    const parsed = parseCoachBAssignmentResponse(output)
    const name = parsed.playbookName
    let playbookId = ""
    if (name) {
      const hit = playbooks.find((p) => p.name.trim().toLowerCase() === name.toLowerCase())
      if (hit) playbookId = hit.id
    }
    onUseSuggestion({
      title: parsed.title || undefined,
      playbookId: playbookId || undefined,
      notes: parsed.description || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create assignment with Coach B</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <div>
            <Label htmlFor="coach-b-study-prompt">What should players study?</Label>
            <textarea
              id="coach-b-study-prompt"
              className="mt-1 flex min-h-[100px] w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
              placeholder='e.g. "Create a study assignment for the offensive line covering our base run formations"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" className="rounded-lg" onClick={generate} disabled={loading || !prompt.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate"
            )}
          </Button>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div>
            <Label htmlFor="coach-b-study-output">Coach B response</Label>
            <textarea
              id="coach-b-study-output"
              readOnly
              className="mt-1 flex min-h-[160px] w-full rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#334155]"
              value={output}
              placeholder="Generated title, description, and playbook suggestion will appear here."
            />
          </div>
        </div>
        <DialogFooter className="flex flex-wrap gap-2 border-t border-[#E5E7EB] pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={useThis} disabled={!output.trim()}>
            Use this
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateAssignmentDialog({
  open,
  onClose,
  teamId,
  playbooks,
  prefill,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  teamId: string
  playbooks: { id: string; name: string }[]
  prefill: { title?: string; playbookId?: string; notes?: string } | null
  onCreated: () => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [due, setDue] = useState("")
  const [target, setTarget] = useState<"team" | "position_group" | "players">("team")
  const [pos, setPos] = useState("")
  const [playbookId, setPlaybookId] = useState("")
  const [coachNotes, setCoachNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (prefill) {
      setTitle(prefill.title ?? "")
      setPlaybookId(prefill.playbookId ?? "")
      setCoachNotes(prefill.notes ?? "")
    } else {
      setTitle("")
      setDue("")
      setTarget("team")
      setPos("")
      setPlaybookId("")
      setCoachNotes("")
    }
  }, [open, prefill])

  const save = async () => {
    if (!title.trim() || !playbookId) {
      alert("Title and at least one playbook are required.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/study/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueDate: due || null,
          assignedToType: target,
          assignedPositionGroup: target === "position_group" ? pos : null,
          items: [{ itemType: "playbook", itemId: playbookId }],
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? "Failed")
        return
      }
      await onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          {coachNotes.trim() ? (
            <div>
              <Label>Suggested notes from Coach B (optional — not saved with assignment)</Label>
              <textarea
                className="mt-1 flex min-h-[72px] w-full rounded-md border border-[#E5E7EB] bg-[#FFFBEB] px-3 py-2 text-sm text-[#78350F]"
                value={coachNotes}
                onChange={(e) => setCoachNotes(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <Label>Due date</Label>
            <Input className="mt-1" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <Label>Assign to</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
              value={target}
              onChange={(e) => setTarget(e.target.value as "team" | "position_group" | "players")}
            >
              <option value="team">Entire team</option>
              <option value="position_group">Position group</option>
            </select>
          </div>
          {target === "position_group" && (
            <div>
              <Label>Position group</Label>
              <Input className="mt-1" value={pos} onChange={(e) => setPos(e.target.value)} placeholder="e.g. OL" />
            </div>
          )}
          <div>
            <Label>Playbook (content item)</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
              value={playbookId}
              onChange={(e) => setPlaybookId(e.target.value)}
            >
              <option value="">Select playbook</option>
              {playbooks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
