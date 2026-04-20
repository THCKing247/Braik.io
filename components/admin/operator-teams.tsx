"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminTeamStatusForm } from "@/components/admin/admin-team-status-form"
import type { AdminTeamGroup, AdminTeamRow } from "@/lib/admin/load-admin-teams-grouped"
import { adminKpiLabel, adminKpiStatCard, adminKpiValue, adminOpsTeamStateChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export function OperatorTeams({
  groups,
  filterUserId,
}: {
  groups: AdminTeamGroup[]
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
          `${team.name} ${team.organization.name} ${g.groupTitle} ${team.subscriptionStatus} ${team.teamStatus} ${team.sport ?? ""}`
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
        title="Teams"
        description="All teams from Supabase, grouped by organization, school, or program. Open a team for service controls and AI settings."
        action={
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter list…"
            className={adminUi.toolbarInput}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
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

      <div className="space-y-8">
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
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-admin-primary">{team.name}</h3>
        <p className="text-xs font-medium text-admin-secondary">{team.organization.name || "—"}</p>
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
