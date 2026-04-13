"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BarChart3, Loader2, Plus, Sparkles, TrendingUp } from "lucide-react"
import type { DraftStudyQuestion } from "@/lib/study-coach-b-quiz"
import {
  assignmentTargetLabel,
  assignmentTypeLabel,
  completionPercent,
  DueDateBadge,
  EmptyStateCard,
  progressBarClass,
  StudyGuideAssignmentListSkeleton,
  StudyGuideDetailPaneSkeleton,
  StudyGuideLibraryPackSkeleton,
  StudyGuideProgressSnapshotSkeleton,
  type CoachAssignmentSummary,
} from "./study-guides-shared"

type CoachTab = "assignments" | "library" | "mastery" | "progress"

const COACH_TABS: { id: CoachTab; label: string }[] = [
  { id: "assignments", label: "Assignments" },
  { id: "library", label: "Library" },
  { id: "mastery", label: "Mastery" },
  { id: "progress", label: "Progress" },
]

type Catalog = {
  playbooks: { id: string; name: string }[]
  formations: { id: string; name: string; side: string; playbook_id: string | null }[]
  plays: { id: string; name: string; side: string; playbook_id: string | null }[]
  install_scripts: { id: string; name: string; playbook_id: string }[]
  study_packs: { id: string; title: string }[]
}

type RosterPlayer = { id: string; firstName: string; lastName: string; positionGroup: string | null }

