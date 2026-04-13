"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PortalUnderlineTabs } from "@/components/portal/portal-underline-tabs"
import {
  assignmentTypeLabel,
  DueDateBadge,
  StudyGuideDetailPaneSkeleton,
  StudyGuidePlayerListSkeleton,
} from "./study-guides-shared"

type MyListRow = {
  id: string
  title: string
  due_date: string | null
  assignment_type?: string
  myStatus?: string
  displayStatus?: string
  score_percent?: number | null
}

type ItemRow = {
  item_type: string
  item_id: string
  label: string
  href: string | null
}

type QuizQuestion = {
  id: string
  question_type: string
  question_text: string
  options: unknown
}

export function StudyGuidesPlayerView({ teamId }: { teamId: string }) {
  const [tab, setTab] = useState<"active" | "archive">("active")
  const [activeList, setActiveList] = useState<MyListRow[]>([])
  const [archiveList, setArchiveList] = useState<MyListRow[]>([])
  const [archiveNext, setArchiveNext] = useState<number | null>(null)
  const [activeLoading, setActiveLoading] = useState(true)
  const [activeHydrated, setActiveHydrated] = useState(false)
  const [loadingArchive, setLoadingArchive] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailReload, setDetailReload] = useState(0)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<{
    assignment: {
      id: string
      title: string
      due_date: string | null
      assignment_type: string
      review_player_summary?: string | null
    }
    myProgress: Record<string, unknown>
    items: ItemRow[]
    quiz: Record<string, unknown> | null
  } | null>(null)

  const baseMy = `/api/teams/${encodeURIComponent(teamId)}/study/my`

  const loadActive = useCallback(async () => {
    const res = await fetch(`${baseMy}?scope=active`, { credentials: "same-origin" })
    const data = res.ok ? await res.json() : { assignments: [] }
    setActiveList(data.assignments ?? [])
  }, [baseMy])

  const loadArchivePage = useCallback(
    async (offset: number, append: boolean) => {
      setLoadingArchive(true)
      try {
        const res = await fetch(`${baseMy}?scope=archive&limit=15&offset=${offset}`, { credentials: "same-origin" })
        const data = res.ok ? await res.json() : { assignments: [], nextOffset: null }
        const chunk = data.assignments ?? []
        setArchiveList((prev) => (append ? [...prev, ...chunk] : chunk))
        setArchiveNext(typeof data.nextOffset === "number" ? data.nextOffset : null)
      } finally {
        setLoadingArchive(false)
      }
    },
    [baseMy]
  )

  useEffect(() => {
    setActiveHydrated(false)
    setActiveList([])
    setArchiveList([])
    setArchiveNext(null)
  }, [teamId])

  useEffect(() => {
    if (tab !== "active") return
    if (activeHydrated) return
    let cancelled = false
    setActiveLoading(true)
    loadActive()
      .then(() => {
        if (!cancelled) setActiveHydrated(true)
      })
      .finally(() => {
        if (!cancelled) setActiveLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, activeHydrated, loadActive])

  useEffect(() => {
    if (tab !== "archive") return
    if (archiveList.length > 0) return
    void loadArchivePage(0, false)
  }, [tab, archiveList.length, loadArchivePage])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    fetch(`/api/teams/${encodeURIComponent(teamId)}/study/my/${encodeURIComponent(detailId)}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailId, detailReload, teamId])

  useEffect(() => {
    if (!detailId) return
    const tick = window.setInterval(() => {
      void fetch(`/api/teams/${encodeURIComponent(teamId)}/study/my/${encodeURIComponent(detailId)}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ dwellDeltaSec: 20 }),
      })
    }, 20000)
    return () => window.clearInterval(tick)
  }, [detailId, teamId])

  const reportMaterialOpen = () => {
    if (!detailId) return
    void fetch(`/api/teams/${encodeURIComponent(teamId)}/study/my/${encodeURIComponent(detailId)}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ materialLinkOpened: true, dwellDeltaSec: 0 }),
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-8 md:px-0">
      <h1 className="text-2xl font-bold text-[#0F172A]">Study guides</h1>
      <p className="text-sm text-[#64748B]">Review program material and complete quizzes your coaches assign.</p>

      <PortalUnderlineTabs
        tabs={[
          { id: "active", label: "Active" },
          { id: "archive", label: "History" },
        ]}
        value={tab}
        onValueChange={(id) => setTab(id as "active" | "archive")}
        ariaLabel="Study assignments"
      />

      <div className="min-h-[200px] space-y-3">
        {tab === "active" && activeLoading && <StudyGuidePlayerListSkeleton />}
        {tab === "active" && !activeLoading && activeList.length === 0 && (
          <p className="text-sm text-[#64748B]">No active assignments.</p>
        )}
        {tab === "active" &&
          !activeLoading &&
          activeList.map((a) => (
            <Card key={a.id} className="border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setDetailId(a.id)}
                  >
                    <p className="font-semibold text-[#0F172A]">{a.title}</p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {assignmentTypeLabel(a.assignment_type)} · {a.displayStatus ?? a.myStatus ?? "—"}
                      {typeof a.score_percent === "number" ? ` · Score ${a.score_percent}%` : ""}
                    </p>
                  </button>
                  <DueDateBadge dueDate={a.due_date} />
                </div>
              </CardContent>
            </Card>
          ))}

        {tab === "archive" && loadingArchive && archiveList.length === 0 && <StudyGuidePlayerListSkeleton count={3} />}
        {tab === "archive" && !loadingArchive && archiveList.length === 0 && (
          <p className="text-sm text-[#64748B]">No completed assignments yet.</p>
        )}
        {tab === "archive" &&
          archiveList.map((a) => (
            <Card key={a.id} className="border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setDetailId(a.id)}
                  >
                    <p className="font-semibold text-[#0F172A]">{a.title}</p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {assignmentTypeLabel(a.assignment_type)} · {a.displayStatus ?? a.myStatus ?? "—"}
                      {typeof a.score_percent === "number" ? ` · Score ${a.score_percent}%` : ""}
                    </p>
                  </button>
                  <DueDateBadge dueDate={a.due_date} />
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {tab === "archive" && archiveNext !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg"
          disabled={loadingArchive}
          onClick={() => void loadArchivePage(archiveNext, true)}
        >
          {loadingArchive ? "Loading…" : "Load more"}
        </Button>
      )}

      <PlayerAssignmentDetailDialog
        open={Boolean(detailId)}
        loading={detailLoading}
        data={detail}
        teamId={teamId}
        onClose={() => setDetailId(null)}
        onMaterialNavigate={reportMaterialOpen}
        onSubmitted={() => {
          void loadActive()
          if (tab === "archive") void loadArchivePage(0, false)
          setDetailReload((x) => x + 1)
        }}
      />
    </div>
  )
}

function PlayerAssignmentDetailDialog({
  open,
  loading,
  data,
  teamId,
  onClose,
  onMaterialNavigate,
  onSubmitted,
}: {
  open: boolean
  loading: boolean
  data: {
    assignment: {
      id: string
      title: string
      due_date: string | null
      assignment_type: string
      review_player_summary?: string | null
    }
    myProgress: Record<string, unknown>
    items: ItemRow[]
    quiz: Record<string, unknown> | null
  } | null
  teamId: string
  onClose: () => void
  onMaterialNavigate: () => void
  onSubmitted: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, number | [number, number][]>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setAnswers({})
  }, [open, data?.assignment?.id])

  const questions = useMemo(() => {
    const q = data?.quiz
    if (!q || q.status !== "pending") return [] as QuizQuestion[]
    return (q.questions as QuizQuestion[]) ?? []
  }, [data?.quiz])

  const submitQuiz = async () => {
    if (!data?.assignment?.id) return
    const payload = questions.map((q) => {
      const v = answers[q.id]
      if (q.question_type === "matching") {
        return { questionId: q.id, pairs: Array.isArray(v) ? v : [] }
      }
      return { questionId: q.id, selectedIndex: typeof v === "number" ? v : -1 }
    })
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const p = payload[i]
      if (q.question_type === "matching") {
        const opts = q.options as { left?: string[] }
        const n = Array.isArray(opts?.left) ? opts.left.length : 0
        if (!("pairs" in p) || !Array.isArray(p.pairs) || p.pairs.length !== n) {
          alert("Complete all matching rows.")
          return
        }
      } else if (
        !("selectedIndex" in p) ||
        typeof (p as { selectedIndex?: unknown }).selectedIndex !== "number" ||
        (p as { selectedIndex: number }).selectedIndex < 0
      ) {
        alert("Answer every question before submitting.")
        return
      }
    }
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/teams/${encodeURIComponent(teamId)}/study/my/${encodeURIComponent(data.assignment.id)}/quiz`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ answers: payload }),
        }
      )
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert((e as { error?: string }).error ?? "Submit failed")
        return
      }
      onSubmitted()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[min(92vh,800px)] overflow-y-auto bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{data?.assignment.title ?? "Assignment"}</DialogTitle>
        </DialogHeader>
        {loading || !data ? (
          <StudyGuideDetailPaneSkeleton />
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-[#64748B]">
              <DueDateBadge dueDate={data.assignment.due_date} />
              <span className="text-xs">
                Status: {(data.myProgress.displayStatus as string) ?? "—"}
              </span>
            </div>

            {(data.assignment.assignment_type === "review" || data.assignment.assignment_type === "mixed") &&
              data.assignment.review_player_summary?.trim() && (
                <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-[#334155]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Coach summary</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#0F172A]">
                    {data.assignment.review_player_summary.trim()}
                  </p>
                </div>
              )}

            {(data.assignment.assignment_type === "review" || data.assignment.assignment_type === "mixed") && (
              <div>
                <p className="font-medium text-[#0F172A]">Review material</p>
                <ul className="mt-2 space-y-2">
                  {data.items.map((it) => (
                    <li key={`${it.item_type}-${it.item_id}`}>
                      {it.href ? (
                        <Link
                          href={it.href}
                          className="font-medium text-[#2563EB] underline-offset-2 hover:underline"
                          onClick={() => onMaterialNavigate()}
                        >
                          {it.label}
                        </Link>
                      ) : (
                        <span className="text-[#64748B]">{it.label}</span>
                      )}
                      <span className="ml-1.5 text-xs text-[#94A3B8]">({it.item_type})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.quiz && data.quiz.status === "submitted" && (
              <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-[#0F172A]">
                <p className="font-medium">Quiz submitted</p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Score: {String(data.quiz.scorePercent ?? "—")}% · Submitted {data.quiz.takenAt ? new Date(String(data.quiz.takenAt)).toLocaleString() : ""}
                </p>
              </div>
            )}

            {data.quiz && data.quiz.status === "pending" && questions.length > 0 && (
              <div className="space-y-4">
                <p className="font-medium text-[#0F172A]">Quiz</p>
                {questions.map((q, idx) => (
                  <div key={q.id} className="rounded-md border border-[#E5E7EB] p-3">
                    <p className="text-sm font-medium text-[#0F172A]">
                      {idx + 1}. {q.question_text}
                    </p>
                    {q.question_type === "multiple_choice" || q.question_type === "true_false" ? (
                      <div className="mt-2 space-y-1.5">
                        {(Array.isArray(q.options) ? q.options : []).map((opt: string, i: number) => (
                          <label key={i} className="flex cursor-pointer items-center gap-2 text-[#334155]">
                            <input
                              type="radio"
                              name={q.id}
                              checked={answers[q.id] === i}
                              onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : q.question_type === "matching" ? (
                      <MatchingBlock
                        q={q}
                        value={(answers[q.id] as [number, number][] | undefined) ?? []}
                        onChange={(pairs) => setAnswers((prev) => ({ ...prev, [q.id]: pairs }))}
                      />
                    ) : null}
                  </div>
                ))}
                <Button type="button" size="sm" className="rounded-lg" disabled={submitting} onClick={() => void submitQuiz()}>
                  {submitting ? "Submitting…" : "Submit quiz"}
                </Button>
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

function MatchingBlock({
  q,
  value,
  onChange,
}: {
  q: QuizQuestion
  value: [number, number][]
  onChange: (pairs: [number, number][]) => void
}) {
  const opts = q.options as { left?: string[]; right?: string[] }
  const left = Array.isArray(opts?.left) ? opts.left : []
  const right = Array.isArray(opts?.right) ? opts.right : []
  const pickForLeft = (leftIdx: number, rightIdx: number) => {
    const next = value.filter((p) => p[0] !== leftIdx)
    next.push([leftIdx, rightIdx])
    onChange(next)
  }
  return (
    <div className="mt-2 space-y-2">
      {left.map((label, li) => {
        const cur = value.find((p) => p[0] === li)?.[1]
        return (
          <div key={li} className="flex flex-wrap items-center gap-2">
            <span className="min-w-[100px] text-[#334155]">{label}</span>
            <select
              className="h-9 rounded-md border border-[#E5E7EB] px-2 text-sm"
              value={cur === undefined ? "" : String(cur)}
              onChange={(e) => pickForLeft(li, parseInt(e.target.value, 10))}
            >
              <option value="">Select…</option>
              {right.map((r, ri) => (
                <option key={ri} value={ri}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}
