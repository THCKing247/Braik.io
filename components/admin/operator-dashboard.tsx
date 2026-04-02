"use client"

import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import type { ProductHealthSnapshot } from "@/lib/admin/product-health-types"

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
  yellow: "border-white/[0.12] bg-admin-nested text-zinc-300",
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
    <div className="space-y-5">
      <div className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
        <p className="font-semibold">Operator Alert Strip</p>
        <p className="text-xs text-purple-100/80">Admin overrides and suspension metrics are now centralized for rapid response.</p>
      </div>

      <div className="grid w-full gap-3 md:grid-cols-5">
        <button onClick={() => setOpenModal("suspended")} className="rounded border border-red-500/30 bg-red-500/10 px-3 py-3 text-left">
          <p className="text-xs text-red-100/80">Suspended Teams</p>
          <p className="text-xl font-semibold text-red-100">{metrics.suspendedTeams}</p>
        </button>
        <button onClick={() => setOpenModal("grace")} className="rounded border border-orange-500/30 bg-orange-500/10 px-3 py-3 text-left">
          <p className="text-xs text-orange-100/80">Grace Period Teams</p>
          <p className="text-xl font-semibold text-orange-100">{metrics.gracePeriodTeams}</p>
        </button>
        <button onClick={() => setOpenModal("ai-near-limit")} className="rounded border border-white/[0.1] bg-admin-nested px-3 py-3 text-left">
          <p className="text-xs text-zinc-400">AI Near Limit</p>
          <p className="text-xl font-semibold text-zinc-200">0</p>
        </button>
        <button onClick={() => setOpenModal("refunds")} className="rounded border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-left">
          <p className="text-xs text-sky-100/80">Pending Refunds</p>
          <p className="text-xl font-semibold text-sky-100">0</p>
        </button>
        <button onClick={() => setOpenModal("promos")} className="rounded border border-purple-500/30 bg-purple-500/10 px-3 py-3 text-left">
          <p className="text-xs text-purple-100/80">Pending Promo Approvals</p>
          <p className="text-xl font-semibold text-purple-100">0</p>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Operator Dashboard</h2>
        <form method="get" className="flex gap-2 text-xs">
          {[7, 30, 90, 365].map((days) => (
            <button
              key={days}
              name="tf"
              value={days}
              className={`rounded px-3 py-1 ${timeframeDays === days ? "bg-white text-black" : "bg-white/10 text-white/80"}`}
            >
              {days === 365 ? "1yr" : `${days}d`}
            </button>
          ))}
        </form>
      </div>

      <div className="grid w-full gap-3 md:grid-cols-4">
        {metricCards.map((card) => (
          <button
            key={card.label}
            onClick={() => setOpenModal(card.label)}
            className={`w-full rounded-xl border p-4 text-left ${colorMap[card.color]}`}
          >
            <p className="text-xs opacity-80">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{card.value}</p>
            <p className="mt-1 text-[11px] opacity-75">Trend: placeholder +2.4%</p>
            <div className="mt-2 h-6 w-full rounded bg-admin-nested">
              <div className="h-6 rounded bg-white/25" style={{ width: `${Math.min(100, Math.max(20, card.value % 100))}%` }} />
            </div>
          </button>
        ))}
      </div>

      <div className="grid w-full gap-3 md:grid-cols-2">
        {["User Growth", "Team Growth", "Revenue Trend (placeholder)", "Suspension Trend"].map((title) => (
          <div key={title} className="rounded-xl border border-white/[0.08] bg-admin-card shadow-admin-card p-4">
            <p className="text-sm font-semibold">{title}</p>
            <div className="mt-3 h-40 rounded bg-admin-input p-3">
              <div className="flex h-full items-end gap-2">
                {[16, 24, 34, 28, 40, 48, 42, 52, 46, 60].map((h, idx) => (
                  <div key={idx} className="w-full rounded-t bg-sky-400/60" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {metrics.productHealth ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4">
          <h3 className="text-lg font-semibold text-emerald-100">Product health (Phase 7)</h3>
          <p className="mt-1 text-xs text-emerald-100/70">
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
              <div key={c.label} className="rounded-lg border border-white/[0.08] bg-admin-nested px-3 py-2">
                <p className="text-[11px] text-white/60">{c.label}</p>
                <p className="text-xl font-semibold text-white">{c.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-white/50">* Stripe-linked `subscriptions` table; team subscription_status cards above remain source for ops alerts.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-white">Profiles by role (non-zero)</p>
              <ul className="mt-2 space-y-1 text-xs text-white/80">
                {metrics.productHealth.usersByRole.length === 0 ? (
                  <li className="text-white/50">No profile role counts loaded.</li>
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
              <p className="text-sm font-semibold text-white">Recent signups (profiles)</p>
              <ul className="mt-2 space-y-1 text-xs text-white/80">
                {metrics.productHealth.recentSignups.length === 0 ? (
                  <li className="text-white/50">No recent rows.</li>
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
            <p className="text-sm font-semibold text-white">Latest feedback</p>
            <ul className="mt-2 space-y-2 text-xs text-white/80">
              {metrics.productHealth.recentFeedback.length === 0 ? (
                <li className="text-white/50">No feedback yet.</li>
              ) : (
                metrics.productHealth.recentFeedback.map((f) => (
                  <li key={f.id} className="rounded border border-white/[0.08] bg-admin-nested p-2">
                    <span className="font-semibold text-white/90">{f.category}</span> ·{" "}
                    {new Date(f.createdAt).toLocaleString()}
                    <div className="mt-1 text-white/70">{f.preview || "—"}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/[0.08] bg-admin-card shadow-admin-card p-4">
        <h3 className="text-lg font-semibold">Recent Audit Entries</h3>
        <div className="mt-3 space-y-2">
          {metrics.recentAuditEntries.map((entry) => (
            <div key={entry.id} className="rounded border border-white/[0.08] bg-admin-nested p-2 text-xs leading-relaxed">
              <div className="font-medium text-white/95">
                {entry.action} · {entry.actorEmail}
              </div>
              <div className="mt-0.5 text-white/60">{new Date(entry.createdAt).toLocaleString()}</div>
              {(entry.targetType || entry.targetId) && (
                <div className="mt-1 text-white/55">
                  {entry.targetType ? `${entry.targetType}` : ""}
                  {entry.targetType && entry.targetId ? " · " : ""}
                  {entry.targetId ? entry.targetId : ""}
                </div>
              )}
              {entry.metadataSummary ? (
                <div className="mt-1 font-mono text-[10px] text-white/45 break-all">{entry.metadataSummary}</div>
              ) : null}
            </div>
          ))}
          {metrics.recentAuditEntries.length === 0 ? <p className="text-sm text-white/70">No recent audit entries.</p> : null}
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
              className="rounded border border-white/[0.08] bg-admin-input px-2 py-1 text-xs"
              placeholder="Search"
            />
            <select value={action} onChange={(event) => setAction(event.target.value)} className="rounded border border-white/[0.08] bg-admin-input px-2 py-1 text-xs">
              <option value="">Action</option>
              <option value="bulk_suspend">bulk_suspend</option>
              <option value="bulk_restore">bulk_restore</option>
            </select>
            <button className="rounded bg-white/10 px-3 py-1 text-xs">Bulk Action</button>
            <button className="rounded bg-white/10 px-3 py-1 text-xs">Export CSV (stub)</button>
          </div>

          <div className="max-h-[45vh] overflow-y-auto rounded border border-white/[0.08]">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {modalRows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-2 py-2 align-top">{row.action}</td>
                    <td className="px-2 py-2 align-top">{row.actorEmail}</td>
                    <td className="px-2 py-2 align-top break-all text-white/70">
                      {[row.targetType, row.targetId].filter(Boolean).join(" · ") || "—"}
                      {row.metadataSummary ? (
                        <div className="mt-1 font-mono text-[10px] text-white/50">{row.metadataSummary}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 align-top whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {modalRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-center text-white/70">
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
