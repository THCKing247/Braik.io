"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import type { DraftStudyQuestion } from "@/lib/study-coach-b-quiz"
import type { StudyQuestionType } from "@/lib/study-quiz-utils"
import { validateDraftQuestionsForSave } from "@/lib/study-validate-questions"

const inputClass =
  "mt-1 flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB]/25"
const selectClass =
  "mt-1 flex h-10 w-full cursor-pointer rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB]/25 [&>option]:bg-white [&>option]:text-[#0F172A]"
const textareaClass =
  "mt-1 w-full min-h-[88px] rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB]/25"

type SourceRow = { itemType: string; itemId: string; label: string }
type RosterPlayer = { id: string; firstName: string; lastName: string; positionGroup: string | null }
type CatalogItem = { id: string; name?: string; title?: string; side?: string; playbook_id?: string | null }

type GeneratedBundle = {
  title: string
  summary: string | null
  keyPoints: string[]
  questions: DraftStudyQuestion[]
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{children}</p>
}

function extractJsonObject(text: string): unknown | null {
  const t = text.trim()
  const start = t.indexOf("{")
  const end = t.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(t.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

function normalizeQuestions(raw: unknown, max: number): DraftStudyQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: DraftStudyQuestion[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const questionText = typeof r.questionText === "string" ? r.questionText.trim() : ""
    const questionType = r.questionType as string
    if (!questionText) continue
    if (questionType !== "multiple_choice" && questionType !== "true_false" && questionType !== "matching") continue
    const options = r.options
    let correctIndex: number | null =
      typeof r.correctIndex === "number" && Number.isInteger(r.correctIndex) ? r.correctIndex : null
    let answerKey: { pairs: [number, number][] } | null = null
    if (r.answerKey && typeof r.answerKey === "object" && Array.isArray((r.answerKey as { pairs?: unknown }).pairs)) {
      const pairs = (r.answerKey as { pairs: unknown[] }).pairs
        .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number")
        .map((p) => [p[0], p[1]] as [number, number])
      if (pairs.length) answerKey = { pairs }
    }
    if (questionType === "matching" && (!answerKey || !options || typeof options !== "object")) continue
    if ((questionType === "multiple_choice" || questionType === "true_false") && (correctIndex === null || correctIndex < 0)) continue
    out.push({
      questionText,
      questionType: questionType as StudyQuestionType,
      options,
      correctIndex,
      answerKey,
    })
    if (out.length >= max) break
  }
  return out
}

function parseCoachBundle(raw: unknown, assignmentType: "review" | "quiz" | "mixed", maxQuestions: number): GeneratedBundle | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const title = typeof o.title === "string" ? o.title.trim() : ""
  const summary = typeof o.summary === "string" ? o.summary.trim() : null
  const keyPoints = Array.isArray(o.keyPoints) ? o.keyPoints.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean) : []
  const questions = normalizeQuestions(o.questions, maxQuestions)
  if (!title) return null
  if (assignmentType === "review" && !summary?.trim() && keyPoints.length === 0) return null
  if (assignmentType === "quiz" && questions.length === 0) return null
  if (assignmentType === "mixed" && (!summary?.trim() || questions.length === 0)) return null
  return { title, summary: summary || null, keyPoints, questions }
}

function buildReviewSummaryForSave(summary: string | null, keyPoints: string[]): string | null {
  const parts: string[] = []
  if (summary?.trim()) parts.push(summary.trim())
  if (keyPoints.length) parts.push("Key points:\n" + keyPoints.map((k) => `• ${k}`).join("\n"))
  const t = parts.join("\n\n").trim()
  if (!t) return null
  return t.length > 12000 ? t.slice(0, 12000) + "\n…" : t
}

