"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import { PortalStandardPageHeader, PortalStandardPageRoot } from "@/components/portal/portal-standard-page"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BarChart3, Plus, TrendingUp } from "lucide-react"
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
import { CreateAssignmentDialog } from "./study-guides-create-assignment-dialog"

type CoachTab = "assignments" | "library" | "mastery" | "progress"

const COACH_TABS: { id: CoachTab; label: string }[] = [
  { id: "assignments", label: "Assignments" },
  { id: "library", label: "Library" },
  { id: "mastery", label: "Mastery" },
  { id: "progress", label: "Progress" },
]

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
    <PortalStandardPageRoot>
      <PortalStandardPageHeader
        title="Study guides"
        description="Program-linked assignments, quizzes, and accountability."
        actions={
          tab === "assignments" ? (
            <Button type="button" size="sm" className="rounded-lg" onClick={() => setBuilderOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              New assignment
            </Button>
          ) : null
        }
      />

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

      <CreateAssignmentDialog
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
    </PortalStandardPageRoot>
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
