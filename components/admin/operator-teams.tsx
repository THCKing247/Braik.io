"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminTeamStatusForm } from "@/components/admin/admin-team-status-form"
import { adminKpiLabel, adminKpiStatCard, adminKpiValue, adminOpsTeamStateChip, adminUi } from "@/lib/admin/admin-ui"
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
          <p className="text-sm font-medium text-orange-50">
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
        <div className={adminKpiStatCard("emerald")}>
          <p className={adminKpiLabel()}>Active teams</p>
          <p className={adminKpiValue()}>{teams.filter((t) => t.teamStatus === "active").length}</p>
        </div>
        <div className={adminKpiStatCard("red")}>
          <p className={adminKpiLabel()}>Suspended teams</p>
          <p className={adminKpiValue()}>{teams.filter((t) => t.teamStatus === "suspended").length}</p>
        </div>
        <div className={adminKpiStatCard("orange")}>
          <p className={adminKpiLabel()}>Past due / grace</p>
          <p className={adminKpiValue()}>
            {teams.filter((t) => ["past_due", "grace_period"].includes(t.subscriptionStatus)).length}
          </p>
        </div>
        <div className={adminKpiStatCard("purple")}>
          <p className={adminKpiLabel()}>Cancelled / terminated</p>
          <p className={adminKpiValue()}>
            {teams.filter((t) => ["cancelled", "terminated"].includes(t.teamStatus) || ["cancelled", "terminated"].includes(t.subscriptionStatus)).length}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((team) => (
          <div key={team.id} className={cn(adminUi.panel, adminUi.panelPadding)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{team.name}</h3>
                <p className="text-xs font-medium text-slate-300">{team.organization.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={cn(adminOpsTeamStateChip(team.subscriptionStatus))}>subscription: {team.subscriptionStatus}</span>
                  <span className={cn(adminOpsTeamStateChip(team.teamStatus))}>team: {team.teamStatus}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-300">
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
