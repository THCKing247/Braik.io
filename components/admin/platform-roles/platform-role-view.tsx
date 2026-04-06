"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PLATFORM_PERMISSION_SECTION_ORDER } from "@/lib/permissions/platform-permission-keys"
import type { PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"
import { adminChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

type PermRow = { key: string; section: string; label: string; description: string }

type RoleRow = {
  key: string
  name: string
  description: string | null
  role_type: string
  is_active: boolean
}

export function PlatformRoleView({ roleId }: { roleId: string }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "forbidden" | "error">("loading")
  const [role, setRole] = useState<RoleRow | null>(null)
  const [permissionKeys, setPermissionKeys] = useState<PlatformPermissionKey[]>([])
  const [catalog, setCatalog] = useState<PermRow[]>([])
  const [userCount, setUserCount] = useState(0)

  const load = useCallback(async () => {
    setPhase("loading")
    try {
      const [permRes, roleRes] = await Promise.all([
        fetch("/api/admin/platform-permissions", { credentials: "include", cache: "no-store" }),
        fetch(`/api/admin/platform-roles/${roleId}`, { credentials: "include", cache: "no-store" }),
      ])
      if (permRes.status === 403 || roleRes.status === 403) {
        setPhase("forbidden")
        return
      }
      if (!permRes.ok || !roleRes.ok) throw new Error("load")
      const permJson = (await permRes.json()) as { permissions: PermRow[] }
      const roleJson = (await roleRes.json()) as {
        role: RoleRow
        permissionKeys: PlatformPermissionKey[]
        userCount: number
      }
      setCatalog(permJson.permissions ?? [])
      setRole(roleJson.role)
      setPermissionKeys(roleJson.permissionKeys ?? [])
      setUserCount(roleJson.userCount ?? 0)
      setPhase("ready")
    } catch {
      setPhase("error")
    }
  }, [roleId])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const keySet = new Set(permissionKeys)
    const m = new Map<string, PermRow[]>()
    for (const p of catalog) {
      if (!keySet.has(p.key as PlatformPermissionKey)) continue
      const list = m.get(p.section) ?? []
      list.push(p)
      m.set(p.section, list)
    }
    const order = [...PLATFORM_PERMISSION_SECTION_ORDER, ...[...m.keys()].filter((s) => !PLATFORM_PERMISSION_SECTION_ORDER.includes(s))]
    return order.map((section) => ({ section, rows: m.get(section) ?? [] })).filter((g) => g.rows.length > 0)
  }, [catalog, permissionKeys])

  if (phase === "loading") {
    return <p className="text-sm font-medium text-slate-300">Loading…</p>
  }
  if (phase === "forbidden") {
    return (
      <p className="text-sm font-medium text-amber-200">
        You cannot view this role.{" "}
        <Link href="/admin/roles" className={cn(adminUi.link, "underline-offset-2")}>
          Back
        </Link>
      </p>
    )
  }
  if (phase === "error" || !role) {
    return (
      <p className="text-sm font-medium text-red-300">
        Role not found.{" "}
        <Link href="/admin/roles" className={cn(adminUi.link, "underline-offset-2")}>
          Back
        </Link>
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={cn(adminUi.sectionTitle, "text-xl")}>{role.name}</h2>
          <p className="mt-1 font-mono text-sm text-orange-300">{role.key}</p>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-300">{role.description || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/roles/${roleId}/edit`}
            className={cn(adminUi.btnPrimary, "inline-flex no-underline")}
          >
            Edit
          </Link>
          <Link href="/admin/roles" className={cn(adminUi.btnSecondary, "inline-flex no-underline")}>
            All roles
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className={role.role_type === "system" ? adminChip.violet : cn(adminChip.neutral, "px-2 py-1")}>
          {role.role_type === "system" ? "System" : "Custom"}
        </span>
        <span className={role.is_active ? adminChip.success : cn(adminChip.neutral, "px-2 py-1 text-slate-400")}>
          {role.is_active ? "Active" : "Inactive"}
        </span>
        <span className={cn(adminUi.badgeNeutral, "px-2 py-1")}>{userCount} users assigned</span>
      </div>

      <div className="space-y-4">
        <h3 className={cn(adminUi.sectionTitle, "text-base")}>Permissions</h3>
        {grouped.map(({ section, rows }) => (
          <div key={section} className={cn(adminUi.panelMuted, "p-4")}>
            <h4 className="mb-2 text-sm font-semibold text-orange-300">{section}</h4>
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.key} className="text-sm font-medium text-slate-300">
                  <span className="font-semibold text-white">{r.label}</span>
                  <span className="ml-2 font-mono text-[11px] text-slate-400">({r.key})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {permissionKeys.length === 0 ? (
          <p className="text-sm font-medium text-slate-400">No permissions assigned.</p>
        ) : null}
      </div>
    </div>
  )
}
