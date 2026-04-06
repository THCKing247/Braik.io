"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { getUserRoleLabel, USER_ROLE_VALUES, USER_ROLE_LABELS } from "@/lib/auth/user-roles"
import { ACCOUNT_STATUS_VALUES } from "@/lib/account/account-status"
import { adminKpiLabel, adminKpiStatCard, adminKpiValue, adminOpsUserStatusChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  createdAt: string
  lastLoginAt: string | null
  memberships: Array<{ role: string; team: { id: string; name: string } }>
  platformRoleId: string | null
  platformRoleName: string | null
  platformRoleKey: string | null
}

type AdminCaps = {
  canManageUsers: boolean
  canImpersonate: boolean
}

export function OperatorUsers({ users }: { users: UserRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [caps, setCaps] = useState<AdminCaps | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/platform-role-access", { credentials: "include", cache: "no-store" })
        if (!res.ok) return
        const j = (await res.json()) as Partial<AdminCaps>
        if (!cancelled) {
          setCaps({
            canManageUsers: Boolean(j.canManageUsers),
            canImpersonate: Boolean(j.canImpersonate),
          })
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) =>
      `${user.email} ${user.name || ""} ${user.role} ${user.status} ${user.platformRoleName || ""} ${user.platformRoleKey || ""}`
        .toLowerCase()
        .includes(q)
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
        credentials: "include",
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
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE", credentials: "include" })
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Accounts"
        description="Search, filter, and manage platform users, roles, and team memberships."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/provisioning" className={cn(adminUi.btnPrimarySm, "no-underline")}>
              Provisioning
            </Link>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter list…"
              className={adminUi.toolbarInput}
            />
            <button type="button" onClick={() => setModalOpen(true)} className={adminUi.btnSecondarySm}>
              Drill-down
            </button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className={adminKpiStatCard("sky")}>
          <p className={adminKpiLabel()}>Total</p>
          <p className={adminKpiValue()}>{users.length}</p>
        </div>
        <div className={adminKpiStatCard("emerald")}>
          <p className={adminKpiLabel()}>Active</p>
          <p className={adminKpiValue()}>
            {users.filter((u) => u.status.toLowerCase().includes("active")).length}
          </p>
        </div>
        <div className={adminKpiStatCard("red")}>
          <p className={adminKpiLabel()}>Suspended</p>
          <p className={adminKpiValue()}>
            {users.filter((u) => u.status.toLowerCase().includes("suspend")).length}
          </p>
        </div>
        <div className={adminKpiStatCard("purple")}>
          <p className={adminKpiLabel()}>Admins</p>
          <p className={adminKpiValue()}>
            {users.filter((u) => u.role.toLowerCase() === "admin").length}
          </p>
        </div>
      </div>

      <div className={adminUi.tableWrap}>
        <table className={adminUi.table}>
          <thead className={adminUi.thead}>
            <tr>
              <th className={adminUi.th}>User</th>
              <th className={adminUi.th}>App role</th>
              <th className={adminUi.th}>Platform role</th>
              <th className={adminUi.th}>Team(s)</th>
              <th className={adminUi.th}>Status</th>
              <th className={adminUi.th}>Created</th>
              <th className={adminUi.th}>Last Login</th>
              <th className={adminUi.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className={adminUi.tbodyRow}>
                <td className={adminUi.td}>
                  <p className="font-semibold text-white">{user.name || "Unnamed"}</p>
                  <p className="text-xs font-medium text-slate-300">{user.email}</p>
                  <Link href={`/admin/users/${user.id}`} className={adminUi.linkSubtle}>
                    View profile
                  </Link>
                </td>
                <td className={adminUi.td}>{getUserRoleLabel(user.role)}</td>
                <td className={cn(adminUi.td, "text-xs")}>
                  {user.platformRoleName ? (
                    <>
                      <span className="font-medium text-white">{user.platformRoleName}</span>
                      <span className="ml-1 font-mono text-slate-400">({user.platformRoleKey})</span>
                    </>
                  ) : (
                    <span className="font-medium text-slate-400">—</span>
                  )}
                </td>
                <td className={adminUi.td}>
                  {user.memberships.length
                    ? user.memberships.map((membership) => `${membership.team.name} (${membership.role})`).join(", ")
                    : "No teams"}
                </td>
                <td className={adminUi.td}>
                  <span className={adminOpsUserStatusChip(user.status)}>{user.status}</span>
                </td>
                <td className={adminUi.td}>{new Date(user.createdAt).toISOString().slice(0, 10)}</td>
                <td className={adminUi.td}>{user.lastLoginAt ? new Date(user.lastLoginAt).toISOString().slice(0, 10) : "Never"}</td>
                <td className={adminUi.td}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditUser(user)}
                      disabled={caps === null ? false : !caps.canManageUsers}
                      title={caps && !caps.canManageUsers ? "Missing manage users permission" : undefined}
                      className={cn(adminUi.btnSecondarySm, "disabled:cursor-not-allowed disabled:opacity-40")}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSuspendOrRestore(user)}
                      disabled={!!actionLoading || (caps !== null && !caps.canManageUsers)}
                      className={cn(adminUi.btnWarningSm, "disabled:opacity-50")}
                    >
                      {user.status.toLowerCase().includes("suspend") ? "Restore" : "Suspend"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      disabled={!!actionLoading || (caps !== null && !caps.canManageUsers)}
                      className={cn(adminUi.btnDangerSm, "disabled:opacity-50")}
                    >
                      Delete
                    </button>
                    <Link href={`/admin/teams?userId=${user.id}`} className={adminUi.actionPill}>
                      Teams
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleSignInAsUser(user)}
                      disabled={!!actionLoading || (caps !== null && !caps.canImpersonate)}
                      className={cn(adminUi.btnSecondarySm, "disabled:opacity-50")}
                      title={
                        caps && !caps.canImpersonate
                          ? "Missing impersonate permission"
                          : "Open this user's brAIk.io dashboard (sudo sign in)"
                      }
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
            <input className={adminUi.toolbarInput} placeholder="Search" />
            <select className={adminUi.toolbarInput}>
              <option>Bulk action</option>
              <option>Suspend selected</option>
              <option>Restore selected</option>
            </select>
            <button type="button" className={adminUi.btnSecondarySm}>
              Apply
            </button>
            <button type="button" className={adminUi.btnSecondarySm}>
              Export CSV
            </button>
          </div>
          <div className={cn(adminUi.tableWrap, "max-h-[45vh]")}>
            <table className={cn(adminUi.table, "min-w-0 text-xs")}>
              <thead className={adminUi.thead}>
                <tr>
                  <th className={adminUi.th}>Email</th>
                  <th className={adminUi.th}>Role</th>
                  <th className={adminUi.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className={adminUi.tbodyRow}>
                    <td className={adminUi.td}>{u.email}</td>
                    <td className={adminUi.td}>{u.role}</td>
                    <td className={adminUi.td}>{u.status}</td>
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
  const [platformRoleId, setPlatformRoleId] = useState<string>(user.platformRoleId ?? "")
  const [platformRoles, setPlatformRoles] = useState<{ id: string; key: string; name: string }[]>([])
  const [status, setStatus] = useState(user.status)
  const [video, setVideo] = useState({
    can_view_video: false,
    can_upload_video: false,
    can_create_clips: false,
    can_share_clips: false,
    can_delete_video: false,
  })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const opt = await fetch("/api/admin/platform-role-options", { credentials: "include", cache: "no-store" })
        if (opt.ok) {
          const j = (await opt.json()) as { roles?: { id: string; key: string; name: string }[] }
          if (!cancelled && j.roles) setPlatformRoles(j.roles)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/admin/users/${user.id}`, { credentials: "include" })
        const data = await res.json()
        if (cancelled || !res.ok) return
        const pr = data.platformRole as { id?: string } | null | undefined
        if (pr?.id) setPlatformRoleId(pr.id)
        const vp = data.videoPermissions as
          | {
              can_view_video?: boolean
              can_upload_video?: boolean
              can_create_clips?: boolean
              can_share_clips?: boolean
              can_delete_video?: boolean
            }
          | null
        if (vp) {
          setVideo({
            can_view_video: Boolean(vp.can_view_video),
            can_upload_video: Boolean(vp.can_upload_video),
            can_create_clips: Boolean(vp.can_create_clips),
            can_share_clips: Boolean(vp.can_share_clips),
            can_delete_video: Boolean(vp.can_delete_video),
          })
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim().toLowerCase(),
          role: role,
          status: status,
          platformRoleId: platformRoleId || null,
          videoPermissions: video,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error((data as { error?: string }).error || "Failed to save")
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
            <label className={adminUi.label}>Name</label>
            <input className={adminUi.input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={adminUi.label}>Email</label>
            <input
              type="email"
              className={adminUi.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={adminUi.label}>App role (legacy)</label>
            <select className={adminUi.select} value={role} onChange={(e) => setRole(e.target.value)}>
              {USER_ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {USER_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={adminUi.label}>Platform role (permissions)</label>
            <select className={adminUi.select} value={platformRoleId} onChange={(e) => setPlatformRoleId(e.target.value)}>
              <option value="">— None —</option>
              {platformRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.key})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={adminUi.label}>Status</label>
            <select className={adminUi.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              {ACCOUNT_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={cn(adminUi.panelMuted, "p-3")}>
          <p className="mb-2 text-xs font-medium text-slate-300">Game Video / Clips</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["can_view_video", "View video"],
                ["can_upload_video", "Upload video"],
                ["can_create_clips", "Create clips"],
                ["can_share_clips", "Share clips"],
                ["can_delete_video", "Delete video"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={video[key]}
                  onChange={(e) => setVideo((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={adminUi.btnPrimary}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose} className={adminUi.btnSecondary}>
            Cancel
          </button>
        </div>
      </form>
    </AdminModal>
  )
}
