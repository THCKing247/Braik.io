"use client"

import { useState } from "react"

export function AdminUserDetailActions({
  user,
}: {
  user: {
    id: string
    name: string | null
    email: string
    role: string
    status: string
    aiTier: string
    aiCreditsRemaining: number
    aiAutoRechargeEnabled: boolean
  }
}) {
  const [name, setName] = useState(user.name || "")
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [status, setStatus] = useState(user.status)
  const [aiTier, setAiTier] = useState(user.aiTier)
  const [aiAutoRechargeEnabled, setAiAutoRechargeEnabled] = useState(user.aiAutoRechargeEnabled)
  const [creditDelta, setCreditDelta] = useState(100)
  const [result, setResult] = useState("")

  async function saveProfile() {
    setResult("")
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        role,
        status,
        aiTier,
        aiAutoRechargeEnabled,
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setResult(payload.error || "Failed to save")
      return
    }
    setResult("Saved user profile")
  }

  async function forcePasswordReset() {
    setResult("")
    const response = await fetch(`/api/admin/users/${user.id}/password-reset`, {
      method: "POST",
    })
    const payload = await response.json()
    if (!response.ok) {
      setResult(payload.error || "Failed to reset password")
      return
    }
    setResult(`Temporary password: ${payload.temporaryPassword}`)
  }

  async function adjustCredits() {
    setResult("")
    const response = await fetch(`/api/admin/users/${user.id}/ai-credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta: creditDelta }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setResult(payload.error || "Failed to adjust credits")
      return
    }
    setResult(`Credits updated to ${payload.user.aiCreditsRemaining}`)
  }

  async function startImpersonation() {
    setResult("")
    const response = await fetch("/api/admin/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: user.id, durationMinutes: 10, reason: "support_request" }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setResult(payload.error || "Failed to start impersonation")
      return
    }
    setResult(`Impersonation started (session ${payload.session.id})`)
  }

  async function hardDeleteUser() {
    const ok = window.confirm("Permanently delete this user? This cannot be undone.")
    if (!ok) return
    setResult("")
    const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
    const payload = await response.json()
    if (!response.ok) {
      setResult(payload.error || "Failed to delete user")
      return
    }
    setResult("User deleted")
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
      <div className="grid gap-2 md:grid-cols-2">
        <input className="rounded border border-white/20 bg-black/20 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border border-white/20 bg-black/20 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="rounded border border-white/20 bg-black/20 px-3 py-2" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select className="rounded border border-white/20 bg-black/20 px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="DEACTIVATED">DEACTIVATED</option>
        </select>
        <select className="rounded border border-white/20 bg-black/20 px-3 py-2" value={aiTier} onChange={(e) => setAiTier(e.target.value)}>
          <option value="BASIC">BASIC</option>
          <option value="PRO">PRO</option>
        </select>
        <label className="flex items-center gap-2 rounded border border-white/20 bg-black/20 px-3 py-2">
          <input
            type="checkbox"
            checked={aiAutoRechargeEnabled}
            onChange={(e) => setAiAutoRechargeEnabled(e.target.checked)}
          />
          Auto-recharge AI credits
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={saveProfile} className="rounded bg-cyan-500 px-3 py-2 text-xs font-semibold text-black">
          Save Profile
        </button>
        <button onClick={forcePasswordReset} className="rounded bg-white/10 px-3 py-2 text-xs">
          Force Password Reset
        </button>
        <button onClick={startImpersonation} className="rounded bg-white/10 px-3 py-2 text-xs">
          Start Impersonation
        </button>
        <button onClick={hardDeleteUser} className="rounded bg-red-500/80 px-3 py-2 text-xs">
          Hard Delete
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          className="w-28 rounded border border-white/20 bg-black/20 px-3 py-2"
          value={creditDelta}
          onChange={(e) => setCreditDelta(Number(e.target.value))}
        />
        <button onClick={adjustCredits} className="rounded bg-white/10 px-3 py-2 text-xs">
          Grant/Revoke AI Credits
        </button>
      </div>
      {result ? <p className="text-xs text-white/70">{result}</p> : null}
    </div>
  )
}
