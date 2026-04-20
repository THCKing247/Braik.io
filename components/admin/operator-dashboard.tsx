"use client"

import Link from "next/link"
import { useMemo } from "react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminTimeframeSegment } from "@/components/admin/admin-timeframe-segment"
import type { ProductHealthSnapshot } from "@/lib/admin/product-health-types"
import { adminKpiLabel, adminKpiStatCard, adminKpiValue, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

interface AuditEntry {
  id: string
  action: string
  createdAt: string
  actorEmail: string
  targetType?: string | null
  targetId?: string | null
  metadataSummary?: string | null
}

interface Props {
  timeframeDays: number
  metrics: {
    totalUsers: number
    activeTeams: number
    suspendedTeams: number
    pastDueTeams: number
    gracePeriodTeams: number
    auditEntriesTotalInWindow: number
    recentAuditEntries: AuditEntry[]
    productHealth?: ProductHealthSnapshot
  }
}

export function OperatorDashboard({ timeframeDays, metrics }: Props) {
  const actionMix = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of metrics.recentAuditEntries) {
      m.set(e.action, (m.get(e.action) ?? 0) + 1)
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  }, [metrics.recentAuditEntries])

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Overview"
        description={`Platform snapshot. Team counts are current totals. Audit totals and the list below use the selected period (last ${timeframeDays} days).`}
        action={<AdminTimeframeSegment value={timeframeDays} />}
      />

      <section aria-label="Key metrics">
        <p className="mb-3 text-xs font-medium text-admin-muted">Totals — open a destination to act</p>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Link href="/admin/users" className={cn(adminKpiStatCard("sky", true), "no-underline")}>
            <p className={adminKpiLabel()}>Total users</p>
            <p className={adminKpiValue()}>{metrics.totalUsers}</p>
          </Link>
          <Link href="/admin/teams" className={cn(adminKpiStatCard("emerald", true), "no-underline")}>
            <p className={adminKpiLabel()}>Active teams</p>
            <p className={adminKpiValue()}>{metrics.activeTeams}</p>
          </Link>
          <Link href="/admin/teams" className={cn(adminKpiStatCard("red", true), "no-underline")}>
            <p className={adminKpiLabel()}>Suspended teams</p>
            <p className={adminKpiValue()}>{metrics.suspendedTeams}</p>
          </Link>
          <Link href="/admin/teams" className={cn(adminKpiStatCard("orange", true), "no-underline")}>
            <p className={adminKpiLabel()}>Past due (subscription)</p>
            <p className={adminKpiValue()}>{metrics.pastDueTeams}</p>
          </Link>
          <Link href="/admin/teams" className={cn(adminKpiStatCard("slate", true), "no-underline")}>
            <p className={adminKpiLabel()}>Grace period (subscription)</p>
            <p className={adminKpiValue()}>{metrics.gracePeriodTeams}</p>
          </Link>
        </div>
      </section>

      <div className="grid w-full gap-6 lg:grid-cols-2 lg:gap-10">
        <div className={cn(adminUi.panel, adminUi.panelPadding)}>
          <h2 className={cn(adminUi.sectionTitle, "text-base")}>Audit activity</h2>
          <p className="mt-1 text-xs font-medium text-admin-secondary">
            <span className="font-semibold text-admin-primary">{metrics.auditEntriesTotalInWindow.toLocaleString()}</span>{" "}
            events in the selected window ({timeframeDays}d). Below are up to 25 of the most recent.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/audit" className={cn(adminUi.btnSecondarySm, "no-underline")}>
              Open full audit log
            </Link>
          </div>
          {actionMix.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold text-admin-secondary">Action mix in this sample (latest 25 entries)</p>
              <div className={cn(adminUi.tableWrap, "mt-2")}>
                <table className={cn(adminUi.table, "min-w-0 text-xs")}>
                  <thead className={adminUi.thead}>
                    <tr>
                      <th className={adminUi.th}>Action</th>
                      <th className={cn(adminUi.th, "text-right")}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionMix.map(([action, count]) => (
                      <tr key={action} className={adminUi.tbodyRow}>
                        <td className={cn(adminUi.td, "font-mono")}>{action}</td>
                        <td className={cn(adminUi.td, "text-right tabular-nums")}>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm font-medium text-admin-muted">No audit entries in this window.</p>
          )}
        </div>

        <div className="space-y-3 pt-1">
          <h2 className={cn(adminUi.sectionTitle, "text-base")}>Shortcuts</h2>
          <p className="text-xs font-medium text-admin-secondary">
            Jump to common admin surfaces. Team subscription and status fields are visible on the Teams list and team detail
            pages.
          </p>
          <ul className="mt-3 space-y-2 text-sm font-medium text-admin-primary">
            <li>
              <Link href="/admin/teams" className={adminUi.link}>
                Teams
              </Link>
              <span className="text-admin-muted"> — roster, subscription, suspensions</span>
            </li>
            <li>
              <Link href="/admin/users" className={adminUi.link}>
                Accounts
              </Link>
              <span className="text-admin-muted"> — users and platform roles</span>
            </li>
            <li>
              <Link href="/admin/audit" className={adminUi.link}>
                Audit log
              </Link>
              <span className="text-admin-muted"> — full history and filters</span>
            </li>
            <li>
              <Link href="/admin/provisioning" className={adminUi.link}>
                Onboarding
              </Link>
              <span className="text-admin-muted"> — orgs, teams, invites</span>
            </li>
          </ul>
        </div>
      </div>

      {metrics.productHealth ? (
        <div className={cn(adminUi.panel, adminUi.panelPadding)}>
          <h2 className={cn(adminUi.sectionTitle, "text-base")}>Product health</h2>
          <p className="mt-1 text-xs font-medium text-admin-secondary">
            Counts use the same timeframe as audit ({timeframeDays}d) where noted. Orgs / programs / playbooks are totals.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Organizations", value: metrics.productHealth.organizations },
              { label: "Programs", value: metrics.productHealth.programs },
              { label: "Teams w/ roster cap", value: metrics.productHealth.teamsWithRosterCap },
              { label: "Playbooks (all)", value: metrics.productHealth.playbooksTotal },
              { label: "Coach B events (window)", value: metrics.productHealth.coachBEventsInWindow },
              { label: "Feedback (window)", value: metrics.productHealth.feedbackInWindow },
              { label: "Active injuries", value: metrics.productHealth.injuriesActive },
              { label: "Threads touched (window)", value: metrics.productHealth.threadsTouchedInWindow },
              { label: "Messages (window)", value: metrics.productHealth.messagesInWindow },
              { label: "Subscriptions active*", value: metrics.productHealth.subscriptionsActive },
              { label: "Subscriptions past_due*", value: metrics.productHealth.subscriptionsPastDue },
              { label: "Reminder queue pending", value: metrics.productHealth.remindersPending },
            ].map((c) => (
              <div key={c.label} className={cn(adminUi.nestedRow)}>
                <p className="text-[11px] font-medium text-admin-muted">{c.label}</p>
                <p className="text-xl font-semibold tabular-nums text-admin-primary">{c.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-medium text-admin-muted">
            * Stripe-linked `subscriptions` table; team subscription fields on Teams remain the primary ops view.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className={adminUi.sectionSubtitle}>Profiles by role (non-zero)</p>
              <ul className="mt-2 space-y-1.5 text-xs font-medium text-admin-secondary">
                {metrics.productHealth.usersByRole.length === 0 ? (
                  <li className="text-admin-muted">No profile role counts loaded.</li>
                ) : (
                  metrics.productHealth.usersByRole.map((r) => (
                    <li key={r.role}>
                      {r.role}: {r.count}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <p className={adminUi.sectionSubtitle}>Recent signups (profiles)</p>
              <ul className="mt-2 space-y-1.5 text-xs font-medium text-admin-secondary">
                {metrics.productHealth.recentSignups.length === 0 ? (
                  <li className="text-admin-muted">No recent rows.</li>
                ) : (
                  metrics.productHealth.recentSignups.map((s) => (
                    <li key={s.id}>
                      {s.label} — {new Date(s.createdAt).toLocaleDateString()}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          <div className="mt-6">
            <p className={adminUi.sectionSubtitle}>Latest feedback</p>
            <ul className="mt-2 space-y-2 text-xs">
              {metrics.productHealth.recentFeedback.length === 0 ? (
                <li className="font-medium text-admin-muted">No feedback yet.</li>
              ) : (
                metrics.productHealth.recentFeedback.map((f) => (
                  <li key={f.id} className={cn(adminUi.nestedRow, "text-admin-secondary")}>
                    <span className="font-semibold text-admin-primary">{f.category}</span> ·{" "}
                    {new Date(f.createdAt).toLocaleString()}
                    <div className="mt-1 font-medium text-admin-muted">{f.preview || "—"}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}

      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h2 className={cn(adminUi.sectionTitle, "text-base")}>Recent audit entries</h2>
        <p className="mt-1 text-xs font-medium text-admin-muted">
          Newest first in the selected window (max 25 shown here).
        </p>
        <div className="mt-4 space-y-2">
          {metrics.recentAuditEntries.map((entry) => (
            <div key={entry.id} className={cn(adminUi.nestedRow, "text-xs leading-relaxed")}>
              <div className="font-semibold text-admin-primary">
                {entry.action} · {entry.actorEmail}
              </div>
              <div className="mt-0.5 font-medium text-admin-muted">{new Date(entry.createdAt).toLocaleString()}</div>
              {(entry.targetType || entry.targetId) && (
                <div className="mt-1 font-medium text-admin-secondary">
                  {entry.targetType ? `${entry.targetType}` : ""}
                  {entry.targetType && entry.targetId ? " · " : ""}
                  {entry.targetId ? entry.targetId : ""}
                </div>
              )}
              {entry.metadataSummary ? (
                <div className="mt-1 break-all font-mono text-[10px] font-medium text-admin-muted">{entry.metadataSummary}</div>
              ) : null}
            </div>
          ))}
          {metrics.recentAuditEntries.length === 0 ? (
            <p className="text-sm font-medium text-admin-muted">No audit entries in this window.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
