"use client"

import { FormEvent, useState } from "react"

export function SupportTicketForm({ teamId }: { teamId: string }) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState("normal")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState("")

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setResult("")
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, subject, message, category, priority }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Failed to submit ticket")
      }
      setResult("Issue submitted. Head Coach will receive support updates.")
      setSubject("")
      setMessage("")
      setCategory("")
      setPriority("normal")
    } catch (error: any) {
      setResult(error.message || "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <input
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        className="input-theme w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        placeholder="Issue subject"
        required
      />
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        className="min-h-[130px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-y"
        placeholder="Describe the issue"
        required
      />
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="input-theme w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          placeholder="Category (optional)"
        />
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {submitting ? "Submitting..." : "Submit Ticket"}
        </button>
        {result ? <p className="text-sm text-muted-foreground">{result}</p> : null}
      </div>
    </form>
  )
}
