"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { getUserRoleLabel, USER_ROLE_VALUES, USER_ROLE_LABELS } from "@/lib/auth/user-roles"

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
  if (value.includes("deactiv")) return "bg-[#000000]/20 text-[#e5e7eb] border-[#000000]/40"
  return "bg-white/10 text-white/80 border-white/20"
}

const ALLOWED_STATUSES = ["active", "suspended", "deactivated", "DISABLED"] as const

export function OperatorUsers({ users }: { users: UserRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) =>
      `${user.email} ${user.name || ""} ${user.role} ${user.status}`.toLowerCase().includes(q)
    )
  }, [users, query])

  async function handleSuspendOrRestore(user: UserRow) {
    const isSuspended = user.status.toLowerCase().includes("suspend")
    const newStatus = isSuspended ? "active" : "suspended"
    if (!isSuspended && !window.confirm(`Suspend ${user.email}? They will not be able to sign in.`)) return
    setActionLoading(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update user")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(user: UserRow) {
    if (!window.confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return
    setActionLoading(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete user")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSignInAsUser(user: UserRow) {
    setActionLoading(user.id)
    try {
      const res = await fetch("/api/admin/impersonation/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, durationMinutes: 60 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to start session")
      const redirect = (data as { redirect?: string }).redirect ?? "/dashboard"
      window.location.href = redirect
    } catch (e) {
      setActionLoading(null)
      alert(e instanceof Error ? e.message : "Failed to sign in as user")
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Account Management</h2>
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
              <th className="px-3 py-2">Actions</th>
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
                <td className="px-3 py-2">{getUserRoleLabel(user.role)}</td>
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
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditUser(user)}
                      className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSuspendOrRestore(user)}
                      disabled={!!actionLoading}
                      className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                    >
                      {user.status.toLowerCase().includes("suspend") ? "Restore" : "Suspend"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      disabled={!!actionLoading}
                      className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <Link
                      href={`/admin/teams?userId=${user.id}`}
                      className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/30"
                    >
                      Teams
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleSignInAsUser(user)}
                      disabled={!!actionLoading}
                      className="rounded bg-violet-500/20 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/30 disabled:opacity-50"
                      title="Open this user's brAIk.io dashboard (sudo sign in)"
                    >
                      Sign in as user
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null)
            router.refresh()
          }}
        />
      )}

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

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(user.name ?? "")
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role.trim().toLowerCase().replace(/-/g, "_"))
  const [status, setStatus] = useState(
    ["active", "suspended", "deactivated", "DISABLED"].includes(user.status.toLowerCase())
      ? user.status
      : user.status.toLowerCase().includes("suspend")
        ? "suspended"
        : "active"
  )
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim().toLowerCase(),
          role: role,
          status: status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminModal open title={`Edit ${user.email}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/70">Name</label>
            <input
              className="w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/70">Email</label>
            <input
              type="email"
              className="w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/70">Role</label>
            <select
              className="w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {USER_ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {USER_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/70">Status</label>
            <select
              className="w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {ALLOWED_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose} className="rounded bg-white/10 px-3 py-2 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </AdminModal>
  )
}
