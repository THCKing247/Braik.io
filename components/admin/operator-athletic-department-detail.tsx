"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  normalizeAthleticDepartmentDetailOverview,
  type AthleticDepartmentDetailOverview,
  type AthleticDepartmentOrganizationVideoRow,
  type AthleticDepartmentTeamRow,
  type AthleticDepartmentUserRow,
} from "@/lib/admin/athletic-departments-types"

type InitialDetail = {
  overview: AthleticDepartmentDetailOverview
  teams: AthleticDepartmentTeamRow[]
  users: AthleticDepartmentUserRow[]
}

function statusChip(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized === "active") return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
  if (normalized.includes("suspend")) return "bg-red-500/20 text-red-200 border-red-400/40"
  return "bg-white/10 text-white/80 border-white/20"
}

export function OperatorAthleticDepartmentDetail({
  adId,
  initial,
}: {
  adId: string
  initial: InitialDetail
}) {
  const router = useRouter()
  const [overview, setOverview] = useState(() => normalizeAthleticDepartmentDetailOverview(initial.overview))
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

  const teamsBlockedByOrgVideo = useMemo(
    () => teams.filter((t) => t.videoEffectiveBlockReason === "organization"),
    [teams]
  )

  async function refresh() {
    const res = await fetch(`/api/admin/athletic-departments/${adId}`, { credentials: "include", cache: "no-store" })
    const data = (await res.json()) as InitialDetail & { error?: string }
    if (!res.ok) throw new Error(data.error || "Failed to refresh")
    setOverview(normalizeAthleticDepartmentDetailOverview(data.overview))
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

  async function toggleOrgVideo(org: AthleticDepartmentOrganizationVideoRow, next: boolean) {
    setErr(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/provisioning/organizations/${encodeURIComponent(org.id)}`, {
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
        <Link href="/admin/athletic-departments" className="text-cyan-300 underline hover:text-cyan-200">
          ← Athletic Departments
        </Link>
        <span className="text-white/40">/</span>
        <span className="text-white/80">{overview.schoolName}</span>
      </div>

      {err && (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{err}</div>
      )}

      <div className="rounded-xl border border-white/[0.08] bg-admin-card shadow-admin-card p-5">
        <h2 className="text-lg font-semibold text-white">{overview.schoolName}</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-white/[0.08] bg-admin-nested px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-white/50">Teams usage</dt>
            <dd className="mt-1 text-sm font-medium text-white">{usageTeams}</dd>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-admin-nested px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-white/50">Assistant coaches</dt>
            <dd className="mt-1 text-sm font-medium text-white">{usageAssist}</dd>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-admin-nested px-3 py-2">
            <dt className="text-xs uppercase tracking-wide text-white/50">School video (master)</dt>
            <dd className="mt-1 text-sm font-medium text-white">{overview.videoFeatureEnabled ? "On" : "Off"}</dd>
          </div>
        </dl>

        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-white/50">Edit entitlements</p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-white/60">teams_allowed</span>
              <input
                type="number"
                min={0}
                value={teamsAllowedInput}
                onChange={(e) => setTeamsAllowedInput(e.target.value)}
                className="w-28 rounded border border-white/15 bg-admin-input px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-white/60">assistant_coaches_allowed</span>
              <input
                type="number"
                min={0}
                value={assistantsAllowedInput}
                onChange={(e) => setAssistantsAllowedInput(e.target.value)}
                className="w-28 rounded border border-white/15 bg-admin-input px-2 py-1.5 text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={adVideo}
                onChange={(e) => setAdVideo(e.target.checked)}
                className="h-4 w-4 rounded border-white/30"
              />
              <span className="text-white/85">School video enabled (master)</span>
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => saveAdSettings()}
              className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="text-xs text-white/45">
            Lowering caps below current usage requires confirmation. Team video stays off when school video is off.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-admin-card shadow-admin-card p-4">
        <h3 className="text-base font-semibold text-white">Organization video</h3>
        <p className="mt-1 text-xs text-white/55">
          When a team is on a program, the program&apos;s organization must allow video before the team portal Video tab
          can turn on (along with school and team toggles). Organizations listed here are either linked to this athletic
          department or referenced by a team&apos;s program under this school.
        </p>
        {(overview.organizations ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-white/55">
            No organizations in scope. Link an organization to this department or assign teams to programs with an
            organization.
          </p>
        ) : (
          <ul className="mt-4 space-y-3" aria-label="Organization video toggles">
            {(overview.organizations ?? []).map((org) => (
              <li
                key={org.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-admin-nested px-3 py-2"
              >
                <span className="text-sm font-medium text-white">{org.name}</span>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={org.videoClipsEnabled}
                    disabled={saving}
                    onChange={(e) => toggleOrgVideo(org, e.target.checked)}
                    className="h-4 w-4 rounded border-white/30"
                  />
                  <span className="text-white/80">Organization video enabled</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-admin-card shadow-admin-card p-4">
        <h3 className="text-base font-semibold text-white">Teams</h3>
        <p className="mt-1 text-xs text-white/55">
          <span className="font-medium text-white/70">How effective video works:</span> The team portal &quot;Game Video /
          Clips&quot; tab appears only when every layer that applies is on: school (athletic department) video, then—if
          the team is linked to a program—<span className="text-white/80">organization</span> video for that program&apos;s
          org, then team video. Each user also needs video view permission in{" "}
          <code className="rounded bg-admin-input px-1 text-white/70">user_video_permissions</code>. Turning on school + team
          is not enough if the team has a program and organization-level video is off.
        </p>
        {teamsBlockedByOrgVideo.length > 0 && (
          <div
            className="mt-4 rounded-lg border border-amber-400/50 bg-amber-500/15 px-4 py-3 text-sm text-amber-50"
            role="status"
          >
            <p className="font-semibold text-amber-100">Video is blocked because organization-level video access is disabled.</p>
            <p className="mt-2 text-amber-100/90">
              {teamsBlockedByOrgVideo.length === 1 ? (
                <>
                  Team &quot;{teamsBlockedByOrgVideo[0].name}&quot; is linked to a program whose organization has org
                  video off. Enable video for that organization in provisioning, or unlink the team from the program, so
                  effective access can turn on.
                </>
              ) : (
                <>
                  {teamsBlockedByOrgVideo.length} teams are linked to a program whose organization has org video off:{" "}
                  {teamsBlockedByOrgVideo.map((t) => t.name).join(", ")}. Enable organization video for those programs, or
                  adjust program links.
                </>
              )}
            </p>
          </div>
        )}
        {teams.length === 0 ? (
          <p className="mt-4 text-sm text-white/55">No teams linked to this athletic department.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-white/50">
                <tr>
                  <th className="py-2 pr-3">Team</th>
                  <th className="py-2 pr-3">Sport</th>
                  <th className="py-2 pr-3">Level</th>
                  <th className="py-2 pr-3">Head coach</th>
                  <th className="py-2 pr-3">Asst.</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Org video</th>
                  <th className="py-2 pr-3">Team video</th>
                  <th className="py-2 pr-3">Effective (portal product)</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const disabled = !overview.videoFeatureEnabled
                  const effectiveNote =
                    t.videoEffectiveEnabled
                      ? null
                      : t.videoEffectiveBlockReason === "organization"
                        ? "Video is blocked because organization-level video access is disabled."
                        : t.videoEffectiveBlockReason === "school"
                          ? "Turn on school (AD) video above."
                          : t.videoEffectiveBlockReason === "team"
                            ? "Turn on team video for this row."
                            : null
                  return (
                    <tr key={t.id} className="border-b border-white/5">
                      <td className="py-2 pr-3 font-medium text-white">
                        <Link href={`/admin/teams/${t.id}`} className="text-cyan-300 underline">
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-white/75">{t.sport ?? "—"}</td>
                      <td className="py-2 pr-3 text-white/75">{t.level ?? "—"}</td>
                      <td className="py-2 pr-3 text-white/75">{t.headCoachName ?? "—"}</td>
                      <td className="py-2 pr-3 text-white/75">{t.assistantCoachCount}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded border px-2 py-0.5 text-xs ${statusChip(t.teamStatus)}`}>
                          {t.teamStatus}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-white/70">
                        {t.organizationVideoEnabled == null ? "—" : t.organizationVideoEnabled ? "On" : "Off"}
                      </td>
                      <td className="py-2 pr-3">
                        <label
                          className={`inline-flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={t.videoFeatureEnabled}
                            disabled={disabled || saving}
                            title={disabled ? "Enable school-level video first" : undefined}
                            onChange={(e) => toggleTeamVideo(t, e.target.checked)}
                          />
                          <span className="text-white/80">{t.videoFeatureEnabled ? "On" : "Off"}</span>
                        </label>
                      </td>
                      <td className="max-w-[220px] py-2 pr-3 text-white/85">
                        <span className="font-medium">{t.videoEffectiveEnabled ? "Yes" : "No"}</span>
                        {effectiveNote && (
                          <p className="mt-1 text-xs font-normal leading-snug text-amber-200/90">{effectiveNote}</p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-admin-card shadow-admin-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">Users</h3>
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Search users…"
            className="rounded border border-white/15 bg-admin-input px-3 py-1.5 text-sm"
          />
        </div>
        {filteredUsers.length === 0 ? (
          <p className="mt-4 text-sm text-white/55">
            {users.length === 0 ? "No users found for this department." : "No users match your search."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-white/50">
                <tr>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Team(s)</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last login</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-white">
                      <Link href={`/admin/users/${u.id}`} className="text-cyan-300 underline hover:text-cyan-200">
                        {u.name?.trim() || "—"}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-white/75">{u.email ?? "—"}</td>
                    <td className="py-2 pr-3 text-white/75">{u.role}</td>
                    <td className="max-w-[280px] py-2 pr-3 text-white/70">{u.teamLabels}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded border px-2 py-0.5 text-xs ${statusChip(u.status)}`}>{u.status}</span>
                    </td>
                    <td className="py-2 pr-3 text-white/60">
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
