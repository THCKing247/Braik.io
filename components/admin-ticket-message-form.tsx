"use client"

import { FormEvent, useState } from "react"

export function AdminTicketMessageForm({ ticketId }: { ticketId: string }) {
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState("")

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setStatus("")

    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send message")
      }
      setStatus("Sent to Head Coach")
      setMessage("")
    } catch (error: any) {
      setStatus(error.message || "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="mt-2 flex gap-2" onSubmit={onSubmit}>
      <input
        className="w-full rounded border border-white/20 bg-black/20 px-2 py-1 text-xs"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Reply to Head Coach"
        required
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-cyan-500 px-3 py-1 text-xs font-semibold text-black disabled:opacity-60"
      >
        {saving ? "Sending..." : "Send"}
      </button>
      {status ? <span className="text-xs text-white/70">{status}</span> : null}
    </form>
  )
}
