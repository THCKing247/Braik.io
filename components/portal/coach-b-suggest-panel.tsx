"use client"

import { useState, useCallback } from "react"
import { Sparkles, Loader2, Copy, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import type { PlaySuggestion } from "@/lib/types/coach-b"

export interface CoachBSuggestPanelProps {
  teamId: string
  playbookId: string
  /** After inserting a draft play, redirect to this base path (e.g. /dashboard/playbooks/[id]) so returnUrl can be set */
  returnUrl?: string
  className?: string
}

export function CoachBSuggestPanel({ teamId, playbookId, returnUrl, className = "" }: CoachBSuggestPanelProps) {
  const { showToast } = usePlaybookToast()
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<PlaySuggestion[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

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
        body: JSON.stringify({ prompt: text, playbookId }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions ?? [])
        if (!data.suggestions?.length) showToast("No suggestions for that prompt. Try being more specific.", "success")
      } else {
        showToast("Could not get suggestions", "error")
      }
    } catch {
      showToast("Could not get suggestions", "error")
    } finally {
      setLoading(false)
    }
  }, [prompt, loading, playbookId, showToast])

  const handleInsertDraft = useCallback(
    async (suggestion: PlaySuggestion) => {
      try {
        const res = await fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            playbookId: playbookId || null,
            side: "offense",
            formation: "",
            name: suggestion.playName,
            ...(["run", "pass", "rpo", "screen"].includes(suggestion.conceptType.toLowerCase())
              ? { playType: suggestion.conceptType.toLowerCase() as "run" | "pass" | "rpo" | "screen" }
              : {}),
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? "Failed to create play")
        }
        const play = await res.json()
        showToast("Draft play created. Open it to add routes and save.", "success")
        const url = `/dashboard/playbooks/play/${play.id}${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`
        window.location.href = url
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to create play", "error")
      }
    },
    [teamId, playbookId, returnUrl, showToast]
  )

  const handleCopy = useCallback(
    (suggestion: PlaySuggestion) => {
      const text = [
        suggestion.playName,
        `Concept: ${suggestion.conceptType}`,
        ...suggestion.routesByRole.map((r) => `  ${r.role}: ${r.route}`),
        suggestion.rationale,
      ].join("\n")
      void navigator.clipboard.writeText(text)
      showToast("Copied to clipboard", "success")
    },
    [showToast]
  )

  const handleDismiss = useCallback((index: number) => {
    setDismissedIds((prev) => new Set(prev).add(`s-${index}`))
  }, [])

  const visibleSuggestions = suggestions.filter((_, i) => !dismissedIds.has(`s-${i}`))

  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-slate-900">Coach B</h3>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Get play ideas. Try: &quot;Need a 3rd and 6 pass from Trips Right&quot;
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
            className="flex-1 min-w-0 rounded-md border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400"
            disabled={loading}
          />
          <Button size="sm" onClick={handleAsk} disabled={loading || !prompt.trim()} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
          </Button>
        </div>

        {visibleSuggestions.length > 0 && (
          <div className="space-y-2">
            {visibleSuggestions.map((suggestion, idx) => {
              const originalIndex = suggestions.indexOf(suggestion)
              return (
                <div
                  key={originalIndex}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{suggestion.playName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{suggestion.conceptType}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDismiss(originalIndex)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600"
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
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      onClick={() => handleInsertDraft(suggestion)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Insert as draft
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
