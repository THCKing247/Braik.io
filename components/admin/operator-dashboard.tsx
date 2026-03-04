"use client"

import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"

interface AuditEntry {
  id: string
  action: string
  createdAt: string
  actorEmail: string
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
  }
}

const colorMap = {
  red: "border-red-400/40 bg-red-500/10 text-red-100",
  orange: "border-orange-400/40 bg-orange-500/10 text-orange-100",
  yellow: "border-yellow-400/40 bg-yellow-500/10 text-yellow-100",
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
    `${row.action} ${row.actorEmail}`.toLowerCase().includes(search.toLowerCase())
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
        <button onClick={() => setOpenModal("ai-near-limit")} className="rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-3 text-left">
          <p className="text-xs text-yellow-100/80">AI Near Limit</p>
          <p className="text-xl font-semibold text-yellow-100">0</p>
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
            <div className="mt-2 h-6 w-full rounded bg-black/25">
              <div className="h-6 rounded bg-white/25" style={{ width: `${Math.min(100, Math.max(20, card.value % 100))}%` }} />
            </div>
          </button>
        ))}
      </div>

      <div className="grid w-full gap-3 md:grid-cols-2">
        {["User Growth", "Team Growth", "Revenue Trend (placeholder)", "Suspension Trend"].map((title) => (
          <div key={title} className="rounded-xl border border-white/10 bg-[#18181c] p-4">
            <p className="text-sm font-semibold">{title}</p>
            <div className="mt-3 h-40 rounded bg-black/30 p-3">
              <div className="flex h-full items-end gap-2">
                {[16, 24, 34, 28, 40, 48, 42, 52, 46, 60].map((h, idx) => (
                  <div key={idx} className="w-full rounded-t bg-sky-400/60" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <h3 className="text-lg font-semibold">Recent Audit Entries</h3>
        <div className="mt-3 space-y-2">
          {metrics.recentAuditEntries.map((entry) => (
            <div key={entry.id} className="rounded border border-white/10 bg-black/25 p-2 text-xs">
              {entry.action} - {entry.actorEmail} - {new Date(entry.createdAt).toLocaleString()}
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
              className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
              placeholder="Search"
            />
            <select value={action} onChange={(event) => setAction(event.target.value)} className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs">
              <option value="">Action</option>
              <option value="bulk_suspend">bulk_suspend</option>
              <option value="bulk_restore">bulk_restore</option>
            </select>
            <button className="rounded bg-white/10 px-3 py-1 text-xs">Bulk Action</button>
            <button className="rounded bg-white/10 px-3 py-1 text-xs">Export CSV (stub)</button>
          </div>

          <div className="max-h-[45vh] overflow-y-auto rounded border border-white/10">
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
                    <td className="px-2 py-2">{row.action}</td>
                    <td className="px-2 py-2">{row.actorEmail}</td>
                    <td className="px-2 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {modalRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center text-white/70">
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
