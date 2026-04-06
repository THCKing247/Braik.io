"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AdminModal } from "@/components/admin/admin-modal"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminUserEditModal, type AdminUserEditRow } from "@/components/admin/admin-user-edit-modal"
import type { AdminUserProfilePayload } from "@/lib/admin/load-admin-user-profile"
import { getUserRoleLabel } from "@/lib/auth/user-roles"
import { adminOpsUserStatusChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

function toEditRow(p: AdminUserProfilePayload): AdminUserEditRow {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    role: p.role,
    status: p.status,
    createdAt: p.createdAt,
    lastLoginAt: p.lastLoginAt,
    memberships: p.team
      ? [{ role: p.profileRole ?? "—", team: p.team }]
      : [],
    platformRoleId: p.platformRoleId,
    platformRoleName: p.platformRoleName,
    platformRoleKey: p.platformRoleKey,
  }
}

export function AdminUserDetailView({ initial }: { initial: AdminUserProfilePayload }) {
  const router = useRouter()
  const [profile, setProfile] = useState(initial)
  const [editOpen, setEditOpen] = useState(false)
  const [caps, setCaps] = useState<{ canManageUsers: boolean; canImpersonate: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | { kind: "suspend" | "delete" | "restore" }>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/platform-role-access", { credentials: "include", cache: "no-store" })
        if (!res.ok) return
        const j = (await res.json()) as { canManageUsers?: boolean; canImpersonate?: boolean }
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

  async function refreshProfile() {
    const res = await fetch(`/api/admin/users/${profile.id}`, { credentials: "include", cache: "no-store" })
    const data = await res.json()
    if (!res.ok) {
      setFeedback(data.error || "Failed to reload profile")
      return
    }
    const next = data.adminProfile as AdminUserProfilePayload | undefined
    if (next) setProfile(next)
    router.refresh()
  }

  const canManage = caps?.canManageUsers !== false

  async function runSuspendToggle() {
    const isSuspended = profile.status.toLowerCase().includes("suspend")
    const newStatus = isSuspended ? "active" : "suspended"
    setBusy(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/users/${profile.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      setFeedback(isSuspended ? "User restored." : "User suspended.")
      setConfirm(null)
      await refreshProfile()
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  async function runDelete() {
    setBusy(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/users/${profile.id}`, { method: "DELETE", credentials: "include" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      router.replace("/admin/users")
      router.refresh()
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  async function runImpersonate() {
    setBusy(true)
    setFeedback(null)
    try {
      const res = await fetch("/api/admin/impersonation/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: profile.id, durationMinutes: 60 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      window.location.href = (data as { redirect?: string }).redirect ?? "/dashboard"
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  const displayName = profile.name?.trim() || profile.profileFullName?.trim() || "—"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/users" className={cn(adminUi.link, "text-sm")}>
          ← Accounts
        </Link>
      </div>

      <AdminPageHeader
        title={displayName !== "—" ? displayName : profile.email}
        description="User record from public.users, profile, and team links (Supabase)."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canManage || busy}
              onClick={() => setEditOpen(true)}
              className={adminUi.btnPrimarySm}
            >
              Edit
            </button>
            {profile.status.toLowerCase().includes("suspend") ? (
              <button
                type="button"
                disabled={!canManage || busy}
                onClick={() => setConfirm({ kind: "restore" })}
                className={adminUi.btnWarningSm}
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                disabled={!canManage || busy}
                onClick={() => setConfirm({ kind: "suspend" })}
                className={adminUi.btnWarningSm}
              >
                Suspend
              </button>
            )}
            <button
              type="button"
              disabled={!canManage || busy}
              onClick={() => setConfirm({ kind: "delete" })}
              className={adminUi.btnDangerSm}
            >
              Delete
            </button>
            <button
              type="button"
              disabled={busy || caps?.canImpersonate === false}
              onClick={() => void runImpersonate()}
              className={adminUi.btnSecondarySm}
              title={caps?.canImpersonate === false ? "Missing impersonation permission" : undefined}
            >
              Sign in as user
            </button>
          </div>
        }
      />

      {feedback ? (
        <div className={cn(adminUi.noticeMuted, "text-sm")} role="status">
          {feedback}
        </div>
      ) : null}

      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h2 className={cn(adminUi.sectionTitle, "text-base")}>Account</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className={adminUi.label}>Email</dt>
            <dd className="text-sm font-medium text-slate-200">{profile.email}</dd>
          </div>
          <div>
            <dt className={adminUi.label}>Full name (users)</dt>
            <dd className="text-sm font-medium text-slate-200">{profile.name ?? "—"}</dd>
          </div>
          <div>
            <dt className={adminUi.label}>Profile name</dt>
            <dd className="text-sm font-medium text-slate-200">{profile.profileFullName ?? "—"}</dd>
          </div>
          <div>
            <dt className={adminUi.label}>App role (users.role)</dt>
            <dd className="text-sm font-medium text-slate-200">{getUserRoleLabel(profile.role)}</dd>
          </div>
          <div>
            <dt className={adminUi.label}>Profile role</dt>
            <dd className="text-sm font-medium text-slate-200">{profile.profileRole ?? "—"}</dd>
          </div>
          <div>
            <dt className={adminUi.label}>Status</dt>
            <dd>
              <span className={adminOpsUserStatusChip(profile.status)}>{profile.status}</span>
            </dd>
          </div>
          <div>
            <dt className={adminUi.label}>Platform role</dt>
            <dd className="text-sm font-medium text-slate-200">
              {profile.platformRoleName ? (
                <>
                  {profile.platformRoleName}{" "}
                  <span className="font-mono text-xs text-slate-400">({profile.platformRoleKey})</span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className={adminUi.label}>Created</dt>
            <dd className="text-sm font-medium text-slate-200">
              {new Date(profile.createdAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className={adminUi.label}>Last login</dt>
            <dd className="text-sm font-medium text-slate-200">
              {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className={cn(adminUi.panel, adminUi.panelPadding)}>
        <h2 className={cn(adminUi.sectionTitle, "text-base")}>Organization &amp; team</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className={adminUi.label}>Organization</dt>
            <dd className="text-sm font-medium text-slate-200">{profile.organizationName ?? "—"}</dd>
          </div>
          <div>
            <dt className={adminUi.label}>School</dt>
            <dd className="text-sm font-medium text-slate-200">{profile.schoolName ?? "—"}</dd>
          </div>
          <div>
            <dt className={adminUi.label}>Program</dt>
            <dd className="text-sm font-medium text-slate-200">{profile.programName ?? "—"}</dd>
          </div>
          <div>
            <dt className={adminUi.label}>Team</dt>
            <dd className="text-sm font-medium text-slate-200">
              {profile.team ? (
                <Link href={`/admin/teams/${profile.team.id}`} className={adminUi.link}>
                  {profile.team.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className={adminUi.label}>Profile sport</dt>
            <dd className="text-sm font-medium text-slate-200">{profile.profileSport ?? "—"}</dd>
          </div>
        </dl>
      </div>

      {editOpen ? (
        <AdminUserEditModal
          user={toEditRow(profile)}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false)
            setFeedback("Saved.")
            await refreshProfile()
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
          confirm?.kind === "delete"
            ? `Permanently delete ${profile.email}? This cannot be undone.`
            : confirm?.kind === "suspend"
              ? `${profile.email} will not be able to sign in until restored.`
              : `Restore access for ${profile.email}?`
        }
        onClose={() => !busy && setConfirm(null)}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setConfirm(null)} className={adminUi.btnSecondary}>
            Cancel
          </button>
          {confirm?.kind === "delete" ? (
            <button type="button" disabled={busy} onClick={() => void runDelete()} className={adminUi.btnDanger}>
              {busy ? "…" : "Delete user"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runSuspendToggle()}
              className={confirm?.kind === "suspend" ? adminUi.btnWarningSm : adminUi.btnPrimary}
            >
              {busy ? "…" : confirm?.kind === "suspend" ? "Suspend" : "Restore"}
            </button>
          )}
        </div>
      </AdminModal>
    </div>
  )
}