export function StudyGuidesCoachView({ teamId }: { teamId: string }) {
  const [tab, setTab] = useState<CoachTab>("assignments")
  const [assignments, setAssignments] = useState<CoachAssignmentSummary[]>([])
  const [packs, setPacks] = useState<{ id: string; title: string; description: string | null; items: unknown[] }[]>([])
  const [packsLoaded, setPacksLoaded] = useState(false)
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const base = `/api/teams/${encodeURIComponent(teamId)}/study`

  const loadAssignments = useCallback(async () => {
    const res = await fetch(`${base}/assignments`, { credentials: "same-origin" })
    const data = res.ok ? await res.json() : { assignments: [] }
    setAssignments(data.assignments ?? [])
  }, [base])

  const loadPacks = useCallback(async () => {
    const res = await fetch(`${base}/packs`, { credentials: "same-origin" })
    const data = res.ok ? await res.json() : { packs: [] }
    setPacks(data.packs ?? [])
    setPacksLoaded(true)
  }, [base])

  useEffect(() => {
    let cancelled = false
    setAssignmentsLoading(true)
    loadAssignments().finally(() => {
      if (!cancelled) setAssignmentsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [loadAssignments])

  useEffect(() => {
    if (tab !== "library" || packsLoaded) return
    void loadPacks()
  }, [tab, packsLoaded, loadPacks])

  const progressAgg = useMemo(
    () =>
      assignments.reduce(
        (acc, a) => {
          acc.total += a.counts.total
          acc.completed += a.counts.completed
          acc.notStarted += a.counts.notStarted
          acc.overdue += a.counts.overdue
          return acc
        },
        { total: 0, completed: 0, notStarted: 0, overdue: 0 }
      ),
    [assignments]
  )

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-4 px-4 pb-8 md:px-0">
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Study guides</h1>
          <p className="mt-1 text-sm text-[#64748B]">Program-linked assignments, quizzes, and accountability.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {tab === "assignments" && (
            <Button type="button" size="sm" className="rounded-lg" onClick={() => setBuilderOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              New assignment
            </Button>
          )}
        </div>
      </div>

      <PortalUnderlineTabs tabs={COACH_TABS} value={tab} onValueChange={(id) => setTab(id as CoachTab)} ariaLabel="Study guides" />

      <div className="min-h-[240px]">
        {tab === "assignments" && (
          <div className="space-y-3">
            {assignmentsLoading ? (
              <StudyGuideAssignmentListSkeleton />
            ) : (
              <>
                {assignments.map((a) => {
                  const pct = completionPercent(a.counts)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full text-left"
                      onClick={() => setDetailId(a.id)}
                    >
                      <Card className="border-[#E5E7EB] transition-colors hover:border-[#CBD5E1]">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-[#0F172A]">{a.title}</p>
                              <p className="mt-1 text-xs text-[#64748B]">
                                {assignmentTypeLabel(a.assignment_type)} · Target: {assignmentTargetLabel(a)}
                                {a.publish_status === "draft" ? " · Draft" : ""}
                              </p>
                              <p className="mt-1 text-xs text-[#64748B]">
                                Avg score: {a.avgScore !== null && a.avgScore !== undefined ? `${a.avgScore}%` : "—"} · Overdue
                                players: {a.counts.overdue ?? 0}
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
                            <p className="mt-1 text-xs text-[#94A3B8]">
                              Not started {a.counts.notStarted} · In progress {a.counts.inProgress}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  )
                })}
                {assignments.length === 0 && <p className="text-sm text-[#64748B]">No assignments yet.</p>}
              </>
            )}
          </div>
        )}
        {tab === "library" && (
          <div className="space-y-3">
            {!packsLoaded ? <StudyGuideLibraryPackSkeleton /> : null}
            {packsLoaded &&
              packs.map((p) => (
                <Card key={p.id} className="border-[#E5E7EB]">
                  <CardContent className="p-4">
                    <p className="font-medium text-[#0F172A]">{p.title}</p>
                    <p className="text-sm text-[#64748B]">{p.description || "—"}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">{p.items?.length ?? 0} content items</p>
                  </CardContent>
                </Card>
              ))}
            {packsLoaded && packs.length === 0 && (
              <p className="text-sm text-[#64748B]">No study packs yet. Build packs from the API or a future editor.</p>
            )}
          </div>
        )}
        {tab === "mastery" && (
          <EmptyStateCard icon={BarChart3}>
            Open an assignment card to view per-player quiz scores and review completion in the Results tab.
          </EmptyStateCard>
        )}
        {tab === "progress" && (
          <>
            {assignmentsLoading ? (
              <StudyGuideProgressSnapshotSkeleton />
            ) : (
              <Card className="border-[#E5E7EB]">
                <CardContent className="flex flex-col gap-2 p-6 text-sm text-[#64748B]">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 shrink-0 text-[#94A3B8]" />
                    <div>
                      <p className="font-medium text-[#0F172A]">Team snapshot</p>
                      <p className="mt-1 text-xs">
                        Total player slots: {progressAgg.total} · Completed: {progressAgg.completed} · Not started:{" "}
                        {progressAgg.notStarted} · Overdue (incomplete past due): {progressAgg.overdue}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <AssignmentBuilderDialog
        open={builderOpen}
        teamId={teamId}
        onClose={() => setBuilderOpen(false)}
        onCreated={async () => {
          setBuilderOpen(false)
          await loadAssignments()
        }}
      />

      <CoachAssignmentDetailDialog
        open={Boolean(detailId)}
        teamId={teamId}
        assignmentId={detailId}
        onClose={() => setDetailId(null)}
        onUpdated={loadAssignments}
      />
    </div>
  )
}

function AssignmentBuilderDialog({
  open,
  teamId,
  onClose,
  onCreated,
}: {
  open: boolean
  teamId: string
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [title, setTitle] = useState("")
  const [due, setDue] = useState("")
  const [assignmentType, setAssignmentType] = useState<"review" | "quiz" | "mixed">("review")
  const [target, setTarget] = useState<"team" | "side" | "position_group" | "players">("team")
  const [pos, setPos] = useState("")
  const [side, setSide] = useState<"offense" | "defense" | "special_teams">("offense")
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [sources, setSources] = useState<{ itemType: string; itemId: string; label: string }[]>([])
  const [addKind, setAddKind] = useState<string>("playbook")
  const [addId, setAddId] = useState("")
  const [questions, setQuestions] = useState<DraftStudyQuestion[]>([])
  const [publish, setPublish] = useState(true)
  const [saving, setSaving] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [genObjective, setGenObjective] = useState("")
  const [genTypes, setGenTypes] = useState({ mc: true, tf: true, match: false })
  const [genLoading, setGenLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle("")
    setDue("")
    setAssignmentType("review")
    setTarget("team")
    setPos("")
    setSide("offense")
    setSelectedPlayers([])
    setSources([])
    setAddKind("playbook")
    setAddId("")
    setQuestions([])
    setPublish(true)
    let cancelled = false
    Promise.all([
      fetch(`/api/teams/${encodeURIComponent(teamId)}/study/catalog`, { credentials: "same-origin" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}&lite=1`, { credentials: "same-origin" }).then((r) =>
        r.ok ? r.json() : []
      ),
    ]).then(([cat, ros]) => {
      if (cancelled) return
      setCatalog(cat)
      const arr = Array.isArray(ros) ? ros : []
      setRoster(
        arr.map((p: { id: string; firstName?: string; lastName?: string; positionGroup?: string | null }) => ({
          id: p.id,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          positionGroup: p.positionGroup ?? null,
        }))
      )
    })
    return () => {
      cancelled = true
    }
  }, [open, teamId])

  const catalogOptions = (kind: string): { id: string; label: string }[] => {
    if (!catalog) return []
    if (kind === "playbook") return catalog.playbooks.map((p) => ({ id: p.id, label: p.name }))
    if (kind === "formation") return catalog.formations.map((f) => ({ id: f.id, label: `${f.name} (${f.side})` }))
    if (kind === "play") return catalog.plays.map((p) => ({ id: p.id, label: p.name }))
    if (kind === "install_script") return catalog.install_scripts.map((s) => ({ id: s.id, label: s.name }))
    if (kind === "study_pack") return catalog.study_packs.map((p) => ({ id: p.id, label: p.title }))
    return []
  }

  const addSource = () => {
    if (!addId) return
    const label = catalogOptions(addKind).find((o) => o.id === addId)?.label ?? addId
    if (sources.some((s) => s.itemType === addKind && s.itemId === addId)) return
    setSources((prev) => [...prev, { itemType: addKind, itemId: addId, label }])
  }

  const removeSource = (itemType: string, itemId: string) => {
    setSources((prev) => prev.filter((s) => !(s.itemType === itemType && s.itemId === itemId)))
  }

  const addMc = () => {
    setQuestions((prev) => [
      ...prev,
      {
        questionText: "",
        questionType: "multiple_choice",
        options: ["", "", "", ""],
        correctIndex: 0,
        answerKey: null,
      },
    ])
  }

  const addTf = () => {
    setQuestions((prev) => [
      ...prev,
      {
        questionText: "",
        questionType: "true_false",
        options: ["True", "False"],
        correctIndex: 0,
        answerKey: null,
      },
    ])
  }

  const runGenerate = async () => {
    if (!genObjective.trim() || !sources.length) {
      alert("Select at least one program source and enter an objective.")
      return
    }
    const questionTypes: ("multiple_choice" | "true_false" | "matching")[] = []
    if (genTypes.mc) questionTypes.push("multiple_choice")
    if (genTypes.tf) questionTypes.push("true_false")
    if (genTypes.match) questionTypes.push("matching")
    if (!questionTypes.length) {
      alert("Pick at least one question type.")
      return
    }
    setGenLoading(true)
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/study/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          sources: sources.map((s) => ({ itemType: s.itemType, itemId: s.itemId })),
          coachObjective: genObjective.trim(),
          assignmentType,
          questionTypes,
          maxQuestions: 8,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert((data as { error?: string }).error ?? "Generation failed")
        return
      }
      const qs = (data as { questions?: DraftStudyQuestion[] }).questions ?? []
      if (!qs.length) {
        alert("Coach B returned no questions. Try a narrower objective.")
        return
      }
      setQuestions((prev) => [...prev, ...qs])
      setGenOpen(false)
      setGenObjective("")
    } finally {
      setGenLoading(false)
    }
  }

  const save = async () => {
    if (!title.trim()) {
      alert("Title is required.")
      return
    }
    if (!sources.length) {
      alert("Add at least one program source item.")
      return
    }
    if ((assignmentType === "quiz" || assignmentType === "mixed") && questions.length === 0) {
      alert("Add or generate quiz questions.")
      return
    }
    const cleanedQs = questions
      .map((q) => ({
        ...q,
        questionText: q.questionText.trim(),
        options:
          q.questionType === "multiple_choice"
            ? (q.options as string[]).map((s) => s.trim()).filter(Boolean)
            : q.options,
      }))
      .filter((q) => q.questionText && (q.questionType !== "multiple_choice" || (Array.isArray(q.options) && q.options.length >= 2)))

    if ((assignmentType === "quiz" || assignmentType === "mixed") && cleanedQs.length === 0) {
      alert("Questions are incomplete.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/study/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: title.trim(),
          dueDate: due || null,
          assignedToType: target,
          assignedPositionGroup: target === "position_group" ? pos : null,
          assignedSide: target === "side" ? side : null,
          playerIds: target === "players" ? selectedPlayers : undefined,
          assignmentType,
          publishStatus: publish ? "published" : "draft",
          items: sources.map((s) => ({ itemType: s.itemType, itemId: s.itemId })),
          questions: assignmentType === "review" ? [] : cleanedQs,
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
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[min(92vh,900px)] overflow-y-auto bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <Label>Title</Label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
                value={assignmentType}
                onChange={(e) => setAssignmentType(e.target.value as "review" | "quiz" | "mixed")}
              >
                <option value="review">Review (material only)</option>
                <option value="quiz">Quiz (questions only)</option>
                <option value="mixed">Mixed (material + quiz)</option>
              </select>
            </div>
            <div>
              <Label>Program sources</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                <select
                  className="h-10 rounded-md border border-[#E5E7EB] px-2 text-sm"
                  value={addKind}
                  onChange={(e) => {
                    setAddKind(e.target.value)
                    setAddId("")
                  }}
                >
                  <option value="playbook">Playbook</option>
                  <option value="formation">Formation</option>
                  <option value="play">Play</option>
                  <option value="install_script">Install script</option>
                  <option value="study_pack">Study pack</option>
                </select>
                <select
                  className="min-w-0 flex-1 rounded-md border border-[#E5E7EB] px-2 text-sm"
                  value={addId}
                  onChange={(e) => setAddId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {catalogOptions(addKind).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={addSource}>
                  Add
                </Button>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-[#64748B]">
                {sources.map((s) => (
                  <li key={`${s.itemType}-${s.itemId}`} className="flex items-center justify-between gap-2">
                    <span>
                      {s.itemType}: {s.label}
                    </span>
                    <button type="button" className="text-[#2563EB] hover:underline" onClick={() => removeSource(s.itemType, s.itemId)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {(assignmentType === "quiz" || assignmentType === "mixed") && (
              <div className="space-y-2 rounded-md border border-[#E5E7EB] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[#0F172A]">Questions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={addMc}>
                      Add multiple choice
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={addTf}>
                      Add true/false
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setGenOpen(true)}>
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      Coach B
                    </Button>
                  </div>
                </div>
                {questions.length === 0 && <p className="text-xs text-[#64748B]">No questions yet.</p>}
                {questions.map((q, qi) => (
                  <div key={qi} className="rounded border border-[#F1F5F9] p-2">
                    <Input
                      className="mb-2"
                      placeholder="Question text"
                      value={q.questionText}
                      onChange={(e) => {
                        const v = e.target.value
                        setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, questionText: v } : x)))
                      }}
                    />
                    {q.questionType === "multiple_choice" && (
                      <div className="space-y-1">
                        {(q.options as string[]).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <Input
                              value={opt}
                              onChange={(e) => {
                                const v = e.target.value
                                setQuestions((prev) =>
                                  prev.map((x, i) => {
                                    if (i !== qi) return x
                                    const opts = [...(x.options as string[])]
                                    opts[oi] = v
                                    return { ...x, options: opts }
                                  })
                                )
                              }}
                            />
                            <label className="flex shrink-0 items-center gap-1 text-xs">
                              <input
                                type="radio"
                                name={`correct-${qi}`}
                                checked={q.correctIndex === oi}
                                onChange={() =>
                                  setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, correctIndex: oi } : x)))
                                }
                              />
                              Correct
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.questionType === "true_false" && (
                      <div className="flex gap-3 text-xs">
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            checked={q.correctIndex === 0}
                            onChange={() =>
                              setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, correctIndex: 0 } : x)))
                            }
                          />
                          True correct
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            checked={q.correctIndex === 1}
                            onChange={() =>
                              setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, correctIndex: 1 } : x)))
                            }
                          />
                          False correct
                        </label>
                      </div>
                    )}
                    {q.questionType === "matching" && (
                      <p className="text-xs text-[#64748B]">Matching (Coach B). Players match rows on submit.</p>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 text-xs text-red-600"
                      onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                    >
                      Remove question
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>Due date</Label>
              <Input className="mt-1" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div>
              <Label>Assign to</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
                value={target}
                onChange={(e) => setTarget(e.target.value as typeof target)}
              >
                <option value="team">Entire team</option>
                <option value="side">Side of ball</option>
                <option value="position_group">Position group</option>
                <option value="players">Selected players</option>
              </select>
            </div>
            {target === "side" && (
              <div>
                <Label>Side</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm"
                  value={side}
                  onChange={(e) => setSide(e.target.value as typeof side)}
                >
                  <option value="offense">Offense</option>
                  <option value="defense">Defense</option>
                  <option value="special_teams">Special teams</option>
                </select>
              </div>
            )}
            {target === "position_group" && (
              <div>
                <Label>Position group</Label>
                <Input className="mt-1" value={pos} onChange={(e) => setPos(e.target.value)} placeholder="e.g. OL" />
              </div>
            )}
            {target === "players" && (
              <div>
                <Label>Players</Label>
                <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-[#E5E7EB] p-2 text-xs">
                  {roster.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedPlayers.includes(p.id)}
                        onChange={() =>
                          setSelectedPlayers((prev) =>
                            prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                          )
                        }
                      />
                      <span>
                        {p.firstName} {p.lastName}
                        {p.positionGroup ? ` · ${p.positionGroup}` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-[#334155]">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
              Publish immediately (players won&apos;t see drafts)
            </label>
          </div>
          <DialogFooter className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Coach B — generate questions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-[#64748B]">Uses only the program sources already added to this assignment.</p>
            <div>
              <Label>Objective</Label>
              <textarea
                className="mt-1 flex min-h-[80px] w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
                value={genObjective}
                onChange={(e) => setGenObjective(e.target.value)}
                placeholder="e.g. Check alignment rules for inside zone from this install."
              />
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={genTypes.mc} onChange={(e) => setGenTypes((s) => ({ ...s, mc: e.target.checked }))} />
                Multiple choice
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={genTypes.tf} onChange={(e) => setGenTypes((s) => ({ ...s, tf: e.target.checked }))} />
                True / false
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={genTypes.match}
                  onChange={(e) => setGenTypes((s) => ({ ...s, match: e.target.checked }))}
                />
                Matching
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGenOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={genLoading} onClick={() => void runGenerate()}>
              {genLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CoachAssignmentDetailDialog({
  open,
  teamId,
  assignmentId,
  onClose,
  onUpdated,
}: {
  open: boolean
  teamId: string
  assignmentId: string | null
  onClose: () => void
  onUpdated: () => Promise<void>
}) {
  const [sub, setSub] = useState<"overview" | "results">("overview")
  const [detail, setDetail] = useState<{
    assignment: Record<string, unknown>
    items: unknown[]
    quiz: { id: string; questions: unknown[] } | null
  } | null>(null)
  const [players, setPlayers] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !assignmentId) {
      setDetail(null)
      setPlayers([])
      return
    }
    let cancelled = false
    setLoading(true)
    setSub("overview")
    Promise.all([
      fetch(`/api/teams/${encodeURIComponent(teamId)}/study/assignments/${encodeURIComponent(assignmentId)}`, {
        credentials: "same-origin",
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/teams/${encodeURIComponent(teamId)}/study/assignments/${encodeURIComponent(assignmentId)}/results`, {
        credentials: "same-origin",
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, r]) => {
        if (cancelled) return
        setDetail(d)
        setPlayers((r as { players?: unknown[] })?.players ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, assignmentId, teamId])

  const publishToggle = async () => {
    if (!assignmentId || !detail?.assignment) return
    const cur = detail.assignment.publish_status as string
    const next = cur === "published" ? "draft" : "published"
    const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/study/assignments/${encodeURIComponent(assignmentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ publishStatus: next }),
    })
    if (!res.ok) {
      alert("Update failed")
      return
    }
    await onUpdated()
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            assignment: { ...prev.assignment, publish_status: next },
          }
        : prev
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[min(92vh,820px)] overflow-y-auto bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{(detail?.assignment?.title as string) ?? "Assignment"}</DialogTitle>
        </DialogHeader>
        {loading || !detail ? (
          <StudyGuideDetailPaneSkeleton />
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-2">
              <Button type="button" size="sm" variant={sub === "overview" ? "default" : "outline"} onClick={() => setSub("overview")}>
                Overview
              </Button>
              <Button type="button" size="sm" variant={sub === "results" ? "default" : "outline"} onClick={() => setSub("results")}>
                Results
              </Button>
              <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => void publishToggle()}>
                Toggle publish
              </Button>
            </div>
            {sub === "overview" && (
              <div className="space-y-3 text-[#64748B]">
                <p>
                  Type: {assignmentTypeLabel(detail.assignment.assignment_type as string)} · Target:{" "}
                  {assignmentTargetLabel(detail.assignment as CoachAssignmentSummary)}
                </p>
                <DueDateBadge dueDate={(detail.assignment.due_date as string | null) ?? null} />
                <p className="font-medium text-[#0F172A]">Linked items</p>
                <ul className="list-inside list-disc text-xs">
                  {(detail.items as { item_type: string; item_id: string }[]).map((it, i) => (
                    <li key={i}>
                      {it.item_type} · {it.item_id.slice(0, 8)}…
                    </li>
                  ))}
                </ul>
                {detail.quiz && (
                  <p className="text-xs">Quiz questions: {(detail.quiz.questions as unknown[]).length}</p>
                )}
              </div>
            )}
            {sub === "results" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[#64748B]">
                      <th className="py-2 pr-2">Player</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2">Review</th>
                      <th className="py-2 pr-2">Quiz</th>
                      <th className="py-2">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(players as Record<string, unknown>[]).map((row) => {
                      const pl = row.players as { first_name?: string; last_name?: string; position_group?: string } | undefined
                      const displayName: string = pl
                        ? `${pl.first_name ?? ""} ${pl.last_name ?? ""}`.trim() || String(row.player_id ?? "")
                        : String(row.player_id ?? "")
                      return (
                        <tr key={String(row.player_id)} className="border-b border-[#F1F5F9]">
                          <td className="py-2 pr-2 text-[#0F172A]">
                            {displayName}
                            {pl?.position_group ? (
                              <span className="block text-[#94A3B8]">{String(pl.position_group)}</span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-2">{String(row.status)}</td>
                          <td className="py-2 pr-2">{row.review_completed_at ? "Done" : "—"}</td>
                          <td className="py-2 pr-2">{row.quiz_submitted_at ? "Submitted" : "—"}</td>
                          <td className="py-2">{row.score_percent != null ? `${row.score_percent}%` : "—"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {players.length === 0 && <p className="text-xs text-[#64748B]">No roster rows for this assignment.</p>}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