function buildCoachMessage(params: {
  assignmentType: "review" | "quiz" | "mixed"
  sources: SourceRow[]
  questionCount: number
  emphasis: "general" | "position"
}): string {
  const src = params.sources.map((s) => `- ${s.itemType}: ${s.label}`).join("\n")
  const emph =
    params.emphasis === "position"
      ? "Emphasize position-specific responsibilities and reads tied to the sources."
      : "Emphasize clear general understanding for the whole unit."

  const qRules = `Each question: questionText, questionType ("multiple_choice"|"true_false"|"matching"), options (array of strings for MC/TF; for matching use {"left":["..."],"right":["..."]} same length), correctIndex (0-based for MC/TF), answerKey for matching only as {"pairs":[[leftIdx,rightIdx],...]} covering each left index once.`

  if (params.assignmentType === "review") {
    return `You are Coach B. Output ONLY one JSON object, no markdown fences.

Sources:\n${src}

${emph}

Return JSON shape exactly:
{"title":"string","summary":"string (2-5 short paragraphs, player-facing)","keyPoints":["string", ... at least 3]}

Ground every sentence in the named sources. No generic football lecture.`
  }

  if (params.assignmentType === "quiz") {
    return `You are Coach B. Output ONLY one JSON object, no markdown fences.

Sources:\n${src}

${emph}

Create exactly ${params.questionCount} questions grounded in those sources. ${qRules}

Return JSON shape:
{"title":"string","questions":[ ... ]}`
  }

  return `You are Coach B. Output ONLY one JSON object, no markdown fences.

Sources:\n${src}

${emph}

Create:
- "summary": player-facing review (2-4 short paragraphs)
- "keyPoints": array of at least 3 bullets
- "questions": exactly ${params.questionCount} objective questions grounded in the sources
${qRules}

Return JSON shape:
{"title":"string","summary":"string","keyPoints":["..."],"questions":[ ... ]}`
}

