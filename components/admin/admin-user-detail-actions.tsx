"use client"

import { useState } from "react"
import { USER_ROLE_VALUES, USER_ROLE_LABELS } from "@/lib/auth/user-roles"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

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
    const response = await fetch(`/api/admin/impersonation/start`, {
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
    <div className={cn(adminUi.panel, adminUi.panelPadding, "space-y-4 text-sm")}>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={adminUi.label} htmlFor="ud-name">
            Name
          </label>
          <input id="ud-name" className={adminUi.input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={adminUi.label} htmlFor="ud-email">
            Email
          </label>
          <input
            id="ud-email"
            type="email"
            className={adminUi.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className={adminUi.label} htmlFor="ud-role">
            App role (legacy)
          </label>
          <select id="ud-role" className={adminUi.select} value={role} onChange={(e) => setRole(e.target.value)}>
            {USER_ROLE_VALUES.map((r) => (
              <option key={r} value={r}>
                {USER_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={adminUi.label} htmlFor="ud-status">
            Status
          </label>
          <select id="ud-status" className={adminUi.select} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="DEACTIVATED">DEACTIVATED</option>
          </select>
        </div>
        <div>
          <label className={adminUi.label} htmlFor="ud-ai-tier">
            AI tier
          </label>
          <select id="ud-ai-tier" className={adminUi.select} value={aiTier} onChange={(e) => setAiTier(e.target.value)}>
            <option value="BASIC">BASIC</option>
            <option value="PRO">PRO</option>
          </select>
        </div>
        <label className={cn(adminUi.formCheckRow, "cursor-pointer")}>
          <input
            type="checkbox"
            checked={aiAutoRechargeEnabled}
            onChange={(e) => setAiAutoRechargeEnabled(e.target.checked)}
          />
          <span className="font-medium text-slate-200">Auto-recharge AI credits</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={saveProfile} className={adminUi.btnPrimarySm}>
          Save profile
        </button>
        <button type="button" onClick={forcePasswordReset} className={adminUi.btnSecondarySm}>
          Force password reset
        </button>
        <button type="button" onClick={startImpersonation} className={adminUi.btnSecondarySm}>
          Start impersonation
        </button>
        <button type="button" onClick={hardDeleteUser} className={adminUi.btnDangerSm}>
          Hard delete
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          className={cn(adminUi.input, "w-28")}
          value={creditDelta}
          onChange={(e) => setCreditDelta(Number(e.target.value))}
        />
        <button type="button" onClick={adjustCredits} className={adminUi.btnSecondarySm}>
          Grant / revoke AI credits
        </button>
      </div>
      {result ? <p className="text-xs font-medium text-slate-200">{result}</p> : null}
    </div>
  )
}
