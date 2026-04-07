"use client"

import { useCallback, useEffect, useState } from "react"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, BarChart3, TrendingUp } from "lucide-react"

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/teams/${encodeURIComponent(teamId)}/study/my`)
      .then((r) => (r.ok ? r.json() : { assignments: [] }))
      .then((d) => setList(d.assignments ?? []))
      .finally(() => setLoading(false))
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
      <p className="text-sm text-[#64748B]">Assignments from your coaches. Open each item in Playbooks as linked from your team.</p>
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
              <ul className="mt-2 list-inside list-disc text-sm text-[#64748B]">
                {a.items.map((it, i) => (
                  <li key={i}>
                    {it.item_type} · {it.item_id.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function StudyGuidesCoachView({ teamId }: { teamId: string }) {
  const [tab, setTab] = useState<CoachTab>("assignments")
  const [assignments, setAssignments] = useState<
    {
      id: string
      title: string
      due_date: string | null
      assigned_to_type: string
      counts: { notStarted: number; inProgress: number; completed: number; total: number }
    }[]
  >([])
  const [packs, setPacks] = useState<{ id: string; title: string; description: string | null; items: unknown[] }[]>([])
  const [playbooks, setPlaybooks] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

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

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-4 px-4 pb-8 md:px-0">
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Study guides</h1>
          <p className="mt-1 text-sm text-[#64748B]">Assignments, library packs, quizzes, and progress.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === "assignments" && (
            <Button type="button" size="sm" className="rounded-lg" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              New Assignment
            </Button>
          )}
          {tab === "library" && (
            <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={load}>
              Refresh
            </Button>
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
              {assignments.map((a) => (
                <Card key={a.id} className="border-[#E5E7EB]">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{a.title}</p>
                      <p className="text-xs text-[#64748B]">
                        Target: {a.assigned_to_type} · Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="text-xs text-[#64748B]">
                      Not started {a.counts.notStarted} · In progress {a.counts.inProgress} · Done {a.counts.completed}{" "}
                      / {a.counts.total}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
              {packs.length === 0 && <p className="text-sm text-[#64748B]">No study packs yet. Create packs via API or a future editor.</p>}
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

      <CreateAssignmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        teamId={teamId}
        playbooks={playbooks}
        onCreated={async () => {
          setCreateOpen(false)
          await load()
        }}
      />
    </div>
  )
}

function CreateAssignmentDialog({
  open,
  onClose,
  teamId,
  playbooks,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  teamId: string
  playbooks: { id: string; name: string }[]
  onCreated: () => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [due, setDue] = useState("")
  const [target, setTarget] = useState<"team" | "position_group" | "players">("team")
  const [pos, setPos] = useState("")
  const [playbookId, setPlaybookId] = useState("")
  const [saving, setSaving] = useState(false)

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
