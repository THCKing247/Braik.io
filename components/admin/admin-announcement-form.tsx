"use client"

import { FormEvent, useState } from "react"

export function AdminAnnouncementForm() {
  const [content, setContent] = useState("")
  const [planTier, setPlanTier] = useState("")
  const [region, setRegion] = useState("")
  const [sport, setSport] = useState("")
  const [teamStatus, setTeamStatus] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState("")

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setResult("")
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          filters: {
            ...(planTier ? { planTier } : {}),
            ...(region ? { region } : {}),
            ...(sport ? { sport } : {}),
            ...(teamStatus ? { teamStatus } : {}),
          },
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send")
      }
      setResult(`Sent to ${payload.recipientCount} Head Coach accounts`)
      setContent("")
    } catch (error: any) {
      setResult(error.message || "Failed to send")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <textarea
        className="min-h-[120px] w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Announcement content for Head Coaches"
        required
      />
      <div className="grid gap-2 md:grid-cols-4">
        <input
          className="rounded border border-white/20 bg-black/20 px-2 py-1 text-xs"
          placeholder="Plan tier (optional)"
          value={planTier}
          onChange={(event) => setPlanTier(event.target.value)}
        />
        <input
          className="rounded border border-white/20 bg-black/20 px-2 py-1 text-xs"
          placeholder="Region (optional)"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
        />
        <input
          className="rounded border border-white/20 bg-black/20 px-2 py-1 text-xs"
          placeholder="Sport (optional)"
          value={sport}
          onChange={(event) => setSport(event.target.value)}
        />
        <select
          className="rounded border border-white/20 bg-black/20 px-2 py-1 text-xs"
          value={teamStatus}
          onChange={(event) => setTeamStatus(event.target.value)}
        >
          <option value="">Any status</option>
          <option value="active">ACTIVE</option>
          <option value="suspended">SUSPENDED</option>
          <option value="cancelled">CANCELLED</option>
          <option value="terminated">TERMINATED</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {submitting ? "Sending..." : "Send to Head Coaches"}
        </button>
        {result ? <p className="text-sm text-white/70">{result}</p> : null}
      </div>
    </form>
  )
}
