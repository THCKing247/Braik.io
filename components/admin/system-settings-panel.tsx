"use client"

import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

type Scope = "future_only" | "all" | "selective"

interface TeamOption {
  id: string
  name: string
}

interface ConfigRow {
  id: string
  key: string
  value_json: unknown
  version: number
  applied_scope: Scope
  applied_team_ids: string[] | null
  applied_at: string
  applied_by: string
}

interface Props {
  initialRows: ConfigRow[]
  teams: TeamOption[]
}

const DEFAULT_SETTINGS = {
  default_head_coach_credits: 500,
  default_assistant_ai_credits: 250,
  credit_cost_per_action_type: { schedule: 5, message: 2, playbook: 8 },
  default_undo_timer_minutes: 5,
  model_tier_mapping: { basic: "gpt-4o-mini", pro: "gpt-4.1" },
  grace_period_days: 7,
  suspension_delay_days: 7,
  retention_months: 12,
  allow_login_when_suspended: true,
}

export function SystemSettingsPanel({ initialRows, teams }: Props) {
  const [rows, setRows] = useState(initialRows)
  const [scope, setScope] = useState<Scope>("future_only")
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [key, setKey] = useState("ai.defaults")
  const [jsonValue, setJsonValue] = useState(JSON.stringify(DEFAULT_SETTINGS, null, 2))
  const [openConfirm, setOpenConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState("")

  const latestByKey = useMemo(() => {
    const map = new Map<string, ConfigRow>()
    for (const row of rows) {
      if (!map.has(row.key)) {
        map.set(row.key, row)
      }
    }
    return Array.from(map.values())
  }, [rows])

  function toggleTeam(teamId: string) {
    setSelectedTeamIds((prev) => (prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]))
  }

  async function commitVersionedUpdate() {
    setSaving(true)
    setStatus("")
    try {
      const valueJson = JSON.parse(jsonValue)
      const response = await fetch("/api/admin/system-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          valueJson,
          appliedScope: scope,
          appliedTeamIds: scope === "selective" ? selectedTeamIds : [],
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save setting")
      }
      setRows((prev) => [payload.row, ...prev])
      setStatus(`Saved ${payload.row.key} version ${payload.row.version}`)
      setOpenConfirm(false)
    } catch (error: any) {
      setStatus(error.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h3 className={cn(adminUi.sectionTitle, "text-base")}>System config (versioned)</h3>
        <p className="mt-1 text-xs font-medium text-admin-secondary">
          Every update appends a new row with incremented version. Previous rows are preserved.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            className={adminUi.input}
            placeholder="Config key"
          />
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as Scope)}
            className={adminUi.select}
          >
            <option value="future_only">future_only</option>
            <option value="all">all</option>
            <option value="selective">selective</option>
          </select>
          <button type="button" onClick={() => setOpenConfirm(true)} className={adminUi.btnPrimary}>
            Save New Version
          </button>
        </div>

        {scope === "selective" ? (
          <div className={cn(adminUi.panelMuted, "mt-3 p-3")}>
            <p className="mb-2 text-xs font-medium text-admin-secondary">Selective team rollout</p>
            <div className="grid max-h-36 gap-2 overflow-y-auto md:grid-cols-2">
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={selectedTeamIds.includes(team.id)} onChange={() => toggleTeam(team.id)} />
                  <span>{team.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <textarea
          value={jsonValue}
          onChange={(event) => setJsonValue(event.target.value)}
          className={cn(adminUi.input, "mt-3 min-h-[220px] font-mono text-xs")}
        />
        {status ? <p className="mt-2 text-xs font-medium text-admin-secondary">{status}</p> : null}
      </div>

      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h3 className={cn(adminUi.sectionTitle, "text-base")}>Latest by key</h3>
        <div className="mt-3 space-y-2">
          {latestByKey.map((row) => (
            <div key={row.id} className={cn(adminUi.nestedRow, "text-xs")}>
              <p className="font-semibold text-admin-primary">
                {row.key} (v{row.version}) - {row.applied_scope}
              </p>
              <p className="mt-1 font-medium text-admin-muted">{JSON.stringify(row.value_json)}</p>
            </div>
          ))}
          {latestByKey.length === 0 ? <p className="text-sm font-medium text-admin-muted">No rows available.</p> : null}
        </div>
      </div>

      <AdminModal
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        title="Confirm System Setting Change"
        summary="Choose rollout scope and append a new immutable config version."
      >
        <div className="space-y-3">
          <p className="text-sm font-medium text-admin-primary">
            Key: <span className="font-mono text-orange-300">{key}</span> | Scope:{" "}
            <span className="font-mono text-orange-300">{scope}</span>
          </p>
          {scope === "selective" ? (
            <p className="text-xs font-medium text-admin-secondary">Team count selected: {selectedTeamIds.length}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={commitVersionedUpdate}
              className={cn(adminUi.btnPrimarySm, "disabled:opacity-60")}
            >
              {saving ? "Saving..." : "Confirm Append Version"}
            </button>
            <button type="button" onClick={() => setOpenConfirm(false)} className={adminUi.btnSecondarySm}>
              Cancel
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  )
}
