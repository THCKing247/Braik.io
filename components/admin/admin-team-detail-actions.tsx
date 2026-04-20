"use client"

import { useState } from "react"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export function AdminTeamDetailActions({
  team,
}: {
  team: {
    id: string
    name: string
    subscriptionStatus: string
    teamStatus: string
    baseAiCredits: number
    aiUsageThisCycle: number
    aiEnabled: boolean
    aiDisabledByPlatform: boolean
  }
}) {
  const [name, setName] = useState(team.name)
  const [subscriptionStatus, setSubscriptionStatus] = useState(team.subscriptionStatus)
  const [teamStatus, setTeamStatus] = useState(team.teamStatus)
  const [baseAiCredits, setBaseAiCredits] = useState(team.baseAiCredits)
  const [aiEnabled, setAiEnabled] = useState(team.aiEnabled)
  const [aiDisabledByPlatform, setAiDisabledByPlatform] = useState(team.aiDisabledByPlatform)
  const [result, setResult] = useState("")

  async function saveTeam() {
    setResult("")
    const response = await fetch(`/api/admin/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subscriptionStatus, teamStatus, baseAiCredits }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setResult(payload.error || "Failed to update team")
      return
    }
    setResult("Team updated")
  }

  async function saveAiSettings() {
    setResult("")
    const response = await fetch(`/api/admin/teams/${team.id}/ai`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aiEnabled,
        aiDisabledByPlatform,
        baseAiCredits,
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setResult(payload.error || "Failed to update AI settings")
      return
    }
    setResult("AI controls updated")
  }

  return (
    <div className={cn(adminUi.panel, adminUi.panelPadding, "space-y-4 text-sm")}>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={adminUi.label} htmlFor="team-name">
            Team name
          </label>
          <input
            id="team-name"
            className={adminUi.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className={adminUi.label} htmlFor="base-ai-credits">
            Base AI credits
          </label>
          <input
            id="base-ai-credits"
            type="number"
            className={adminUi.input}
            value={baseAiCredits}
            onChange={(e) => setBaseAiCredits(Number(e.target.value))}
          />
        </div>
        <div>
          <label className={adminUi.label} htmlFor="sub-status">
            Subscription status
          </label>
          <select
            id="sub-status"
            className={adminUi.select}
            value={subscriptionStatus}
            onChange={(e) => setSubscriptionStatus(e.target.value)}
          >
            <option value="active">active</option>
            <option value="past_due">past_due</option>
            <option value="grace_period">grace_period</option>
            <option value="suspended">suspended</option>
            <option value="cancelled">cancelled</option>
            <option value="terminated">terminated</option>
          </select>
        </div>
        <div>
          <label className={adminUi.label} htmlFor="team-status">
            Team status
          </label>
          <select
            id="team-status"
            className={adminUi.select}
            value={teamStatus}
            onChange={(e) => setTeamStatus(e.target.value)}
          >
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="cancelled">cancelled</option>
            <option value="terminated">terminated</option>
          </select>
        </div>
        <label className={cn(adminUi.formCheckRow, "cursor-pointer")}>
          <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
          <span className="font-medium text-admin-primary">AI enabled</span>
        </label>
        <label className={cn(adminUi.formCheckRow, "cursor-pointer")}>
          <input
            type="checkbox"
            checked={aiDisabledByPlatform}
            onChange={(e) => setAiDisabledByPlatform(e.target.checked)}
          />
          <span className="font-medium text-admin-primary">Disable AI by platform</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={saveTeam} className={adminUi.btnPrimarySm}>
          Save team
        </button>
        <button type="button" onClick={saveAiSettings} className={adminUi.btnSecondarySm}>
          Save AI settings
        </button>
      </div>
      <p className="text-xs font-medium text-admin-secondary">Current AI usage this cycle: {team.aiUsageThisCycle}</p>
      {result ? <p className="text-xs font-medium text-admin-primary">{result}</p> : null}
    </div>
  )
}
