"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const HIGHLIGHT_POSTS_QUERY_KEY = "team-highlight-posts"

export function PlayerHighlightComposer({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setTitle("")
    setBody("")
    setError(null)
  }

  const submit = async () => {
    const t = title.trim()
    if (!t) {
      setError("Add a short title for your highlight.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/highlight-posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: t, body: body.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not post highlight.")
        return
      }
      reset()
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: [HIGHLIGHT_POSTS_QUERY_KEY, teamId] })
    } catch {
      setError("Network error. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-white/20 bg-white/5 px-3 py-2">
        <Button
          type="button"
          variant="outline"
          className="w-full border-white/25 bg-white/10 text-white hover:bg-white/15"
          onClick={() => setOpen(true)}
        >
          Post a highlight
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/20 bg-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">Share a highlight</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-white/80 hover:text-white"
          onClick={() => {
            reset()
            setOpen(false)
          }}
        >
          Cancel
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="highlight-title" className="text-white/90">
          Title
        </Label>
        <Input
          id="highlight-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best rep from practice"
          maxLength={200}
          className="border-white/20 bg-white text-slate-900"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="highlight-body" className="text-white/90">
          Details (optional)
        </Label>
        <textarea
          id="highlight-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened? Clip link, notes…"
          rows={4}
          maxLength={5000}
          className={cn(
            "flex min-h-[120px] w-full rounded-xl border px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
            "border-white/20 bg-white text-slate-900 focus-visible:border-primary focus-visible:ring-primary"
          )}
        />
      </div>
      {error ? <p className="text-sm font-medium text-amber-200">{error}</p> : null}
      <Button
        type="button"
        className="w-full"
        disabled={submitting || !title.trim()}
        onClick={() => void submit()}
      >
        {submitting ? "Posting…" : "Post to team feed"}
      </Button>
    </div>
  )
}

export { HIGHLIGHT_POSTS_QUERY_KEY }
