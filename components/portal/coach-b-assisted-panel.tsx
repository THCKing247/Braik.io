"use client"

import { useState, useCallback } from "react"
import { Sparkles, Loader2, FilePlus, Copy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import type { PlaySuggestion } from "@/lib/types/coach-b"

export interface CoachBAssistedPanelProps {
  teamId: string
  playbookId: string
  formationId?: string | null
  subFormationId?: string | null
  /** Called when coach clicks Generate Draft. Parent creates play (e.g. via route engine + POST /api/plays) and navigates to editor. */
  onCreateDraft: (suggestion: PlaySuggestion) => Promise<void>
  /** When false, panel is read-only or hidden. */
  canEdit?: boolean
  className?: string
}

export function CoachBAssistedPanel({
  teamId,
  playbookId,
  formationId,
  subFormationId,
  onCreateDraft,
  canEdit = true,
  className = "",
}: CoachBAssistedPanelProps) {
  const { showToast } = usePlaybookToast()
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<PlaySuggestion[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const handleAsk = useCallback(async () => {
    const text = prompt.trim()
    if (!text || loading) return
    setLoading(true)
    setSuggestions([])
    setDismissedIds(new Set())
    try {
      const res = await fetch("/api/coach-b/suggest-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          playbookId,
          formationId: formationId ?? undefined,
          subFormationId: subFormationId ?? undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions ?? [])
        if (!data.suggestions?.length) {
          showToast("No suggestions for that prompt. Try being more specific.", "success")
        }
      } else {
        showToast("Could not get suggestions", "error")
      }
    } catch {
      showToast("Could not get suggestions", "error")
    } finally {
      setLoading(false)
    }
  }, [prompt, loading, playbookId, formationId, subFormationId, showToast])

  const handleGenerateDraft = useCallback(
    async (suggestion: PlaySuggestion) => {
      if (!canEdit || generatingId) return
      const id = suggestion.playName + String(suggestions.indexOf(suggestion))
      setGeneratingId(id)
      try {
        await onCreateDraft(suggestion)
        showToast("Draft play created", "success")
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Could not create draft play", "error")
      } finally {
        setGeneratingId(null)
      }
    },
    [canEdit, generatingId, onCreateDraft, showToast, suggestions]
  )

  const handleCopy = useCallback(
    (suggestion: PlaySuggestion) => {
      const conceptLine =
        "Concept: " +
        suggestion.conceptType +
        (suggestion.concept ? " (" + suggestion.concept + ")" : "")
      const parts = [
        suggestion.playName,
        conceptLine,
        ...suggestion.routesByRole.map((r) => "  " + r.role + ": " + r.route),
        suggestion.rationale,
      ]
      if (suggestion.tags?.length) parts.push("Tags: " + suggestion.tags.join(", "))
      void navigator.clipboard.writeText(parts.join("\n"))
      showToast("Copied to clipboard", "success")
    },
    [showToast]
  )

  const handleDismiss = useCallback((index: number) => {
    setDismissedIds((prev) => new Set(prev).add("s-" + index))
  }, [])

  const visibleSuggestions = suggestions.filter((_, i) => !dismissedIds.has("s-" + i))

  return (
    <div
      className={
        "rounded-xl border border-slate-200 bg-white overflow-hidden " + (className ?? "")
      }
    >
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-slate-900">Coach B</h3>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Request a play idea in natural language. Try: &quot;Need a 3rd and 6 pass from Trips Right&quot; or &quot;Red zone concept from Bunch&quot;
        </p>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Describe the situation or concept..."
            className="flex-1 min-w-0 rounded-md border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            disabled={loading || !canEdit}
          />
          <Button size="sm" onClick={handleAsk} disabled={loading || !prompt.trim() || !canEdit} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
          </Button>
        </div>

        {visibleSuggestions.length > 0 && (
          <div className="space-y-2">
            {visibleSuggestions.map((suggestion, idx) => {
              const originalIndex = suggestions.indexOf(suggestion)
              const id = suggestion.playName + String(originalIndex)
              const generating = generatingId === id
              return (
                <div
                  key={originalIndex}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{suggestion.playName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {suggestion.conceptType}
                        {suggestion.concept && (
                          <span className="text-slate-400"> · {suggestion.concept}</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDismiss(originalIndex)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 shrink-0"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="mt-2 text-xs text-slate-600 space-y-0.5">
                    {suggestion.routesByRole.map((r) => (
                      <li key={r.role}>
                        <span className="font-medium text-slate-700">{r.role}:</span> {r.route}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500 italic">{suggestion.rationale}</p>
                  {suggestion.tags && suggestion.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {suggestion.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md bg-slate-200/80 px-1.5 py-0.5 text-xs text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      onClick={() => handleGenerateDraft(suggestion)}
                      disabled={!canEdit || generating}
                    >
                      <FilePlus className="h-3 w-3 mr-1" />
                      {generating ? "Creating…" : "Generate Draft"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleCopy(suggestion)}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
