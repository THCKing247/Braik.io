"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"
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
      <div className={cn("rounded-xl border px-3 py-2", braikPlayerTheme.surface)}>
        <Button
          type="button"
          variant="outline"
          className="w-full border-[#F85808]/45 bg-[#F85808]/15 text-[#F8F8F8] hover:bg-[#D83808]/22"
          onClick={() => setOpen(true)}
        >
          Post a highlight
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3 rounded-xl border px-3 py-3", braikPlayerTheme.surface)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#F8F8F8]">Share a highlight</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[#c6cfe4] hover:text-[#F8F8F8]"
          onClick={() => {
            reset()
            setOpen(false)
          }}
        >
          Cancel
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="highlight-title" className="text-[#F8F8E8]">
          Title
        </Label>
        <Input
          id="highlight-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best rep from practice"
          maxLength={200}
          className="border-[#1f2f63] bg-[#F8F8F8] text-[#081838] focus-visible:ring-[#F85808]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="highlight-body" className="text-[#F8F8E8]">
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
            "border-[#1f2f63] bg-[#F8F8F8] text-[#081838] focus-visible:border-[#F85808] focus-visible:ring-[#F85808]"
          )}
        />
      </div>
      {error ? <p className="text-sm font-medium text-[#F85808]">{error}</p> : null}
      <Button
        type="button"
        className="w-full bg-[#F85808] text-[#F8F8F8] hover:bg-[#D83808]"
        disabled={submitting || !title.trim()}
        onClick={() => void submit()}
      >
        {submitting ? "Posting…" : "Post to team feed"}
      </Button>
    </div>
  )
}

export { HIGHLIGHT_POSTS_QUERY_KEY }
