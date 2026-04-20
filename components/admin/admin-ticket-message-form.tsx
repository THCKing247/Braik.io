"use client"

import { FormEvent, useState } from "react"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

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
        className={cn(adminUi.toolbarInput, "min-w-0 flex-1")}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Reply to Head Coach"
        required
      />
      <button type="submit" disabled={saving} className={cn(adminUi.btnPrimarySm, "disabled:opacity-60")}>
        {saving ? "Sending..." : "Send"}
      </button>
      {status ? <span className="text-xs text-admin-muted">{status}</span> : null}
    </form>
  )
}
