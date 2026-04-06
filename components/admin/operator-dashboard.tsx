"use client"

import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import type { ProductHealthSnapshot } from "@/lib/admin/product-health-types"
import { adminUi } from "@/lib/admin/admin-ui"
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

const colorMap = {
  red: "border-red-400/40 bg-red-500/10 text-red-100",
  orange: "border-orange-400/40 bg-orange-500/10 text-orange-100",
  yellow: "border-slate-500/35 bg-slate-800/40 text-slate-200",
  green: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  blue: "border-sky-400/40 bg-sky-500/10 text-sky-100",
  purple: "border-purple-400/40 bg-purple-500/10 text-purple-100",
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
    <div className="space-y-6">
      <div className={adminUi.noticeInfo}>
        <p className="font-semibold text-orange-50">Operations snapshot</p>
        <p className="mt-0.5 text-xs text-orange-100/80">
          Suspension and billing risk metrics are centralized for rapid response. Drill into cards for details.
        </p>
      </div>

      <div className="grid w-full gap-3 md:grid-cols-5">
        <button
          type="button"
          onClick={() => setOpenModal("suspended")}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-left transition-colors hover:bg-red-500/15"
        >
          <p className="text-xs text-red-100/80">Suspended Teams</p>
          <p className="text-xl font-semibold text-red-100">{metrics.suspendedTeams}</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenModal("grace")}
          className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-3 text-left transition-colors hover:bg-orange-500/15"
        >
          <p className="text-xs text-orange-100/80">Grace Period Teams</p>
          <p className="text-xl font-semibold text-orange-100">{metrics.gracePeriodTeams}</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenModal("ai-near-limit")}
          className="rounded-xl border border-slate-500/30 bg-slate-800/40 px-3 py-3 text-left transition-colors hover:bg-slate-800/60"
        >
          <p className="text-xs text-slate-300/90">AI Near Limit</p>
          <p className="text-xl font-semibold text-slate-100">0</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenModal("refunds")}
          className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-left transition-colors hover:bg-sky-500/15"
        >
          <p className="text-xs text-sky-100/80">Pending Refunds</p>
          <p className="text-xl font-semibold text-sky-100">0</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenModal("promos")}
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-3 text-left transition-colors hover:bg-violet-500/15"
        >
          <p className="text-xs text-violet-100/80">Pending Promo Approvals</p>
          <p className="text-xl font-semibold text-violet-100">0</p>
        </button>
      </div>

      <AdminPageHeader
        title="Operator dashboard"
        description="Key counts and trends for the selected window. Audit entries and product health update with the timeframe filter."
        action={
          <form method="get" className="flex flex-wrap gap-2">
            {[7, 30, 90, 365].map((days) => (
              <button
                key={days}
                type="submit"
                name="tf"
                value={days}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                  timeframeDays === days
                    ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                    : "border border-white/15 bg-white/[0.06] text-slate-300 hover:bg-white/10"
                )}
              >
                {days === 365 ? "1yr" : `${days}d`}
              </button>
            ))}
          </form>
        }
      />

      <div className="grid w-full gap-3 md:grid-cols-4">
        {metricCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setOpenModal(card.label)}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-colors hover:brightness-110",
              colorMap[card.color]
            )}
          >
            <p className="text-xs opacity-80">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{card.value}</p>
            <p className="mt-1 text-[11px] opacity-75">Trend: placeholder +2.4%</p>
            <div className="mt-2 h-6 w-full rounded bg-black/25">
              <div className="h-6 rounded bg-white/25" style={{ width: `${Math.min(100, Math.max(20, card.value % 100))}%` }} />
            </div>
          </button>
        ))}
      </div>

      <div className="grid w-full gap-3 md:grid-cols-2">
        {["User Growth", "Team Growth", "Revenue Trend (placeholder)", "Suspension Trend"].map((title) => (
          <div key={title} className={cn(adminUi.panel, adminUi.panelPadding)}>
            <p className="text-sm font-semibold text-white">{title}</p>
            <div className="mt-3 h-40 rounded-xl bg-black/25 p-3 ring-1 ring-inset ring-white/[0.06]">
              <div className="flex h-full items-end gap-2">
                {[16, 24, 34, 28, 40, 48, 42, 52, 46, 60].map((h, idx) => (
                  <div key={idx} className="w-full rounded-t bg-orange-500/50" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {metrics.productHealth ? (
        <div className={cn(adminUi.panel, adminUi.panelPadding, "border-emerald-500/20 bg-emerald-950/20")}>
          <h3 className="font-athletic text-lg font-bold uppercase tracking-wide text-emerald-100/95">
            Product health
          </h3>
          <p className="mt-1 text-xs text-emerald-100/75">
            Counts use the same timeframe filter as audit ({timeframeDays}d) where noted. Orgs/programs/playbooks are
            totals.
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
              <div key={c.label} className="rounded-xl border border-white/[0.06] bg-[#060a12]/60 px-3 py-2">
                <p className="text-[11px] text-slate-400">{c.label}</p>
                <p className="text-xl font-semibold text-white">{c.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            * Stripe-linked `subscriptions` table; team subscription_status cards above remain source for ops alerts.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-200">Profiles by role (non-zero)</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {metrics.productHealth.usersByRole.length === 0 ? (
                  <li className="text-slate-500">No profile role counts loaded.</li>
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
              <p className="text-sm font-semibold text-slate-200">Recent signups (profiles)</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {metrics.productHealth.recentSignups.length === 0 ? (
                  <li className="text-slate-500">No recent rows.</li>
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
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-200">Latest feedback</p>
            <ul className="mt-2 space-y-2 text-xs text-slate-300">
              {metrics.productHealth.recentFeedback.length === 0 ? (
                <li className="text-slate-500">No feedback yet.</li>
              ) : (
                metrics.productHealth.recentFeedback.map((f) => (
                  <li key={f.id} className="rounded-xl border border-white/[0.06] bg-[#060a12]/50 p-3">
                    <span className="font-semibold text-slate-100">{f.category}</span> ·{" "}
                    {new Date(f.createdAt).toLocaleString()}
                    <div className="mt-1 text-slate-400">{f.preview || "—"}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}

      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h3 className="font-athletic text-lg font-bold uppercase tracking-wide text-white">Recent audit entries</h3>
        <div className="mt-3 space-y-2">
          {metrics.recentAuditEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-white/[0.06] bg-[#060a12]/50 p-3 text-xs leading-relaxed"
            >
              <div className="font-medium text-slate-100">
                {entry.action} · {entry.actorEmail}
              </div>
              <div className="mt-0.5 text-slate-500">{new Date(entry.createdAt).toLocaleString()}</div>
              {(entry.targetType || entry.targetId) && (
                <div className="mt-1 text-slate-400">
                  {entry.targetType ? `${entry.targetType}` : ""}
                  {entry.targetType && entry.targetId ? " · " : ""}
                  {entry.targetId ? entry.targetId : ""}
                </div>
              )}
              {entry.metadataSummary ? (
                <div className="mt-1 break-all font-mono text-[10px] text-slate-500">{entry.metadataSummary}</div>
              ) : null}
            </div>
          ))}
          {metrics.recentAuditEntries.length === 0 ? (
            <p className="text-sm text-slate-400">No recent audit entries.</p>
          ) : null}
        </div>
      </div>

      <AdminModal
        open={!!openModal}
        title={openModal || "Details"}
        summary="Drill-down modal for card/badge actions with filters, export, and bulk controls."
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
              Bulk Action
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
                    <td className={cn(adminUi.td, "break-all text-slate-400")}>
                      {[row.targetType, row.targetId].filter(Boolean).join(" · ") || "—"}
                      {row.metadataSummary ? (
                        <div className="mt-1 font-mono text-[10px] text-slate-500">{row.metadataSummary}</div>
                      ) : null}
                    </td>
                    <td className={cn(adminUi.td, "whitespace-nowrap text-slate-300")}>
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {modalRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
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
