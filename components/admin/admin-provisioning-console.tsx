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

/** Shared form styles — layered admin grays (see tailwind `admin.*` colors) */
const labelCls = "block text-xs font-medium uppercase tracking-wide text-zinc-400"
const controlCls =
  "mt-1.5 block w-full h-10 rounded-md border border-white/[0.1] bg-admin-input px-3 text-sm text-zinc-100 shadow-sm outline-none transition placeholder:text-zinc-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
const selectCls = `${controlCls} cursor-pointer pr-9 [&>option]:bg-admin-input [&>option]:text-zinc-100`
const checkRowCls =
  "flex items-start gap-3 rounded-lg border border-white/[0.08] bg-admin-nested px-3 py-2.5 text-sm text-zinc-300 md:col-span-2"
const cardCls = "rounded-xl border border-white/[0.08] bg-admin-card shadow-admin-card"
const primaryBtnCls =
  "inline-flex h-10 w-full items-center justify-center rounded-md bg-cyan-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/80 sm:w-auto sm:min-w-[11rem]"
const inviteBtnCls =
  "inline-flex h-10 w-full items-center justify-center rounded-md bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/80 sm:w-auto sm:min-w-[11rem]"
const msgOkCls =
  "mt-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200/95"
const msgErrCls = "mt-3 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200/95"

