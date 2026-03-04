"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { AdminTeamStatusForm } from "@/components/admin-team-status-form"

interface TeamRow {
  id: string
  name: string
  planTier: string | null
  subscriptionStatus: string
  teamStatus: string
  organization: { name: string }
  players: Array<{ id: string }>
  memberships: Array<{ userId: string }>
}

function statusChip(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized === "active") return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
  if (normalized === "suspended" || normalized === "terminated") return "bg-red-500/20 text-red-200 border-red-400/40"
  if (normalized === "grace_period" || normalized === "past_due") return "bg-orange-500/20 text-orange-200 border-orange-400/40"
  if (normalized === "cancelled") return "bg-yellow-500/20 text-yellow-200 border-yellow-400/40"
  return "bg-white/10 text-white/80 border-white/20"
}

export function OperatorTeams({ teams }: { teams: TeamRow[] }) {
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
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Teams Management</h2>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Local filter"
              className="rounded border border-white/15 bg-black/30 px-2 py-1 text-xs"
            />
            <button onClick={() => setModalOpen(true)} className="rounded bg-white/10 px-3 py-1 text-xs">
              Open Drill-down
            </button>
          </div>
        </div>
      </div>

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
          <div key={team.id} className="rounded-xl border border-white/10 bg-[#18181c] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{team.name}</h3>
                <p className="text-xs text-white/70">{team.organization.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded border px-2 py-0.5 text-xs ${statusChip(team.subscriptionStatus)}`}>subscription: {team.subscriptionStatus}</span>
                  <span className={`rounded border px-2 py-0.5 text-xs ${statusChip(team.teamStatus)}`}>team: {team.teamStatus}</span>
                </div>
                <p className="mt-2 text-xs text-white/70">
                  Plan: {team.planTier || "starter"} | Roster: {team.players.length} | Coaches: {team.memberships.length}
                </p>
                <Link href={`/admin/teams/${team.id}`} className="text-xs text-cyan-300 hover:text-cyan-200">
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
            <input className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs" placeholder="Search" />
            <select className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs">
              <option>Bulk action</option>
              <option>Suspend selected</option>
              <option>Restore selected</option>
            </select>
            <button className="rounded bg-white/10 px-2 py-1 text-xs">Apply</button>
            <button className="rounded bg-white/10 px-2 py-1 text-xs">Export CSV</button>
          </div>
          <div className="max-h-[45vh] overflow-y-auto rounded border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-2 py-2">Team</th>
                  <th className="px-2 py-2">Subscription</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-white/10">
                    <td className="px-2 py-2">{t.name}</td>
                    <td className="px-2 py-2">{t.subscriptionStatus}</td>
                    <td className="px-2 py-2">{t.teamStatus}</td>
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