export function CreateAssignmentDialog({
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
  const [title, setTitle] = useState("")
  const [assignmentType, setAssignmentType] = useState<"review" | "quiz" | "mixed">("mixed")
  const [due, setDue] = useState("")
  const [target, setTarget] = useState<"team" | "side" | "position_group" | "players">("team")
  const [pos, setPos] = useState("")
  const [side, setSide] = useState<"offense" | "defense" | "special_teams">("offense")
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)

  const [sourceKind, setSourceKind] = useState<"playbook" | "formation" | "play" | "install_script" | "study_pack">("playbook")
  const [sourceItems, setSourceItems] = useState<CatalogItem[]>([])
  const [sourceItemsLoading, setSourceItemsLoading] = useState(false)
  const [sourceItemId, setSourceItemId] = useState("")
  const [sources, setSources] = useState<SourceRow[]>([])

  const [questionCount, setQuestionCount] = useState<5 | 10 | 15>(10)
  const [emphasis, setEmphasis] = useState<"general" | "position">("general")

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<GeneratedBundle | null>(null)
  const [questions, setQuestions] = useState<DraftStudyQuestion[]>([])
  const [showManual, setShowManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishAsDraft, setPublishAsDraft] = useState(false)

  const reset = useCallback(() => {
    setTitle("")
    setAssignmentType("mixed")
    setDue("")
    setTarget("team")
    setPos("")
    setSide("offense")
    setSelectedPlayers([])
    setSourceKind("playbook")
    setSourceItems([])
    setSourceItemId("")
    setSources([])
    setQuestionCount(10)
    setEmphasis("general")
    setGenerating(false)
    setGenError(null)
    setGenerated(null)
    setQuestions([])
    setShowManual(false)
    setSaving(false)
    setPublishAsDraft(false)
  }, [])

  useEffect(() => {
    if (!open) return
    reset()
  }, [open, teamId, reset])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRosterLoading(true)
    fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}&lite=1`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : []))
      .then((ros) => {
        if (cancelled) return
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
      .finally(() => {
        if (!cancelled) setRosterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, teamId])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSourceItemsLoading(true)
    setSourceItemId("")
    fetch(`/api/teams/${encodeURIComponent(teamId)}/study/catalog?kind=${encodeURIComponent(sourceKind)}`, {
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (cancelled) return
        setSourceItems(Array.isArray(d.items) ? d.items : [])
      })
      .finally(() => {
        if (!cancelled) setSourceItemsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, teamId, sourceKind])

  const labelForItem = (it: CatalogItem): string => {
    if (sourceKind === "study_pack") return it.title ?? it.id
    const n = it.name ?? ""
    if (sourceKind === "formation" && it.side) return `${n} (${it.side})`
    return n || it.id
  }

  const addSource = () => {
    if (!sourceItemId) return
    const row = sourceItems.find((x) => x.id === sourceItemId)
    const label = row ? labelForItem(row) : sourceItemId
    if (sources.some((s) => s.itemType === sourceKind && s.itemId === sourceItemId)) return
    setSources((prev) => [...prev, { itemType: sourceKind, itemId: sourceItemId, label }])
  }

  const removeSource = (itemType: string, itemId: string) => {
    setSources((prev) => prev.filter((s) => !(s.itemType === itemType && s.itemId === itemId)))
  }

  const removeQuestionAt = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx))
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
    if (!sources.length) {
      setGenError("Add at least one program source.")
      return
    }
    setGenError(null)
    setGenerating(true)
    setGenerated(null)
    try {
      const message = buildCoachMessage({
        assignmentType,
        sources,
        questionCount: assignmentType === "review" ? 0 : questionCount,
        emphasis,
      })
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          teamId,
          message,
          conversationHistory: [],
          enableActionTools: false,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        setGenError(typeof data.error === "string" ? data.error : "Coach B request failed.")
        return
      }
      const text =
        typeof data.response === "string"
          ? data.response
          : typeof data.message === "string"
            ? data.message
            : ""
      if (!text.trim()) {
        setGenError("Coach B returned an empty response.")
        return
      }
      const parsed = extractJsonObject(text)
      const bundle = parseCoachBundle(parsed, assignmentType, questionCount)
      if (!bundle) {
        setGenError("Could not parse Coach B output. Try Regenerate, or use manual build below.")
        return
      }
      setGenerated(bundle)
      setTitle((t) => (t.trim() ? t : bundle.title))
      setQuestions(bundle.questions)
      setShowManual(false)
    } catch {
      setGenError("Network error. Try again.")
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    const t = title.trim()
    if (!t) {
      setGenError("Title is required before publishing.")
      return
    }
    if (!sources.length) {
      setGenError("Add at least one program source.")
      return
    }
    const needsQuiz = assignmentType === "quiz" || assignmentType === "mixed"
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

    if (needsQuiz && cleanedQs.length === 0) {
      setGenError("Add or generate quiz questions before publishing.")
      return
    }
    const qErr = needsQuiz && cleanedQs.length ? validateDraftQuestionsForSave(cleanedQs) : null
    if (qErr) {
      setGenError(qErr)
      return
    }

    let reviewPlayerSummary: string | null = null
    if (assignmentType === "review" || assignmentType === "mixed") {
      reviewPlayerSummary = buildReviewSummaryForSave(generated?.summary ?? null, generated?.keyPoints ?? [])
    }

    setSaving(true)
    setGenError(null)
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/study/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: t,
          dueDate: due || null,
          assignedToType: target,
          assignedPositionGroup: target === "position_group" ? pos : null,
          assignedSide: target === "side" ? side : null,
          playerIds: target === "players" ? selectedPlayers : undefined,
          assignmentType,
          publishStatus: publishAsDraft ? "draft" : "published",
          items: sources.map((s) => ({ itemType: s.itemType, itemId: s.itemId })),
          questions: assignmentType === "review" ? [] : cleanedQs,
          reviewPlayerSummary,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setGenError((e as { error?: string }).error ?? "Save failed")
        return
      }
      await onCreated()
    } finally {
      setSaving(false)
    }
  }

  const hasPreview = Boolean(generated)
  const showAutoSection = sources.length > 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden bg-white p-0 sm:max-w-2xl">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-4 pt-6">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#0F172A]">New assignment</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 text-sm">
            <section className="space-y-3">
              <SectionLabel>Basics</SectionLabel>
              <div>
                <Label className="text-[#334155]">Title</Label>
                <Input
                  className={inputClass}
                  placeholder="Assignment title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[#334155]">Type</Label>
                <select
                  className={selectClass}
                  value={assignmentType}
                  onChange={(e) => {
                    const v = e.target.value as typeof assignmentType
                    setAssignmentType(v)
                    setGenerated(null)
                    setGenError(null)
                  }}
                >
                  <option value="review">Review</option>
                  <option value="quiz">Quiz</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <Label className="text-[#334155]">Due date (optional)</Label>
                <Input className={inputClass} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
              <div>
                <Label className="text-[#334155]">Assign to</Label>
                <select className={selectClass} value={target} onChange={(e) => setTarget(e.target.value as typeof target)}>
                  <option value="team">Entire team</option>
                  <option value="side">Side of ball</option>
                  <option value="position_group">Position group</option>
                  <option value="players">Selected players</option>
                </select>
              </div>
              {target === "side" && (
                <div>
                  <Label className="text-[#334155]">Side</Label>
                  <select className={selectClass} value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
                    <option value="offense">Offense</option>
                    <option value="defense">Defense</option>
                    <option value="special_teams">Special teams</option>
                  </select>
                </div>
              )}
              {target === "position_group" && (
                <div>
                  <Label className="text-[#334155]">Position group</Label>
                  <Input
                    className={inputClass}
                    placeholder="e.g. OL"
                    value={pos}
                    onChange={(e) => setPos(e.target.value)}
                  />
                </div>
              )}
              {target === "players" && (
                <div>
                  <Label className="text-[#334155]">Players</Label>
                  <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-[#E5E7EB] bg-white p-2 text-xs text-[#0F172A]">
                    {rosterLoading ? (
                      <p className="py-2 text-[#64748B]">Loading roster…</p>
                    ) : (
                      roster.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            className="rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
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
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <SectionLabel>Source material</SectionLabel>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-[140px] flex-1">
                  <Label className="text-[#334155]">Source type</Label>
                  <select
                    className={selectClass}
                    value={sourceKind}
                    onChange={(e) => setSourceKind(e.target.value as typeof sourceKind)}
                  >
                    <option value="playbook">Playbook</option>
                    <option value="formation">Formation</option>
                    <option value="play">Play</option>
                    <option value="install_script">Install script</option>
                    <option value="study_pack">Study pack</option>
                  </select>
                </div>
                <div className="min-w-0 flex-[2]">
                  <Label className="text-[#334155]">Source item</Label>
                  <select
                    className={selectClass}
                    value={sourceItemId}
                    onChange={(e) => setSourceItemId(e.target.value)}
                    disabled={sourceItemsLoading}
                  >
                    <option value="">{sourceItemsLoading ? "Loading…" : "Select…"}</option>
                    {sourceItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {labelForItem(it)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-lg" onClick={addSource}>
                  Add source
                </Button>
              </div>
              {sources.length > 0 && (
                <div className="space-y-2">
                  {sources.map((s) => (
                    <Card key={`${s.itemType}-${s.itemId}`} className="border-[#E5E7EB] bg-[#F8FAFC]">
                      <CardContent className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{s.itemType}</p>
                          <p className="truncate font-medium text-[#0F172A]">{s.label}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-red-600 hover:text-red-700"
                          onClick={() => removeSource(s.itemType, s.itemId)}
                        >
                          Remove
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {showAutoSection && (
              <section className="space-y-3 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4">
                <SectionLabel>Auto build</SectionLabel>
                <p className="text-xs leading-relaxed text-[#64748B]">
                  Coach B will draft this assignment from your sources when you run generate. Nothing is saved until you publish.
                </p>
                {(assignmentType === "quiz" || assignmentType === "mixed") && (
                  <>
                    <div>
                      <Label className="text-[#334155]">Question count</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {([5, 10, 15] as const).map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              questionCount === n
                                ? "border-[#0B2A5B] bg-[#0B2A5B] text-white"
                                : "border-[#E5E7EB] bg-white text-[#334155] hover:border-[#CBD5E1]"
                            }`}
                            onClick={() => setQuestionCount(n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-[#334155]">Emphasis</Label>
                      <select
                        className={selectClass}
                        value={emphasis}
                        onChange={(e) => setEmphasis(e.target.value as typeof emphasis)}
                      >
                        <option value="general">General</option>
                        <option value="position">Position-specific</option>
                      </select>
                    </div>
                  </>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg border-[#2563EB] text-[#1D4ED8] hover:bg-[#EFF6FF]"
                  disabled={generating}
                  onClick={() => void runGenerate()}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : hasPreview ? (
                    "Regenerate"
                  ) : (
                    "Generate & review"
                  )}
                </Button>
              </section>
            )}

            {genError && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="alert">
                {genError}
              </p>
            )}

            {hasPreview && (
              <section className="space-y-3">
                <SectionLabel>Generated preview</SectionLabel>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-[#64748B]">Title</p>
                  <p className="text-base font-semibold text-[#0F172A]">{generated?.title}</p>
                  {(assignmentType === "review" || assignmentType === "mixed") && generated?.summary && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-[#64748B]">Review summary</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#334155]">{generated.summary}</p>
                    </div>
                  )}
                  {(assignmentType === "review" || assignmentType === "mixed") && (generated?.keyPoints?.length ?? 0) > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-[#64748B]">Key points</p>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#334155]">
                        {generated?.keyPoints.map((k, i) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(assignmentType === "quiz" || assignmentType === "mixed") && questions.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-medium text-[#64748B]">Quiz</p>
                      <ol className="list-decimal space-y-3 pl-4 text-sm text-[#334155]">
                        {questions.map((q, idx) => (
                          <li key={idx} className="rounded-md border border-[#F1F5F9] bg-[#F8FAFC] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <span>
                                <span className="font-medium text-[#0F172A]">{q.questionText}</span>
                                <span className="ml-2 text-xs text-[#94A3B8]">({q.questionType})</span>
                              </span>
                              <button
                                type="button"
                                className="shrink-0 text-xs text-red-600 hover:underline"
                                onClick={() => removeQuestionAt(idx)}
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-[#2563EB] hover:underline"
                    onClick={() => setShowManual((v) => !v)}
                  >
                    {showManual ? "Hide manual editor" : "Edit manually"}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-[#64748B] hover:text-[#0F172A] hover:underline"
                    onClick={() => {
                      setGenerated(null)
                      setGenError(null)
                      setShowManual(true)
                    }}
                  >
                    Build manually instead
                  </button>
                </div>
              </section>
            )}

            {(showManual || (!hasPreview && assignmentType !== "review")) && (assignmentType === "quiz" || assignmentType === "mixed") && (
              <section className="space-y-3">
                <SectionLabel>Manual edit</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={addMc}>
                    Add multiple choice
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={addTf}>
                    Add true/false
                  </Button>
                </div>
                {questions.map((q, qi) => (
                  <div key={qi} className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                    <Input
                      className={inputClass}
                      placeholder="Question text"
                      value={q.questionText}
                      onChange={(e) => {
                        const v = e.target.value
                        setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, questionText: v } : x)))
                      }}
                    />
                    {q.questionType === "multiple_choice" && (
                      <div className="mt-2 space-y-2">
                        {(q.options as string[]).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <Input
                              className={inputClass}
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
                            <label className="flex shrink-0 items-center gap-1 text-xs text-[#334155]">
                              <input
                                type="radio"
                                className="border-[#CBD5E1] text-[#2563EB]"
                                name={`mc-${qi}`}
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
                      <div className="mt-2 flex gap-4 text-xs text-[#334155]">
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            className="border-[#CBD5E1] text-[#2563EB]"
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
                            className="border-[#CBD5E1] text-[#2563EB]"
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
                      <p className="mt-2 text-xs text-[#64748B]">Matching question — preview only; edit via regenerate or manual JSON flow if needed.</p>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 text-xs text-red-600"
                      onClick={() => removeQuestionAt(qi)}
                    >
                      Remove question
                    </Button>
                  </div>
                ))}
              </section>
            )}

            <label className="flex items-center gap-2 text-xs text-[#64748B]">
              <input
                type="checkbox"
                className="rounded border-[#CBD5E1] text-[#2563EB]"
                checked={publishAsDraft}
                onChange={(e) => setPublishAsDraft(e.target.checked)}
              />
              Save as draft (players won&apos;t see until published)
            </label>
          </div>
        </div>

        <DialogFooter className="flex shrink-0 flex-col gap-2 border-t border-[#E5E7EB] bg-[#FAFAFA] px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full rounded-lg sm:w-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full rounded-lg bg-[#0B2A5B] text-white hover:bg-[#092456] sm:w-auto"
            disabled={saving || !sources.length}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : publishAsDraft ? "Save draft" : "Publish assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
