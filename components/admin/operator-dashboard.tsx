"use client"

import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminTimeframeSegment } from "@/components/admin/admin-timeframe-segment"
import type { ProductHealthSnapshot } from "@/lib/admin/product-health-types"
import { adminKpiLabel, adminKpiStatCard, adminKpiValue, adminMetricCard, adminUi } from "@/lib/admin/admin-ui"
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

interface DashboardMetric {
  label: string
  value: number
  color: "red" | "orange" | "yellow" | "green" | "blue" | "purple"
}

interface Props {
  timeframeDays: number
  metrics: {
    totalUsers: number
    activeTeams: number
    suspendedTeams: number
    pastDueTeams: number
    gracePeriodTeams: number
    recentAuditEntries: AuditEntry[]
    productHealth?: ProductHealthSnapshot
  }
}

const metricAccent: Record<DashboardMetric["color"], "sky" | "emerald" | "red" | "orange" | "slate" | "violet"> = {
  red: "red",
  orange: "orange",
  yellow: "slate",
  green: "emerald",
  blue: "sky",
  purple: "violet",
}

export function OperatorDashboard({ timeframeDays, metrics }: Props) {
  const [openModal, setOpenModal] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [action, setAction] = useState("")

  const metricCards: DashboardMetric[] = useMemo(
    () => [
      { label: "Total Users", value: metrics.totalUsers, color: "blue" },
      { label: "Active Teams", value: metrics.activeTeams, color: "green" },
      { label: "Suspended Teams", value: metrics.suspendedTeams, color: "red" },
      { label: "Past Due Teams", value: metrics.pastDueTeams, color: "orange" },
    ],
    [metrics]
  )

  const modalRows = metrics.recentAuditEntries.filter((row) =>
    `${row.action} ${row.actorEmail} ${row.targetType ?? ""} ${row.targetId ?? ""} ${row.metadataSummary ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div className={adminUi.noticeInfo}>
        <p className="font-semibold text-orange-50">Operations snapshot</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-orange-100">
          Suspension and billing risk metrics are centralized for rapid response. Use cards below to drill into details.
        </p>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setOpenModal("suspended")}
          className={adminKpiStatCard("red", true)}
        >
          <p className={adminKpiLabel()}>Suspended teams</p>
          <p className={adminKpiValue()}>{metrics.suspendedTeams}</p>
        </button>
        <button type="button" onClick={() => setOpenModal("grace")} className={adminKpiStatCard("orange", true)}>
          <p className={adminKpiLabel()}>Grace period teams</p>
          <p className={adminKpiValue()}>{metrics.gracePeriodTeams}</p>
        </button>
        <button type="button" onClick={() => setOpenModal("ai-near-limit")} className={adminKpiStatCard("slate", true)}>
          <p className={adminKpiLabel()}>AI near limit</p>
          <p className={adminKpiValue()}>0</p>
        </button>
        <button type="button" onClick={() => setOpenModal("refunds")} className={adminKpiStatCard("sky", true)}>
          <p className={adminKpiLabel()}>Pending refunds</p>
          <p className={adminKpiValue()}>0</p>
        </button>
        <button type="button" onClick={() => setOpenModal("promos")} className={adminKpiStatCard("violet", true)}>
          <p className={adminKpiLabel()}>Pending promo approvals</p>
          <p className={adminKpiValue()}>0</p>
        </button>
      </div>

      <AdminPageHeader
        title="Operator dashboard"
        description="Key counts and trends for the selected window. Audit entries and product health follow the timeframe filter."
        action={<AdminTimeframeSegment value={timeframeDays} />}
      />

      <div className="grid w-full gap-3 md:grid-cols-4">
        {metricCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setOpenModal(card.label)}
            className={cn(adminMetricCard(metricAccent[card.color]), adminUi.panelPadding, "w-full text-left")}
          >
            <p className="text-xs font-medium text-slate-300">{card.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-white">{card.value}</p>
            <p className="mt-2 text-[11px] font-medium text-slate-400">Trend: placeholder +2.4%</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-orange-500"
                style={{ width: `${Math.min(100, Math.max(12, card.value % 100))}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      <div className="grid w-full gap-3 md:grid-cols-2">
        {["User growth", "Team growth", "Revenue (placeholder)", "Suspension trend"].map((title) => (
          <div key={title} className={cn(adminUi.panel, adminUi.panelPadding)}>
            <p className={adminUi.sectionTitle}>{title}</p>
            <div className="mt-3 h-40 rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex h-full items-end gap-1.5">
                {[16, 24, 34, 28, 40, 48, 42, 52, 46, 60].map((h, idx) => (
                  <div key={idx} className="w-full rounded-t bg-slate-700" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {metrics.productHealth ? (
        <div className={cn(adminUi.panel, adminUi.panelPadding)}>
          <h2 className={cn(adminUi.sectionTitle, "text-base")}>Product health</h2>
          <p className="mt-1 text-xs font-medium text-slate-300">
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
                <p className="text-[11px] font-medium text-slate-300">{c.label}</p>
                <p className="text-xl font-semibold tabular-nums text-white">{c.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-medium text-slate-400">
            * Stripe-linked `subscriptions` table; team subscription_status cards above remain source for ops alerts.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className={adminUi.sectionSubtitle}>Profiles by role (non-zero)</p>
              <ul className="mt-2 space-y-1.5 text-xs font-medium text-slate-300">
                {metrics.productHealth.usersByRole.length === 0 ? (
                  <li className="text-slate-400">No profile role counts loaded.</li>
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
              <ul className="mt-2 space-y-1.5 text-xs font-medium text-slate-300">
                {metrics.productHealth.recentSignups.length === 0 ? (
                  <li className="text-slate-400">No recent rows.</li>
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
                <li className="font-medium text-slate-400">No feedback yet.</li>
              ) : (
                metrics.productHealth.recentFeedback.map((f) => (
                  <li key={f.id} className={cn(adminUi.nestedRow, "text-slate-300")}>
                    <span className="font-semibold text-white">{f.category}</span> ·{" "}
                    {new Date(f.createdAt).toLocaleString()}
                    <div className="mt-1 font-medium text-slate-400">{f.preview || "—"}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}

      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h2 className={cn(adminUi.sectionTitle, "text-base")}>Recent audit entries</h2>
        <div className="mt-4 space-y-2">
          {metrics.recentAuditEntries.map((entry) => (
            <div key={entry.id} className={cn(adminUi.nestedRow, "text-xs leading-relaxed")}>
              <div className="font-semibold text-slate-100">
                {entry.action} · {entry.actorEmail}
              </div>
              <div className="mt-0.5 font-medium text-slate-400">{new Date(entry.createdAt).toLocaleString()}</div>
              {(entry.targetType || entry.targetId) && (
                <div className="mt-1 font-medium text-slate-300">
                  {entry.targetType ? `${entry.targetType}` : ""}
                  {entry.targetType && entry.targetId ? " · " : ""}
                  {entry.targetId ? entry.targetId : ""}
                </div>
              )}
              {entry.metadataSummary ? (
                <div className="mt-1 break-all font-mono text-[10px] font-medium text-slate-500">{entry.metadataSummary}</div>
              ) : null}
            </div>
          ))}
          {metrics.recentAuditEntries.length === 0 ? (
            <p className="text-sm font-medium text-slate-400">No recent audit entries.</p>
          ) : null}
        </div>
      </div>

      <AdminModal
        open={!!openModal}
        title={openModal || "Details"}
        summary="Drill-down for card actions: filters, export, and bulk controls."
        onClose={() => setOpenModal(null)}
      >
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={adminUi.toolbarInput}
              placeholder="Search"
            />
            <select value={action} onChange={(event) => setAction(event.target.value)} className={adminUi.toolbarInput}>
              <option value="">Action</option>
              <option value="bulk_suspend">bulk_suspend</option>
              <option value="bulk_restore">bulk_restore</option>
            </select>
            <button type="button" className={adminUi.btnSecondarySm}>
              Bulk action
            </button>
            <button type="button" className={adminUi.btnSecondarySm}>
              Export CSV (stub)
            </button>
          </div>

          <div className={cn(adminUi.tableWrap, "max-h-[45vh] overflow-y-auto")}>
            <table className={cn(adminUi.table, "min-w-0 text-xs")}>
              <thead className={adminUi.thead}>
                <tr>
                  <th className={adminUi.th}>Action</th>
                  <th className={adminUi.th}>Actor</th>
                  <th className={adminUi.th}>Details</th>
                  <th className={adminUi.th}>Time</th>
                </tr>
              </thead>
              <tbody>
                {modalRows.map((row) => (
                  <tr key={row.id} className={adminUi.tbodyRow}>
                    <td className={adminUi.td}>{row.action}</td>
                    <td className={adminUi.td}>{row.actorEmail}</td>
                    <td className={cn(adminUi.td, "break-all text-slate-300")}>
                      {[row.targetType, row.targetId].filter(Boolean).join(" · ") || "—"}
                      {row.metadataSummary ? (
                        <div className="mt-1 font-mono text-[10px] text-slate-500">{row.metadataSummary}</div>
                      ) : null}
                    </td>
                    <td className={cn(adminUi.td, "whitespace-nowrap text-slate-200")}>
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {modalRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm font-medium text-slate-400">
                      No rows for this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </AdminModal>
    </div>
  )
}
