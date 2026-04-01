"use client"

import { useEffect, useState } from "react"
import { ACCOUNT_STATUS_VALUES } from "@/lib/account/account-status"
import { USER_ROLE_LABELS, USER_ROLE_VALUES } from "@/lib/auth/user-roles"

type OrgRow = { id: string; name: string; slug: string | null; video_clips_enabled: boolean }
type TeamRow = {
  id: string
  name: string
  organizationName: string | null
  program_id: string | null
  video_clips_enabled: boolean
}

export function AdminProvisioningConsole() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [orgMsg, setOrgMsg] = useState("")
  const [teamMsg, setTeamMsg] = useState("")
  const [inviteMsg, setInviteMsg] = useState("")

  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [orgVideo, setOrgVideo] = useState(false)

  const [teamName, setTeamName] = useState("")
  const [teamOrgId, setTeamOrgId] = useState("")
  const [teamSport, setTeamSport] = useState("football")
  const [teamProgramName, setTeamProgramName] = useState("")
  const [teamVideo, setTeamVideo] = useState(false)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState("head_coach")
  const [inviteTeamId, setInviteTeamId] = useState("")
  const [inviteOrgId, setInviteOrgId] = useState("")
  const [inviteStatus, setInviteStatus] = useState("invited")
  const [inviteVideo, setInviteVideo] = useState(false)

  useEffect(() => {
    void (async () => {
      const [or, tr] = await Promise.all([
        fetch("/api/admin/provisioning/organizations", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/provisioning/teams", { credentials: "include" }).then((r) => r.json()),
      ])
      setOrgs(or.organizations ?? [])
      setTeams(tr.teams ?? [])
    })()
  }, [])

  async function submitOrg(e: React.FormEvent) {
    e.preventDefault()
    setOrgMsg("")
    const res = await fetch("/api/admin/provisioning/organizations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName, slug: orgSlug || null, video_clips_enabled: orgVideo }),
    })
    const data = await res.json()
    if (!res.ok) {
      setOrgMsg(data.error ?? "Failed")
      return
    }
    setOrgMsg(`Created organization ${data.name}`)
    setOrgName("")
    setOrgSlug("")
    setOrgs((prev) => [data as OrgRow, ...prev])
  }

  async function submitTeam(e: React.FormEvent) {
    e.preventDefault()
    setTeamMsg("")
    if (!teamOrgId) {
      setTeamMsg("Select an organization for the program + team.")
      return
    }
    const res = await fetch("/api/admin/provisioning/teams", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: teamName,
        organizationId: teamOrgId,
        sport: teamSport,
        programName: teamProgramName || teamName,
        video_clips_enabled: teamVideo,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setTeamMsg(data.error ?? "Failed")
      return
    }
    setTeamMsg(`Created team ${data.name}`)
    setTeamName("")
    setTeams((prev) => [data as TeamRow, ...prev])
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteMsg("")
    const res = await fetch("/api/admin/provisioning/users/invite", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        fullName: inviteName,
        role: inviteRole,
        teamId: inviteTeamId || null,
        organizationId: inviteOrgId || null,
        accountStatus: inviteStatus,
        video: inviteVideo
          ? {
              can_view_video: true,
              can_upload_video: true,
              can_create_clips: true,
              can_share_clips: true,
              can_delete_video: false,
            }
          : {
              can_view_video: false,
              can_upload_video: false,
              can_create_clips: false,
              can_share_clips: false,
              can_delete_video: false,
            },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setInviteMsg(data.error ?? "Failed")
      return
    }
    setInviteMsg(`Invite sent. User id: ${data.userId}`)
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-white/70">
        Create organizations and teams, then invite users. Invites use Supabase email with a secure link to set a
        password — no temporary passwords are sent in plain text.
      </p>

      <section className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <h2 className="text-lg font-semibold">New organization</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={submitOrg}>
          <div>
            <label className="text-xs text-white/60">Name</label>
            <input
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Slug (optional)</label>
            <input
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={orgVideo} onChange={(e) => setOrgVideo(e.target.checked)} />
            video_clips_enabled (org)
          </label>
          <button type="submit" className="rounded bg-cyan-600 px-3 py-2 text-sm font-medium text-white md:col-span-2">
            Create organization
          </button>
        </form>
        {orgMsg ? <p className="mt-2 text-xs text-emerald-300">{orgMsg}</p> : null}
      </section>

      <section className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <h2 className="text-lg font-semibold">New team (under program)</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={submitTeam}>
          <div className="md:col-span-2">
            <label className="text-xs text-white/60">Organization</label>
            <select
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={teamOrgId}
              onChange={(e) => setTeamOrgId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60">Team name</label>
            <input
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Sport</label>
            <input
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={teamSport}
              onChange={(e) => setTeamSport(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-white/60">Program name (defaults to team name)</label>
            <input
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={teamProgramName}
              onChange={(e) => setTeamProgramName(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={teamVideo} onChange={(e) => setTeamVideo(e.target.checked)} />
            video_clips_enabled (team)
          </label>
          <button type="submit" className="rounded bg-cyan-600 px-3 py-2 text-sm font-medium text-white md:col-span-2">
            Create team
          </button>
        </form>
        {teamMsg ? <p className="mt-2 text-xs text-emerald-300">{teamMsg}</p> : null}
      </section>

      <section className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <h2 className="text-lg font-semibold">Invite user</h2>
        <p className="mt-1 text-xs text-white/50">
          Sends a Supabase invite email. TODO: confirm Auth email templates use your app URL in the dashboard.
        </p>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={submitInvite}>
          <div>
            <label className="text-xs text-white/60">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Full name</label>
            <input
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Role</label>
            <select
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {USER_ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {USER_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60">Account status</label>
            <select
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={inviteStatus}
              onChange={(e) => setInviteStatus(e.target.value)}
            >
              {ACCOUNT_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60">Team (optional)</label>
            <select
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={inviteTeamId}
              onChange={(e) => setInviteTeamId(e.target.value)}
            >
              <option value="">—</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60">Org (optional, for records)</label>
            <select
              className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
              value={inviteOrgId}
              onChange={(e) => setInviteOrgId(e.target.value)}
            >
              <option value="">—</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={inviteVideo} onChange={(e) => setInviteVideo(e.target.checked)} />
            Game Video / Clips (sets view/upload/create/share; refine per user in Accounts)
          </label>
          <button type="submit" className="rounded bg-violet-600 px-3 py-2 text-sm font-medium text-white md:col-span-2">
            Send invite
          </button>
        </form>
        {inviteMsg ? <p className="mt-2 text-xs text-emerald-300">{inviteMsg}</p> : null}
      </section>
    </div>
  )
}
