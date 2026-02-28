"use client"

import { useState } from "react"

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
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
      <div className="grid gap-2 md:grid-cols-2">
        <input className="rounded border border-white/20 bg-black/20 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          type="number"
          className="rounded border border-white/20 bg-black/20 px-3 py-2"
          value={baseAiCredits}
          onChange={(e) => setBaseAiCredits(Number(e.target.value))}
        />
        <select className="rounded border border-white/20 bg-black/20 px-3 py-2" value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value)}>
          <option value="active">active</option>
          <option value="past_due">past_due</option>
          <option value="grace_period">grace_period</option>
          <option value="suspended">suspended</option>
          <option value="cancelled">cancelled</option>
          <option value="terminated">terminated</option>
        </select>
        <select className="rounded border border-white/20 bg-black/20 px-3 py-2" value={teamStatus} onChange={(e) => setTeamStatus(e.target.value)}>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
          <option value="cancelled">cancelled</option>
          <option value="terminated">terminated</option>
        </select>
        <div className="flex items-center gap-2 rounded border border-white/20 bg-black/20 px-3 py-2">
          <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
          AI enabled
        </div>
        <div className="flex items-center gap-2 rounded border border-white/20 bg-black/20 px-3 py-2">
          <input type="checkbox" checked={aiDisabledByPlatform} onChange={(e) => setAiDisabledByPlatform(e.target.checked)} />
          Disable AI by platform
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={saveTeam} className="rounded bg-cyan-500 px-3 py-2 text-xs font-semibold text-black">
          Save Team
        </button>
        <button onClick={saveAiSettings} className="rounded bg-white/10 px-3 py-2 text-xs">
          Save AI Settings
        </button>
      </div>
      <p className="text-xs text-white/70">Current AI usage this cycle: {team.aiUsageThisCycle}</p>
      {result ? <p className="text-xs text-white/70">{result}</p> : null}
    </div>
  )
}
