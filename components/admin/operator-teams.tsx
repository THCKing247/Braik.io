"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminTeamStatusForm } from "@/components/admin/admin-team-status-form"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

interface TeamRow {
  id: string
  name: string
  planTier: string | null
  subscriptionStatus: string
  teamStatus: string
  organization: { name: string }
  players: Array<{ id: string }>
  headCoachName: string | null
  coachStaffCount: number
}

function statusChip(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized === "active") return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
  if (normalized === "suspended" || normalized === "terminated") return "bg-red-500/20 text-red-200 border-red-400/40"
  if (normalized === "grace_period" || normalized === "past_due") return "bg-orange-500/20 text-orange-200 border-orange-400/40"
  if (normalized === "cancelled") return "border-slate-500/40 bg-slate-500/15 text-slate-200"
  return "border-white/15 bg-white/[0.06] text-slate-300"
}

export function OperatorTeams({ teams, filterUserId }: { teams: TeamRow[]; filterUserId?: string | null }) {
  const [query, setQuery] = useState("")
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teams
    return teams.filter((team) =>
      `${team.name} ${team.organization.name} ${team.subscriptionStatus} ${team.teamStatus}`.toLowerCase().includes(q)
    )
  }, [teams, query])

  return (
    <div className="space-y-6">
      {filterUserId && (
        <div className={adminUi.noticeInfo}>
          <p className="text-sm text-orange-50/95">
            Showing teams for this user.{" "}
            <Link href={`/admin/users/${filterUserId}`} className={cn(adminUi.link, "underline-offset-2")}>
              View user in Accounts
            </Link>
            {" · "}
            <Link href="/admin/teams" className={cn(adminUi.link, "underline-offset-2")}>
              Show all teams
            </Link>
          </p>
        </div>
      )}
      <AdminPageHeader
        title="Teams"
        description="Subscription status, team flags, and staff counts. Open a team for service controls and AI settings."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter list…"
              className={adminUi.toolbarInput}
            />
            <button type="button" onClick={() => setModalOpen(true)} className={adminUi.btnSecondarySm}>
              Drill-down
            </button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
          <p className="text-xs text-emerald-100/70">Active Teams</p>
          <p className="text-2xl font-semibold text-emerald-100">{teams.filter((t) => t.teamStatus === "active").length}</p>
        </div>
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-100/70">Suspended Teams</p>
          <p className="text-2xl font-semibold text-red-100">{teams.filter((t) => t.teamStatus === "suspended").length}</p>
        </div>
        <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-3">
          <p className="text-xs text-orange-100/70">Past Due / Grace</p>
          <p className="text-2xl font-semibold text-orange-100">
            {teams.filter((t) => ["past_due", "grace_period"].includes(t.subscriptionStatus)).length}
          </p>
        </div>
        <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 p-3">
          <p className="text-xs text-purple-100/70">Cancelled/Terminated</p>
          <p className="text-2xl font-semibold text-purple-100">
            {teams.filter((t) => ["cancelled", "terminated"].includes(t.teamStatus) || ["cancelled", "terminated"].includes(t.subscriptionStatus)).length}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((team) => (
          <div key={team.id} className={cn(adminUi.panel, adminUi.panelPadding)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{team.name}</h3>
                <p className="text-xs text-slate-400">{team.organization.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs", statusChip(team.subscriptionStatus))}>
                    subscription: {team.subscriptionStatus}
                  </span>
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs", statusChip(team.teamStatus))}>
                    team: {team.teamStatus}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Plan: {team.planTier || "starter"} | Roster: {team.players.length} | Head coach:{" "}
                  {team.headCoachName ?? "No head coach assigned"} | Staff (HC/AC): {team.coachStaffCount}
                </p>
                <Link href={`/admin/teams/${team.id}`} className={adminUi.linkSubtle}>
                  View details
                </Link>
              </div>
              <AdminTeamStatusForm teamId={team.id} initialStatus={team.teamStatus} />
            </div>
          </div>
        ))}
      </div>

      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Teams Drill-down"
        summary="Filter/search/action/export operator overlay."
      >
        <div className="space-y-2">
          <div className="grid gap-2 md:grid-cols-4">
            <input className={adminUi.toolbarInput} placeholder="Search" />
            <select className={adminUi.toolbarInput}>
              <option>Bulk action</option>
              <option>Suspend selected</option>
              <option>Restore selected</option>
            </select>
            <button type="button" className={adminUi.btnSecondarySm}>
              Apply
            </button>
            <button type="button" className={adminUi.btnSecondarySm}>
              Export CSV
            </button>
          </div>
          <div className={cn(adminUi.tableWrap, "max-h-[45vh] overflow-y-auto")}>
            <table className={cn(adminUi.table, "min-w-0 text-xs")}>
              <thead className={adminUi.thead}>
                <tr>
                  <th className={adminUi.th}>Team</th>
                  <th className={adminUi.th}>Subscription</th>
                  <th className={adminUi.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className={adminUi.tbodyRow}>
                    <td className={adminUi.td}>{t.name}</td>
                    <td className={adminUi.td}>{t.subscriptionStatus}</td>
                    <td className={adminUi.td}>{t.teamStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminModal>
    </div>
  )
}
