"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  createdAt: string
  lastLoginAt: string | null
  memberships: Array<{ role: string; team: { id: string; name: string } }>
}

function chipClass(status: string): string {
  const value = status.toLowerCase()
  if (value.includes("active")) return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
  if (value.includes("suspend")) return "bg-red-500/20 text-red-200 border-red-400/40"
  if (value.includes("deactiv")) return "bg-yellow-500/20 text-yellow-200 border-yellow-400/40"
  return "bg-white/10 text-white/80 border-white/20"
}

export function OperatorUsers({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState("")
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) =>
      `${user.email} ${user.name || ""} ${user.role} ${user.status}`.toLowerCase().includes(q)
    )
  }, [users, query])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Users Management</h2>
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
        <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-3">
          <p className="text-xs text-sky-100/70">Total</p>
          <p className="text-2xl font-semibold text-sky-100">{users.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
          <p className="text-xs text-emerald-100/70">Active</p>
          <p className="text-2xl font-semibold text-emerald-100">
            {users.filter((u) => u.status.toLowerCase().includes("active")).length}
          </p>
        </div>
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-100/70">Suspended</p>
          <p className="text-2xl font-semibold text-red-100">
            {users.filter((u) => u.status.toLowerCase().includes("suspend")).length}
          </p>
        </div>
        <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 p-3">
          <p className="text-xs text-purple-100/70">Admins</p>
          <p className="text-2xl font-semibold text-purple-100">
            {users.filter((u) => u.role.toLowerCase() === "admin").length}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#18181c]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Team(s)</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-t border-white/10">
                <td className="px-3 py-2">
                  <p className="font-medium">{user.name || "Unnamed"}</p>
                  <p className="text-xs text-white/70">{user.email}</p>
                  <Link href={`/admin/users/${user.id}`} className="text-xs text-cyan-300 hover:text-cyan-200">
                    View profile
                  </Link>
                </td>
                <td className="px-3 py-2">{user.role}</td>
                <td className="px-3 py-2">
                  {user.memberships.length
                    ? user.memberships.map((membership) => `${membership.team.name} (${membership.role})`).join(", ")
                    : "No teams"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded border px-2 py-0.5 text-xs ${chipClass(user.status)}`}>{user.status}</span>
                </td>
                <td className="px-3 py-2">{new Date(user.createdAt).toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2">{user.lastLoginAt ? new Date(user.lastLoginAt).toISOString().slice(0, 10) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Users Drill-down"
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
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-white/10">
                    <td className="px-2 py-2">{u.email}</td>
                    <td className="px-2 py-2">{u.role}</td>
                    <td className="px-2 py-2">{u.status}</td>
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
