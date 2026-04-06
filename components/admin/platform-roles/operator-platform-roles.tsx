"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

type PlatformRoleRow = {
  id: string
  key: string
  name: string
  description: string | null
  role_type: string
  is_active: boolean
  is_deletable: boolean
  is_key_editable: boolean
  userCount: number
  permissionKeys?: string[]
}

export function OperatorPlatformRoles() {
  const router = useRouter()
  const [phase, setPhase] = useState<"loading" | "ok" | "forbidden" | "unauthorized" | "error">("loading")
  const [roles, setRoles] = useState<PlatformRoleRow[]>([])
  const [catalogReadOnly, setCatalogReadOnly] = useState(false)
  const [dataSource, setDataSource] = useState<"database" | "fallback" | null>(null)
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [toast, setToast] = useState<{ type: "ok" | "err"; message: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlatformRoleRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setPhase("loading")
    setLoadErrorMessage(null)
    try {
      const res = await fetch("/api/admin/platform-roles", { credentials: "include", cache: "no-store" })
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        source?: "database" | "fallback"
        catalogReadOnly?: boolean
        roles?: PlatformRoleRow[]
      } | null

      if (res.status === 401) {
        setPhase("unauthorized")
        setLoadErrorMessage(json?.error ?? "You need to sign in to manage platform roles.")
        return
      }
      if (res.status === 403) {
        setPhase("forbidden")
        return
      }
      if (!res.ok || !json || json.ok === false) {
        setPhase("error")
        setLoadErrorMessage(json?.error ?? `Request failed (${res.status}).`)
        return
      }

      setRoles(json.roles ?? [])
      setDataSource(json.source ?? "database")
      setCatalogReadOnly(json.catalogReadOnly === true || json.source === "fallback")
      setPhase("ok")
    } catch (e) {
      setPhase("error")
      setLoadErrorMessage(e instanceof Error ? e.message : "Failed to load roles.")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roles
    return roles.filter(
      (r) =>
        `${r.name} ${r.key} ${r.description || ""} ${r.role_type}`.toLowerCase().includes(q)
    )
  }, [roles, query])

  async function duplicate(role: PlatformRoleRow) {
    const base = `${role.key}_copy`
    const key = window.prompt("New role key (snake_case)", base)?.trim()
    if (!key) return
    const name = window.prompt("New role name", `${role.name} (copy)`)?.trim()
    if (!name) return
    setBusyId(role.id)
    try {
      const res = await fetch("/api/admin/platform-roles", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          name,
          description: role.description ?? "",
          isActive: true,
          permissionKeys: [],
          duplicateFromId: role.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Duplicate failed")
      setToast({ type: "ok", message: "Role duplicated." })
      const id = (data as { id?: string }).id
      if (id) router.push(`/admin/roles/${id}/edit`)
      else void load()
    } catch (e) {
      setToast({ type: "err", message: e instanceof Error ? e.message : "Duplicate failed" })
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      const res = await fetch(`/api/admin/platform-roles/${deleteTarget.id}`, { method: "DELETE", credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Delete failed")
      setToast({ type: "ok", message: "Role deleted." })
      setDeleteTarget(null)
      void load()
    } catch (e) {
      setToast({ type: "err", message: e instanceof Error ? e.message : "Delete failed" })
    } finally {
      setBusyId(null)
    }
  }

  if (phase === "loading") {
    return (
      <div className={cn(adminUi.panel, adminUi.panelPadding, "text-sm text-slate-400")}>Loading roles…</div>
    )
  }

  if (phase === "forbidden") {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-50">
        <p className="font-medium">You do not have permission to manage roles.</p>
        <p className="text-amber-100/80">Ask a platform administrator to grant the “Manage roles & permissions” capability.</p>
        <Link href="/admin" className={cn(adminUi.link, "inline-block underline-offset-2")}>
          Back to admin overview
        </Link>
      </div>
    )
  }

  if (phase === "unauthorized") {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-50">
        <p className="font-medium">Sign-in required</p>
        <p className="text-amber-100/80">{loadErrorMessage ?? "Your session expired or you are not signed in."}</p>
        <Link href="/login" className={cn(adminUi.link, "inline-block underline-offset-2")}>
          Go to sign in
        </Link>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100">
        <p className="mb-2 font-medium">Failed to load roles.</p>
        {loadErrorMessage ? <p className="mb-3 text-red-100/80">{loadErrorMessage}</p> : null}
        <button type="button" className={cn(adminUi.link, "underline")} onClick={() => void load()}>
          Retry
        </button>
      </div>
    )
  }

  const readOnlyCatalog = catalogReadOnly

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Roles & permissions"
        description="Platform-level capability bundles assigned to operator accounts. Keys are stable identifiers for automation and audits."
      />
      {dataSource === "fallback" ? (
        <div className={adminUi.noticeInfo}>
          <p className="text-sm text-orange-50/95">
            Showing the default platform role catalog (database roles schema is not available yet). Create, edit, and delete
            actions are disabled until migrations are applied.
          </p>
        </div>
      ) : null}
      {toast ? (
        <div
          className={
            toast.type === "ok"
              ? "rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100"
              : "rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm text-red-100"
          }
        >
          {toast.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <label className={cn(adminUi.label, "uppercase tracking-wide")}>Search roles</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, key, or description…"
            className={cn(adminUi.input, "mt-1 max-w-md")}
          />
        </div>
        {readOnlyCatalog ? (
          <span
            className="inline-flex shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-500"
            title="Run platform roles migrations to enable creating roles"
          >
            Create Role
          </span>
        ) : (
          <Link href="/admin/roles/new" className={cn(adminUi.btnPrimary, "inline-flex shrink-0 no-underline")}>
            Create Role
          </Link>
        )}
      </div>

      <div className={adminUi.tableWrap}>
        <table className={cn(adminUi.table, "min-w-full")}>
          <thead className={adminUi.thead}>
            <tr>
              <th className={adminUi.th}>Role</th>
              <th className={adminUi.th}>Key</th>
              <th className={cn(adminUi.th, "hidden md:table-cell")}>Description</th>
              <th className={adminUi.th}>Users</th>
              <th className={adminUi.th}>Type</th>
              <th className={adminUi.th}>Status</th>
              <th className={cn(adminUi.th, "text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={adminUi.tbodyRow}>
                <td className={cn(adminUi.td, "font-medium text-white")}>{r.name}</td>
                <td className={cn(adminUi.td, "font-mono text-xs text-orange-300/90")}>{r.key}</td>
                <td className={cn(adminUi.td, "hidden max-w-md truncate text-slate-400 md:table-cell")}>
                  {r.description || "—"}
                </td>
                <td className={adminUi.td}>{r.userCount}</td>
                <td className={adminUi.td}>
                  <span
                    className={
                      r.role_type === "system"
                        ? "rounded border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-xs text-violet-100"
                        : "rounded border border-white/20 bg-white/5 px-2 py-0.5 text-xs text-white/80"
                    }
                  >
                    {r.role_type === "system" ? "System" : "Custom"}
                  </span>
                </td>
                <td className={adminUi.td}>
                  <span
                    className={
                      r.is_active
                        ? "rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-100"
                        : "rounded-md border border-white/20 bg-white/5 px-2 py-0.5 text-xs text-slate-400"
                    }
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className={cn(adminUi.td, "text-right")}>
                  <div className="flex flex-wrap justify-end gap-2">
                    {readOnlyCatalog ? (
                      <span className="text-xs text-slate-600" title="Run migrations to use role detail and editing">
                        View
                      </span>
                    ) : (
                      <Link href={`/admin/roles/${r.id}`} className={cn(adminUi.linkSubtle, "hover:underline")}>
                        View
                      </Link>
                    )}
                    {readOnlyCatalog ? (
                      <span className="text-xs text-slate-600" title="Run migrations to use role detail and editing">
                        Edit
                      </span>
                    ) : (
                      <Link href={`/admin/roles/${r.id}/edit`} className="text-xs text-slate-300 hover:underline">
                        Edit
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={readOnlyCatalog || busyId === r.id}
                      onClick={() => void duplicate(r)}
                      className="text-xs text-slate-400 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                      title={readOnlyCatalog ? "Run migrations to duplicate roles" : undefined}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={readOnlyCatalog || !r.is_deletable || busyId === r.id}
                      onClick={() => setDeleteTarget(r)}
                      className="text-xs text-red-300/90 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                      title={
                        readOnlyCatalog
                          ? "Run migrations to delete roles"
                          : !r.is_deletable
                            ? "System roles cannot be deleted"
                            : "Delete role"
                      }
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No roles match your search.</div>
        ) : null}
      </div>

      <AdminModal
        open={Boolean(deleteTarget)}
        title="Delete role?"
        summary={deleteTarget ? `Remove “${deleteTarget.name}” permanently. Users must be reassigned first.` : undefined}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setDeleteTarget(null)} className={adminUi.btnSecondary}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busyId === deleteTarget.id}
              onClick={() => void confirmDelete()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ) : null}
      </AdminModal>
    </div>
  )
}
