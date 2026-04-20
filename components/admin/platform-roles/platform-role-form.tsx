"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import type { PlatformPermissionKey } from "@/lib/permissions/platform-permission-keys"
import { PLATFORM_PERMISSION_SECTION_ORDER } from "@/lib/permissions/platform-permission-keys"
import { adminChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

type PermRow = { key: string; section: string; label: string; description: string }

export function PlatformRoleForm({ roleId }: { roleId?: string }) {
  const router = useRouter()
  const isEdit = Boolean(roleId)

  const [key, setKey] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [selected, setSelected] = useState<Set<PlatformPermissionKey>>(new Set())
  const [catalog, setCatalog] = useState<PermRow[]>([])
  const [sectionOrder, setSectionOrder] = useState<string[]>(PLATFORM_PERMISSION_SECTION_ORDER)
  const [keyEditable, setKeyEditable] = useState(true)
  const [roleType, setRoleType] = useState<string | null>(null)
  const [phase, setPhase] = useState<"loading" | "ready" | "forbidden" | "error">("loading")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: "ok" | "err"; message: string } | null>(null)
  const [initial, setInitial] = useState<string>("")

  const grouped = useMemo(() => {
    const m = new Map<string, PermRow[]>()
    for (const p of catalog) {
      const list = m.get(p.section) ?? []
      list.push(p)
      m.set(p.section, list)
    }
    const sections = [...sectionOrder, ...[...m.keys()].filter((s) => !sectionOrder.includes(s))]
    const uniq = [...new Set(sections)]
    return uniq.map((section) => ({ section, rows: m.get(section) ?? [] })).filter((g) => g.rows.length > 0)
  }, [catalog, sectionOrder])

  const isDirty = useMemo(() => {
    const snap = JSON.stringify({
      key,
      name,
      description,
      isActive,
      keys: [...selected].sort(),
    })
    return Boolean(initial) && snap !== initial
  }, [initial, key, name, description, isActive, selected])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  const load = useCallback(async () => {
    setPhase("loading")
    try {
      const permRes = await fetch("/api/admin/platform-permissions", { credentials: "include", cache: "no-store" })
      if (permRes.status === 403) {
        setPhase("forbidden")
        return
      }
      if (!permRes.ok) throw new Error("permissions")
      const permJson = (await permRes.json()) as { permissions: PermRow[]; sectionOrder?: string[] }
      setCatalog(permJson.permissions ?? [])
      if (permJson.sectionOrder?.length) setSectionOrder(permJson.sectionOrder)

      if (roleId) {
        const roleRes = await fetch(`/api/admin/platform-roles/${roleId}`, { credentials: "include", cache: "no-store" })
        if (roleRes.status === 403) {
          setPhase("forbidden")
          return
        }
        if (!roleRes.ok) throw new Error("role")
        const roleJson = (await roleRes.json()) as {
          role: {
            key: string
            name: string
            description: string | null
            is_active: boolean
            is_key_editable?: boolean
            role_type?: string
          }
          permissionKeys: PlatformPermissionKey[]
        }
        const r = roleJson.role
        setRoleType(r.role_type ?? null)
        setKey(r.key)
        setName(r.name)
        setDescription(r.description ?? "")
        setIsActive(r.is_active)
        setKeyEditable(r.is_key_editable !== false)
        setSelected(new Set(roleJson.permissionKeys ?? []))
        setInitial(
          JSON.stringify({
            key: r.key,
            name: r.name,
            description: r.description ?? "",
            isActive: r.is_active,
            keys: [...(roleJson.permissionKeys ?? [])].sort(),
          })
        )
      } else {
        setInitial(
          JSON.stringify({
            key: "",
            name: "",
            description: "",
            isActive: true,
            keys: [] as string[],
          })
        )
      }
      setPhase("ready")
    } catch {
      setPhase("error")
    }
  }, [roleId])

  useEffect(() => {
    void load()
  }, [load])

  function toggleKey(k: PlatformPermissionKey, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(k)
      else next.delete(k)
      return next
    })
  }

  function selectSection(section: string, on: boolean) {
    const rows = grouped.find((g) => g.section === section)?.rows ?? []
    setSelected((prev) => {
      const next = new Set(prev)
      for (const r of rows) {
        if (on) next.add(r.key as PlatformPermissionKey)
        else next.delete(r.key as PlatformPermissionKey)
      }
      return next
    })
  }

  async function save() {
    setSaving(true)
    setToast(null)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        isActive,
        permissionKeys: [...selected],
      }
      if (!isEdit || keyEditable) {
        body.key = key.trim()
      }
      const res = await fetch(isEdit ? `/api/admin/platform-roles/${roleId}` : "/api/admin/platform-roles", {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "Save failed")
      setToast({ type: "ok", message: isEdit ? "Role updated." : "Role created." })
      if (!isEdit && (data as { id?: string }).id) {
        router.replace(`/admin/roles/${(data as { id: string }).id}/edit`)
      } else {
        setInitial(
          JSON.stringify({
            key: key.trim(),
            name: name.trim(),
            description: description.trim(),
            isActive,
            keys: [...selected].sort(),
          })
        )
        router.refresh()
      }
    } catch (e) {
      setToast({ type: "err", message: e instanceof Error ? e.message : "Save failed" })
    } finally {
      setSaving(false)
    }
  }

  if (phase === "loading") {
    return <p className="text-sm font-medium text-admin-secondary">Loading…</p>
  }
  if (phase === "forbidden") {
    return (
      <p className="text-sm font-medium text-amber-200">
        You cannot manage roles.{" "}
        <Link href="/admin/roles" className={cn(adminUi.link, "underline-offset-2")}>
          Back
        </Link>
      </p>
    )
  }
  if (phase === "error") {
    return (
      <p className="text-sm font-medium text-red-300">
        Failed to load.{" "}
        <button type="button" className={cn(adminUi.link, "underline-offset-2")} onClick={() => void load()}>
          Retry
        </button>
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className={
            toast.type === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-950"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-900"
          }
        >
          {toast.message}
        </div>
      ) : null}

      <div className={cn(adminUi.panel, adminUi.panelPadding, "grid gap-4 md:grid-cols-2")}>
        {isEdit && roleType ? (
          <div className="md:col-span-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-admin-muted">Role type</span>
            <span className={roleType === "system" ? cn(adminChip.violet, "text-xs") : cn(adminChip.neutral, "text-xs")}>
              {roleType === "system" ? "System" : "Custom"}
            </span>
          </div>
        ) : null}
        <div className="md:col-span-2">
          <label className={adminUi.label}>Role name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={cn(adminUi.input, "mt-1")} />
        </div>
        <div>
          <label className={adminUi.label}>Role key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={isEdit && !keyEditable}
            title={isEdit && !keyEditable ? "System role keys are locked" : undefined}
            className={cn(adminUi.input, "mt-1 font-mono disabled:cursor-not-allowed disabled:opacity-60")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-admin-muted">Status</span>
          <label className="flex items-center gap-2 text-sm font-medium text-admin-primary">
            <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(Boolean(c))} />
            Active
          </label>
        </div>
        <div className="md:col-span-2">
          <label className={adminUi.label}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={cn(adminUi.input, "mt-1 min-h-[88px] py-2.5")}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className={cn(adminUi.sectionTitle, "text-base")}>Permissions</h2>
        <div className="space-y-6">
          {grouped.map(({ section, rows }) => {
            const allOn = rows.length > 0 && rows.every((r) => selected.has(r.key as PlatformPermissionKey))
            return (
              <div key={section} className={cn(adminUi.panelMuted, "p-4")}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-orange-300">{section}</h3>
                  <button
                    type="button"
                    onClick={() => selectSection(section, !allOn)}
                    className={cn(adminUi.linkSubtle, "hover:underline")}
                  >
                    {allOn ? "Clear section" : "Select all in section"}
                  </button>
                </div>
                <ul className="space-y-3">
                  {rows.map((r) => (
                    <li key={r.key} className={cn(adminUi.nestedRow, "flex gap-3")}>
                      <Checkbox
                        checked={selected.has(r.key as PlatformPermissionKey)}
                        onCheckedChange={(c) => toggleKey(r.key as PlatformPermissionKey, Boolean(c))}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-admin-primary">{r.label}</div>
                        <div className="font-mono text-[11px] text-admin-muted">{r.key}</div>
                        {r.description ? <p className="mt-1 text-xs font-medium text-admin-muted">{r.description}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-admin-border pt-4">
        <button
          type="button"
          disabled={saving || !name.trim() || !key.trim()}
          onClick={() => void save()}
          className={cn(adminUi.btnPrimary, "disabled:cursor-not-allowed")}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create role"}
        </button>
        <Link href="/admin/roles" className="text-sm font-medium text-admin-secondary transition-colors hover:text-admin-primary">
          Cancel
        </Link>
        {isDirty ? <span className="text-xs font-medium text-amber-200">Unsaved changes</span> : null}
      </div>
    </div>
  )
}
