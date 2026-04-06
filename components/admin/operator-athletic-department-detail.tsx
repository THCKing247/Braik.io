"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { adminOpsTeamStateChip, adminOpsUserStatusChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"
import type {
  AthleticDepartmentDetailOverview,
  AthleticDepartmentTeamRow,
  AthleticDepartmentUserRow,
} from "@/lib/admin/athletic-departments-types"

type InitialDetail = {
  overview: AthleticDepartmentDetailOverview
  teams: AthleticDepartmentTeamRow[]
  users: AthleticDepartmentUserRow[]
}

export function OperatorAthleticDepartmentDetail({
  adId,
  initial,
}: {
  adId: string
  initial: InitialDetail
}) {
  const router = useRouter()
  const [overview, setOverview] = useState(initial.overview)
  const [teams, setTeams] = useState(initial.teams)
  const [users, setUsers] = useState(initial.users)
  const [userQuery, setUserQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [teamsAllowedInput, setTeamsAllowedInput] = useState(String(initial.overview.teamsAllowed))
  const [assistantsAllowedInput, setAssistantsAllowedInput] = useState(String(initial.overview.assistantCoachesAllowed))
  const [adVideo, setAdVideo] = useState(initial.overview.videoFeatureEnabled)

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        `${u.email ?? ""} ${u.name ?? ""} ${u.role} ${u.teamLabels} ${u.status}`.toLowerCase().includes(q)
    )
  }, [users, userQuery])

  async function refresh() {
    const res = await fetch(`/api/admin/athletic-departments/${adId}`, { credentials: "include", cache: "no-store" })
    const data = (await res.json()) as InitialDetail & { error?: string }
    if (!res.ok) throw new Error(data.error || "Failed to refresh")
    setOverview(data.overview)
    setTeams(data.teams)
    setUsers(data.users)
    setTeamsAllowedInput(String(data.overview.teamsAllowed))
    setAssistantsAllowedInput(String(data.overview.assistantCoachesAllowed))
    setAdVideo(data.overview.videoFeatureEnabled)
    router.refresh()
  }

  async function saveAdSettings() {
    setErr(null)
    setSaving(true)
    try {
      const teamsAllowed = Number.parseInt(teamsAllowedInput, 10)
      const assistantsAllowed = Number.parseInt(assistantsAllowedInput, 10)
      if (!Number.isFinite(teamsAllowed) || teamsAllowed < 0) {
        throw new Error("Teams allowed must be a non-negative number")
      }
      if (!Number.isFinite(assistantsAllowed) || assistantsAllowed < 0) {
        throw new Error("Assistant coaches allowed must be a non-negative number")
      }

      const confirms = { teams: false as boolean, assistants: false as boolean }
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(`/api/admin/athletic-departments/${adId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teams_allowed: teamsAllowed,
            assistant_coaches_allowed: assistantsAllowed,
            video_clips_enabled: adVideo,
            confirm_reduce_teams_below_active: confirms.teams,
            confirm_reduce_assistants_below_usage: confirms.assistants,
          }),
        })
        const data = await res.json()
        if (res.ok) {
          await refresh()
          return
        }
        if (res.status === 409 && data.code === "CONFIRM_REDUCE_TEAMS" && !confirms.teams) {
          const ok = window.confirm(
            `teams_allowed (${teamsAllowed}) is below active teams (${data.activeTeamCount}). Reduce anyway?`
          )
          if (!ok) return
          confirms.teams = true
          continue
        }
        if (res.status === 409 && data.code === "CONFIRM_REDUCE_ASSISTANTS" && !confirms.assistants) {
          const ok = window.confirm(
            `assistant_coaches_allowed (${assistantsAllowed}) is below current assistants (${data.assistantCoachUsageCount}). Reduce anyway?`
          )
          if (!ok) return
          confirms.assistants = true
          continue
        }
        throw new Error(data.error || "Save failed")
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function toggleTeamVideo(team: AthleticDepartmentTeamRow, next: boolean) {
    if (next && !overview.videoFeatureEnabled) {
      setErr("Turn on school-level video before enabling team video.")
      return
    }
    setErr(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/athletic-departments/${adId}/teams/${team.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_clips_enabled: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  const usageTeams = `${overview.activeTeamCount} / ${overview.teamsAllowed} active (scope: all teams linked to this AD)`
  const usageAssist = `${overview.assistantCoachUsageCount} / ${overview.assistantCoachesAllowed} assistants in use`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/athletic-departments" className={cn(adminUi.link, "text-sm underline-offset-2")}>
          ← Athletic Departments
        </Link>
        <span className="text-slate-500">/</span>
        <span className="text-slate-300">{overview.schoolName}</span>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm font-medium text-red-100">{err}</div>
      ) : null}

      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h2 className={cn(adminUi.sectionTitle, "text-lg")}>{overview.schoolName}</h2>
        {overview.organizationNames.length > 0 && (
          <p className="mt-1 text-sm font-medium text-slate-300">Organizations: {overview.organizationNames.join(", ")}</p>
        )}
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className={adminUi.nestedRow}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Teams usage</dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">{usageTeams}</dd>
          </div>
          <div className={adminUi.nestedRow}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Assistant coaches</dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">{usageAssist}</dd>
          </div>
          <div className={adminUi.nestedRow}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">School video (master)</dt>
            <dd className="mt-1 text-sm font-medium text-slate-100">{overview.videoFeatureEnabled ? "On" : "Off"}</dd>
          </div>
        </dl>

        <div className="mt-5 space-y-3 border-t border-slate-800 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Edit entitlements</p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-300">teams_allowed</span>
              <input
                type="number"
                min={0}
                value={teamsAllowedInput}
                onChange={(e) => setTeamsAllowedInput(e.target.value)}
                className={cn(adminUi.input, "w-28")}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-300">assistant_coaches_allowed</span>
              <input
                type="number"
                min={0}
                value={assistantsAllowedInput}
                onChange={(e) => setAssistantsAllowedInput(e.target.value)}
                className={cn(adminUi.input, "w-28")}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={adVideo}
                onChange={(e) => setAdVideo(e.target.checked)}
                className="h-4 w-4 rounded border-white/30"
              />
              <span className="text-slate-300">School video enabled (master)</span>
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => saveAdSettings()}
              className={adminUi.btnPrimary}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="text-xs font-medium text-slate-400">
            Lowering caps below current usage requires confirmation. Team video stays off when school video is off.
          </p>
        </div>
      </div>

      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h3 className={adminUi.sectionTitle}>Teams</h3>
        <p className="mt-1 text-xs font-medium text-slate-300">
          Team toggles are disabled when school video is off. Effective video also requires organization and team flags
          when a program is linked.
        </p>
        {teams.length === 0 ? (
          <p className="mt-4 text-sm font-medium text-slate-400">No teams linked to this athletic department.</p>
        ) : (
          <div className={cn(adminUi.tableWrap, "mt-4")}>
            <table className={cn(adminUi.table, "min-w-[900px]")}>
              <thead className={adminUi.thead}>
                <tr>
                  <th className={adminUi.th}>Team</th>
                  <th className={adminUi.th}>Sport</th>
                  <th className={adminUi.th}>Level</th>
                  <th className={adminUi.th}>Head coach</th>
                  <th className={adminUi.th}>Asst.</th>
                  <th className={adminUi.th}>Status</th>
                  <th className={adminUi.th}>Org video</th>
                  <th className={adminUi.th}>Team video</th>
                  <th className={adminUi.th}>Effective</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const disabled = !overview.videoFeatureEnabled
                  return (
                    <tr key={t.id} className={adminUi.tbodyRow}>
                      <td className={cn(adminUi.td, "font-medium text-white")}>
                        <Link href={`/admin/teams?q=${encodeURIComponent(t.name)}`} className={adminUi.link}>
                          {t.name}
                        </Link>
                      </td>
                      <td className={adminUi.td}>{t.sport ?? "—"}</td>
                      <td className={adminUi.td}>{t.level ?? "—"}</td>
                      <td className={adminUi.td}>{t.headCoachName ?? "—"}</td>
                      <td className={adminUi.td}>{t.assistantCoachCount}</td>
                      <td className={adminUi.td}>
                        <span className={cn(adminOpsTeamStateChip(t.teamStatus), "text-xs")}>{t.teamStatus}</span>
                      </td>
                      <td className={cn(adminUi.td, "font-medium text-slate-300")}>
                        {t.organizationVideoEnabled == null ? "—" : t.organizationVideoEnabled ? "On" : "Off"}
                      </td>
                      <td className={adminUi.td}>
                        <label
                          className={`inline-flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={t.videoFeatureEnabled}
                            disabled={disabled || saving}
                            title={disabled ? "Enable school-level video first" : undefined}
                            onChange={(e) => toggleTeamVideo(t, e.target.checked)}
                          />
                          <span className="text-slate-300">{t.videoFeatureEnabled ? "On" : "Off"}</span>
                        </label>
                      </td>
                      <td className={adminUi.td}>{t.videoEffectiveEnabled ? "Yes" : "No"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className={adminUi.sectionTitle}>Users</h3>
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Search users…"
            className={cn(adminUi.toolbarInput, "min-w-[200px] text-sm")}
          />
        </div>
        {filteredUsers.length === 0 ? (
          <p className="mt-4 text-sm font-medium text-slate-400">
            {users.length === 0 ? "No users found for this department." : "No users match your search."}
          </p>
        ) : (
          <div className={cn(adminUi.tableWrap, "mt-4")}>
            <table className={cn(adminUi.table, "min-w-[800px]")}>
              <thead className={adminUi.thead}>
                <tr>
                  <th className={adminUi.th}>Name</th>
                  <th className={adminUi.th}>Email</th>
                  <th className={adminUi.th}>Role</th>
                  <th className={adminUi.th}>Team(s)</th>
                  <th className={adminUi.th}>Status</th>
                  <th className={adminUi.th}>Last login</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className={adminUi.tbodyRow}>
                    <td className={cn(adminUi.td, "text-white")}>
                      <Link href={`/admin/users/${u.id}`} className={adminUi.link}>
                        {u.name?.trim() || "—"}
                      </Link>
                    </td>
                    <td className={adminUi.td}>{u.email ?? "—"}</td>
                    <td className={adminUi.td}>{u.role}</td>
                    <td className={cn(adminUi.td, "max-w-[280px] font-medium text-slate-300")}>{u.teamLabels}</td>
                    <td className={adminUi.td}>
                      <span className={cn(adminOpsUserStatusChip(u.status), "text-xs")}>{u.status}</span>
                    </td>
                    <td className={cn(adminUi.td, "font-medium text-slate-300")}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
