"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminUserEditModal, type AdminUserEditRow } from "@/components/admin/admin-user-edit-modal"
import { getUserRoleLabel } from "@/lib/auth/user-roles"
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
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [caps, setCaps] = useState<AdminCaps | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | { user: UserRow; kind: "suspend" | "delete" | "restore" }>(null)

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
    setActionLoading(user.id)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")
      setFeedback(isSuspended ? "User restored." : "User suspended.")
      router.refresh()
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Failed to update user")
    } finally {
      setActionLoading(null)
      setConfirm(null)
    }
  }

  async function handleDelete(user: UserRow) {
    setActionLoading(user.id)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE", credentials: "include" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      setFeedback("User deleted.")
      router.refresh()
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Failed to delete user")
    } finally {
      setActionLoading(null)
      setConfirm(null)
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
      setFeedback(e instanceof Error ? e.message : "Failed to sign in as user")
    }
  }

  function toEditRow(u: UserRow): AdminUserEditRow {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      memberships: u.memberships,
      platformRoleId: u.platformRoleId,
      platformRoleName: u.platformRoleName,
      platformRoleKey: u.platformRoleKey,
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Accounts"
        description="Search and manage platform users (public.users), profiles, and team links."
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
          </div>
        }
      />

      {feedback ? (
        <div className={cn(adminUi.noticeMuted, "text-sm")} role="status">
          {feedback}
        </div>
      ) : null}

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
                      onClick={() =>
                        setConfirm({
                          user,
                          kind: user.status.toLowerCase().includes("suspend") ? "restore" : "suspend",
                        })
                      }
                      disabled={!!actionLoading || (caps !== null && !caps.canManageUsers)}
                      className={cn(adminUi.btnWarningSm, "disabled:opacity-50")}
                    >
                      {user.status.toLowerCase().includes("suspend") ? "Restore" : "Suspend"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ user, kind: "delete" })}
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

      {editUser ? (
        <AdminUserEditModal
          user={toEditRow(editUser)}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null)
            setFeedback("Saved.")
            router.refresh()
          }}
        />
      ) : null}

      <AdminModal
        open={confirm !== null}
        title={
          confirm?.kind === "delete"
            ? "Delete user?"
            : confirm?.kind === "suspend"
              ? "Suspend user?"
              : "Restore user?"
        }
        summary={
          confirm == null
            ? ""
            : confirm.kind === "delete"
              ? `Permanently delete ${confirm.user.email}? This cannot be undone.`
              : confirm.kind === "suspend"
                ? `${confirm.user.email} will not be able to sign in until restored.`
                : `Restore access for ${confirm.user.email}?`
        }
        onClose={() => !actionLoading && setConfirm(null)}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={!!actionLoading} onClick={() => setConfirm(null)} className={adminUi.btnSecondary}>
            Cancel
          </button>
          {confirm?.kind === "delete" ? (
            <button
              type="button"
              disabled={!!actionLoading}
              onClick={() => {
                if (confirm) void handleDelete(confirm.user)
              }}
              className={adminUi.btnDanger}
            >
              {actionLoading ? "…" : "Delete user"}
            </button>
          ) : (
            <button
              type="button"
              disabled={!!actionLoading}
              onClick={() => {
                if (confirm) void handleSuspendOrRestore(confirm.user)
              }}
              className={confirm?.kind === "suspend" ? adminUi.btnWarningSm : adminUi.btnPrimary}
            >
              {actionLoading ? "…" : confirm?.kind === "suspend" ? "Suspend" : "Restore"}
            </button>
          )}
        </div>
      </AdminModal>
    </div>
  )
}
