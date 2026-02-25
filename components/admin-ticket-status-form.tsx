"use client"

import { useState } from "react"

const TICKET_STATUSES = ["NEW", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"] as const

export function AdminTicketStatusForm({
  ticketId,
  initialStatus,
}: {
  ticketId: string
  initialStatus: string
}) {
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function onUpdate() {
    setSaving(true)
    setMessage("")
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update ticket")
      }
      setMessage("Updated")
    } catch (error: any) {
      setMessage(error.message || "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="rounded border border-white/20 bg-black/20 px-2 py-1 text-xs"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        {TICKET_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onUpdate}
        disabled={saving}
        className="rounded bg-cyan-500 px-3 py-1 text-xs font-semibold text-black disabled:opacity-60"
      >
        {saving ? "Saving..." : "Apply"}
      </button>
      {message ? <span className="text-xs text-white/70">{message}</span> : null}
    </div>
  )
}
