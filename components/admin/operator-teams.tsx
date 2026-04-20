"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminTeamStatusForm } from "@/components/admin/admin-team-status-form"
import type {
  AdminOrganizationDirectoryRow,
  AdminTeamGroup,
  AdminTeamRow,
} from "@/lib/admin/load-admin-teams-grouped"
import { adminKpiLabel, adminKpiStatCard, adminKpiValue, adminOpsTeamStateChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export function OperatorTeams({
  groups,
  organizationDirectory,
  filterUserId,
}: {
  groups: AdminTeamGroup[]
  organizationDirectory: AdminOrganizationDirectoryRow[]
  filterUserId?: string | null
}) {
  const [query, setQuery] = useState("")

  const allTeams = useMemo(() => groups.flatMap((g) => g.teams), [groups])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => ({
        ...g,
        teams: g.teams.filter((team) =>
          `${team.name} ${team.organization.name} ${team.legacyContext ?? ""} ${g.groupTitle} ${team.subscriptionStatus} ${team.teamStatus} ${team.sport ?? ""}`
            .toLowerCase()
            .includes(q)
        ),
      }))
      .filter((g) => g.teams.length > 0)
  }, [groups, query])

  return (
    <div className="space-y-6">
      {filterUserId && (
        <div className={adminUi.noticeInfo}>
          <p className="text-sm font-medium text-amber-950">
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
        title="Organizations & teams"
        description="Organizations are loaded from the organizations table. Teams are grouped under their owning organization (teams.organization_id, or program → organization). School and athletic department appear only as secondary metadata. Open a team for service controls."
        action={
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter list…"
            className={adminUi.toolbarInput}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className={adminKpiStatCard("sky")}>
          <p className={adminKpiLabel()}>Organizations (DB)</p>
          <p className={adminKpiValue()}>{organizationDirectory.length}</p>
        </div>
        <div className={adminKpiStatCard("slate")}>
          <p className={adminKpiLabel()}>Teams (this view)</p>
          <p className={adminKpiValue()}>{allTeams.length}</p>
        </div>
        <div className={adminKpiStatCard("emerald")}>
          <p className={adminKpiLabel()}>Active teams</p>
          <p className={adminKpiValue()}>{allTeams.filter((t) => t.teamStatus === "active").length}</p>
        </div>
        <div className={adminKpiStatCard("red")}>
          <p className={adminKpiLabel()}>Suspended teams</p>
          <p className={adminKpiValue()}>{allTeams.filter((t) => t.teamStatus === "suspended").length}</p>
        </div>
        <div className={adminKpiStatCard("orange")}>
          <p className={adminKpiLabel()}>Past due / grace</p>
          <p className={adminKpiValue()}>
            {allTeams.filter((t) => ["past_due", "grace_period"].includes(t.subscriptionStatus)).length}
          </p>
        </div>
        <div className={adminKpiStatCard("purple")}>
          <p className={adminKpiLabel()}>Cancelled / terminated</p>
          <p className={adminKpiValue()}>
            {allTeams.filter(
              (t) =>
                ["cancelled", "terminated"].includes(t.teamStatus) ||
                ["cancelled", "terminated"].includes(t.subscriptionStatus)
            ).length}
          </p>
        </div>
      </div>

      <section className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h2 className={cn(adminUi.sectionTitle, "text-base")}>Organizations</h2>
        <p className="mt-1 text-xs font-medium text-admin-secondary">
          All organization records ({organizationDirectory.length}). Team counts reflect teams whose resolved owner is that
          organization (resolved ownership for this list only).
        </p>
        {organizationDirectory.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-admin-muted">No organizations in the database.</p>
        ) : (
          <div className={cn(adminUi.tableWrap, "mt-3")}>
            <table className={cn(adminUi.table, "min-w-0 text-sm")}>
              <thead className={adminUi.thead}>
                <tr>
                  <th className={adminUi.th}>Organization</th>
                  <th className={cn(adminUi.th, "text-right")}>Teams owned</th>
                </tr>
              </thead>
              <tbody>
                {organizationDirectory.map((o) => (
                  <tr key={o.id} className={adminUi.tbodyRow}>
                    <td className={cn(adminUi.td, "font-medium text-admin-primary")}>{o.name}</td>
                    <td className={cn(adminUi.td, "text-right tabular-nums")}>{o.teamCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="space-y-8">
        <h2 className={cn(adminUi.sectionTitle, "text-base")}>Teams by organization</h2>
        {groups.length === 0 && !filterUserId ? (
          <div className={cn(adminUi.noticeMuted, "text-sm")}>
            No team rows were returned for this page. If you expected teams here, check server logs for{" "}
            <span className="font-mono text-[11px]">loadAdminTeamsGrouped:teams_query_error</span> (a failed select
            often returns empty data without throwing) or confirm the <span className="font-mono text-[11px]">userId</span>{" "}
            filter is not hiding staff who only appear in <span className="font-mono text-[11px]">team_members</span>.
          </div>
        ) : null}
        {filteredGroups.map((group) => (
          <section key={group.groupKey} className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold text-admin-primary">{group.groupTitle}</h2>
              {group.groupHint ? <p className="text-xs font-medium text-admin-muted">{group.groupHint}</p> : null}
            </div>
            <div className="divide-y divide-admin-border overflow-hidden rounded-lg border border-admin-border bg-admin-surface">
              {group.teams.map((team) => (
                <TeamRow key={team.id} team={team} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <p className="text-sm font-medium text-admin-muted">No teams match the current filters.</p>
      ) : null}
    </div>
  )
}

function TeamRow({ team }: { team: AdminTeamRow }) {
  const ownerLabel =
    team.ownershipSource === "team_organization_id"
      ? "Owner: team.organization_id"
      : team.ownershipSource === "program_organization_id"
        ? "Owner: program → organization"
        : team.ownershipSource === "organization_athletic_department"
          ? "Owner: inferred — unique organization for this athletic department"
          : team.ownershipSource === "organization_school"
            ? "Owner: inferred — unique organization for this school"
            : "Owner: unassigned / legacy — see section header"
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-admin-primary">{team.name}</h3>
        <p className="text-xs font-medium text-admin-secondary">
          <span className="text-admin-primary">{team.organization.name || "—"}</span>
          {team.organization.id ? (
            <span className="ml-1 font-mono text-[11px] text-admin-muted">({team.organization.id.slice(0, 8)}…)</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-admin-muted">{ownerLabel}</p>
        {team.legacyContext ? (
          <p className="mt-1 text-[11px] font-medium text-amber-900/90 dark:text-amber-200/90">
            Secondary: {team.legacyContext}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={cn(adminOpsTeamStateChip(team.subscriptionStatus))}>subscription: {team.subscriptionStatus}</span>
          <span className={cn(adminOpsTeamStateChip(team.teamStatus))}>team: {team.teamStatus}</span>
        </div>
        <p className="mt-1.5 text-xs font-medium text-admin-secondary">
          Plan: {team.planTier || "starter"} | Level: {team.teamLevel ?? "—"} | Sport: {team.sport ?? "—"} | Created:{" "}
          {new Date(team.createdAt).toLocaleDateString()}
          {" | "}
          Head coach: {team.headCoachName ?? "—"} | Staff (HC/AC): {team.coachStaffCount}
        </p>
        <Link href={`/admin/teams/${team.id}`} className={cn(adminUi.linkSubtle, "mt-1 inline-block")}>
          View details
        </Link>
      </div>
      <AdminTeamStatusForm teamId={team.id} initialStatus={team.teamStatus} />
    </div>
  )
}
