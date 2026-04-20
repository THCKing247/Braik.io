"use client"

import { useEffect, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { USER_ROLE_VALUES, USER_ROLE_LABELS } from "@/lib/auth/user-roles"
import { ACCOUNT_STATUS_VALUES } from "@/lib/account/account-status"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

export type AdminUserEditRow = {
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

export function AdminUserEditModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserEditRow
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
          <p className="mb-2 text-xs font-medium text-admin-secondary">Game Video / Clips</p>
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
              <label key={key} className="flex items-center gap-2 text-xs text-admin-secondary">
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
