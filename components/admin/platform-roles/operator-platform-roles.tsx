"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"

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
}

export function OperatorPlatformRoles() {
  const router = useRouter()
  const [phase, setPhase] = useState<"loading" | "ok" | "forbidden" | "error">("loading")
  const [roles, setRoles] = useState<PlatformRoleRow[]>([])
  const [query, setQuery] = useState("")
  const [toast, setToast] = useState<{ type: "ok" | "err"; message: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlatformRoleRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setPhase("loading")
    try {
      const res = await fetch("/api/admin/platform-roles", { credentials: "include", cache: "no-store" })
      if (res.status === 403) {
        setPhase("forbidden")
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { roles: PlatformRoleRow[] }
      setRoles(data.roles ?? [])
      setPhase("ok")
    } catch {
      setPhase("error")
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
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-sm text-white/70">
        Loading roles…
      </div>
    )
  }

  if (phase === "forbidden") {
    return (
      <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-white/90">
        <p className="font-medium">You do not have permission to manage roles.</p>
        <p className="text-white/70">Ask a platform administrator to grant the “Manage roles & permissions” capability.</p>
        <Link href="/admin" className="inline-block text-cyan-300 underline">
          Back to admin overview
        </Link>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-white/90">
        Failed to load roles.{" "}
        <button type="button" className="text-cyan-300 underline" onClick={() => void load()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
          <label className="block text-xs font-medium uppercase tracking-wide text-white/50">Search roles</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, key, or description…"
            className="mt-1 w-full max-w-md rounded-lg border border-white/15 bg-[#0c0c0e] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
        <Link
          href="/admin/roles/new"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Create Role
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Description</th>
              <th className="px-4 py-3 font-medium">Users</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-cyan-200/90">{r.key}</td>
                <td className="hidden max-w-md truncate px-4 py-3 text-white/60 md:table-cell">{r.description || "—"}</td>
                <td className="px-4 py-3 text-white/80">{r.userCount}</td>
                <td className="px-4 py-3">
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
                <td className="px-4 py-3">
                  <span
                    className={
                      r.is_active
                        ? "rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-100"
                        : "rounded border border-white/20 bg-white/5 px-2 py-0.5 text-xs text-white/60"
                    }
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link href={`/admin/roles/${r.id}`} className="text-xs text-cyan-300 hover:underline">
                      View
                    </Link>
                    <Link href={`/admin/roles/${r.id}/edit`} className="text-xs text-white/80 hover:underline">
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void duplicate(r)}
                      className="text-xs text-white/70 hover:underline disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={!r.is_deletable || busyId === r.id}
                      onClick={() => setDeleteTarget(r)}
                      className="text-xs text-red-300/90 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                      title={!r.is_deletable ? "System roles cannot be deleted" : "Delete role"}
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
          <div className="px-4 py-8 text-center text-sm text-white/50">No roles match your search.</div>
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
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busyId === deleteTarget.id}
              onClick={() => void confirmDelete()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ) : null}
      </AdminModal>
    </div>
  )
}