function feedbackMessageClass(msg: string): string {
  const m = msg.trim()
  if (
    m.startsWith("Created organization") ||
    m.startsWith("Created team") ||
    m.startsWith("Invite sent.")
  ) {
    return msgOkCls
  }
  return msgErrCls
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
    <div className="space-y-10">
      <p className="text-sm leading-relaxed text-zinc-400">
        Create organizations and teams, then invite users. Invites use Supabase email with a secure link to set a
        password — no temporary passwords are sent in plain text.
      </p>

      <section className={cardCls}>
        <div className="border-b border-white/[0.08] px-5 py-4 md:px-6 md:py-5">
          <h2 className="text-base font-semibold tracking-tight text-zinc-50">Create organization</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            Add a new organization record. Slug is optional; enable video at the org level when programs should allow
            clips.
          </p>
        </div>
        <form className="grid gap-5 px-5 py-5 md:grid-cols-2 md:gap-x-6 md:gap-y-5 md:px-6 md:pb-6" onSubmit={submitOrg}>
          <div>
            <label className={labelCls} htmlFor="prov-org-name">
              Name
            </label>
            <input
              id="prov-org-name"
              className={controlCls}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              autoComplete="organization"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="prov-org-slug">
              Slug <span className="font-normal normal-case text-zinc-500">(optional)</span>
            </label>
            <input
              id="prov-org-slug"
              className={controlCls}
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              autoComplete="off"
            />
          </div>
          <label className={checkRowCls} htmlFor="prov-org-video">
            <input
              id="prov-org-video"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-admin-input text-cyan-500 focus:ring-cyan-500/40"
              checked={orgVideo}
              onChange={(e) => setOrgVideo(e.target.checked)}
            />
            <span>
              <span className="font-medium text-zinc-200">video_clips_enabled</span>
              <span className="mt-0.5 block text-xs font-normal text-zinc-500">Applies to this organization.</span>
            </span>
          </label>
          <div className="flex flex-col gap-3 pt-1 md:col-span-2 md:flex-row md:items-center md:justify-between md:pt-0">
            <span className="hidden text-xs text-zinc-500 md:inline">Creates org + optional slug.</span>
            <button type="submit" className={primaryBtnCls}>
              Create organization
            </button>
          </div>
        </form>
        {orgMsg ? <p className={`${feedbackMessageClass(orgMsg)} mx-5 mb-5 md:mx-6`}>{orgMsg}</p> : null}
      </section>

      <section className={cardCls}>
        <div className="border-b border-white/[0.08] px-5 py-4 md:px-6 md:py-5">
          <h2 className="text-base font-semibold tracking-tight text-zinc-50">Create team</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            Creates a program under the selected organization, then the team. Program name defaults to the team name if
            left blank.
          </p>
        </div>
        <form className="grid gap-5 px-5 py-5 md:grid-cols-2 md:gap-x-6 md:gap-y-5 md:px-6 md:pb-6" onSubmit={submitTeam}>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="prov-team-org">
              Organization
            </label>
            <select
              id="prov-team-org"
              className={selectCls}
              value={teamOrgId}
              onChange={(e) => setTeamOrgId(e.target.value)}
              required
            >
              <option value="">Select organization…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="prov-team-name">
              Team name
            </label>
            <input
              id="prov-team-name"
              className={controlCls}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="prov-team-sport">
              Sport
            </label>
            <input
              id="prov-team-sport"
              className={controlCls}
              value={teamSport}
              onChange={(e) => setTeamSport(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="prov-team-program">
              Program name
            </label>
            <input
              id="prov-team-program"
              className={controlCls}
              value={teamProgramName}
              onChange={(e) => setTeamProgramName(e.target.value)}
              placeholder="Defaults to team name"
            />
            <p className="mt-1.5 text-xs text-zinc-500">Optional — used when the program label should differ from the team.</p>
          </div>
          <label className={checkRowCls} htmlFor="prov-team-video">
            <input
              id="prov-team-video"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-admin-input text-cyan-500 focus:ring-cyan-500/40"
              checked={teamVideo}
              onChange={(e) => setTeamVideo(e.target.checked)}
            />
            <span>
              <span className="font-medium text-zinc-200">video_clips_enabled</span>
              <span className="mt-0.5 block text-xs font-normal text-zinc-500">Team-level toggle; org must allow video when linked via program.</span>
            </span>
          </label>
          <div className="flex flex-col gap-3 pt-1 md:col-span-2 md:flex-row md:items-center md:justify-end md:pt-0">
            <button type="submit" className={primaryBtnCls}>
              Create team
            </button>
          </div>
        </form>
        {teamMsg ? <p className={`${feedbackMessageClass(teamMsg)} mx-5 mb-5 md:mx-6`}>{teamMsg}</p> : null}
      </section>

      <section className={cardCls}>
        <div className="border-b border-white/[0.08] px-5 py-4 md:px-6 md:py-5">
          <h2 className="text-base font-semibold tracking-tight text-zinc-50">Invite user</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            Sends a Supabase invite email. TODO: confirm Auth email templates use your app URL in the dashboard.
          </p>
        </div>
        <form className="px-5 py-5 md:px-6 md:pb-6" onSubmit={submitInvite}>
          <div className="grid gap-5 md:grid-cols-2 md:gap-x-6 md:gap-y-5">
            <div>
              <label className={labelCls} htmlFor="prov-invite-email">
                Email
              </label>
              <input
                id="prov-invite-email"
                type="email"
                className={controlCls}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="prov-invite-name">
                Full name
              </label>
              <input
                id="prov-invite-name"
                className={controlCls}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="prov-invite-role">
                Role
              </label>
              <select
                id="prov-invite-role"
                className={selectCls}
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
              <label className={labelCls} htmlFor="prov-invite-status">
                Account status
              </label>
              <select
                id="prov-invite-status"
                className={selectCls}
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
              <label className={labelCls} htmlFor="prov-invite-team">
                Team <span className="font-normal normal-case text-zinc-500">(optional)</span>
              </label>
              <select
                id="prov-invite-team"
                className={selectCls}
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
              <label className={labelCls} htmlFor="prov-invite-org">
                Organization <span className="font-normal normal-case text-zinc-500">(optional)</span>
              </label>
              <select
                id="prov-invite-org"
                className={selectCls}
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
              <p className="mt-1.5 text-xs text-zinc-500">For records when no team is selected.</p>
            </div>
          </div>

          <label className={`${checkRowCls} mt-5`} htmlFor="prov-invite-video">
            <input
              id="prov-invite-video"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-admin-input text-violet-400 focus:ring-violet-500/40"
              checked={inviteVideo}
              onChange={(e) => setInviteVideo(e.target.checked)}
            />
            <span>
              <span className="font-medium text-zinc-200">Game Video / Clips</span>
              <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                Sets view, upload, create, and share. Refine per user in Accounts.
              </span>
            </span>
          </label>

          <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">Invite link is delivered by email; user sets their own password.</p>
            <button type="submit" className={inviteBtnCls}>
              Send invite
            </button>
          </div>
        </form>
        {inviteMsg ? <p className={`${feedbackMessageClass(inviteMsg)} mx-5 mb-5 md:mx-6`}>{inviteMsg}</p> : null}
      </section>
    </div>
  )
}
