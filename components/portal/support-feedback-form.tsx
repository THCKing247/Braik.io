"use client"

import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
const CATEGORIES = [
  { value: "bug", label: "Bug report" },
  { value: "feature_request", label: "Feature request" },
  { value: "support_question", label: "Support question" },
  { value: "general", label: "General feedback" },
] as const

export function SupportFeedbackForm({ teamId: teamIdProp }: { teamId?: string | null }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const teamId = teamIdProp ?? searchParams.get("teamId")
  const [category, setCategory] = useState<string>("support_question")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [error, setError] = useState("")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("loading")
    setError("")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject.trim() || undefined,
          body: body.trim(),
          teamId: teamId || undefined,
          pagePath: pathname || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not send feedback")
      }
      setStatus("done")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  function submitAnother() {
    setStatus("idle")
    setError("")
    setCategory("support_question")
    setSubject("")
    setBody("")
  }

  if (status === "done") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Thanks — your message was sent to the team. We will follow up by email when needed.
        </p>
        <Button type="button" variant="outline" className="border-border" onClick={submitAnother}>
          Submit another request
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fb-cat">Category</Label>
        <select
          id="fb-cat"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fb-subject">Subject (optional)</Label>
        <Input
          id="fb-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          className="border-border bg-white"
          placeholder="Short summary"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fb-body">Message</Label>
        <textarea
          id="fb-body"
          required
          minLength={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="flex min-h-[120px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
          placeholder="What happened, what you expected, and any steps to reproduce (for bugs)."
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={status === "loading"} className="bg-primary text-primary-foreground">
        {status === "loading" ? "Sending…" : "Send feedback"}
      </Button>
    </form>
  )
}
