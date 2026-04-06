"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Phase = "loading" | "ok" | "error"

type AdminCaps = {
  canManageRoles: boolean
  canManageUsers: boolean
  canImpersonate: boolean
  canViewAuditLogs: boolean
  canManagePlatformSettings: boolean
  canViewBilling: boolean
  canManageBilling: boolean
}

export function AdminProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("loading")
  const [caps, setCaps] = useState<AdminCaps | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/access-check", { credentials: "include", cache: "no-store" })
        if (res.status === 401) {
          router.replace("/admin/login")
          return
        }
        if (res.status === 403) {
          router.replace("/")
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        try {
          const cap = await fetch("/api/admin/platform-role-access", { credentials: "include", cache: "no-store" })
          if (cap.ok) {
            const j = (await cap.json()) as Partial<AdminCaps> & { canManageRoles?: boolean }
            if (!cancelled) {
              setCaps({
                canManageRoles: Boolean(j.canManageRoles),
                canManageUsers: Boolean(j.canManageUsers),
                canImpersonate: Boolean(j.canImpersonate),
                canViewAuditLogs: Boolean(j.canViewAuditLogs),
                canManagePlatformSettings: Boolean(j.canManagePlatformSettings),
                canViewBilling: Boolean(j.canViewBilling),
                canManageBilling: Boolean(j.canManageBilling),
              })
            }
          } else if (!cancelled) {
            setCaps({
              canManageRoles: false,
              canManageUsers: false,
              canImpersonate: false,
              canViewAuditLogs: false,
              canManagePlatformSettings: false,
              canViewBilling: false,
              canManageBilling: false,
            })
          }
        } catch {
          if (!cancelled) {
            setCaps({
              canManageRoles: false,
              canManageUsers: false,
              canImpersonate: false,
              canViewAuditLogs: false,
              canManagePlatformSettings: false,
              canViewBilling: false,
              canManageBilling: false,
            })
          }
        }
        if (!cancelled) setPhase("ok")
      } catch {
        if (!cancelled) setPhase("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (phase === "loading") {
    return (
      <div className="min-h-screen w-full bg-[#09090B] text-white flex items-center justify-center">
        <p className="text-sm text-white/70">Loading admin…</p>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen w-full bg-[#09090B] text-white flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-white/80">Could not verify admin access.</p>
        <Link href="/admin/login" className="text-cyan-300 underline">
          Admin login
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#09090B] text-white">
      <div className="flex w-full gap-0">
        <aside className="sticky top-0 h-screen w-72 shrink-0 border-r border-white/10 bg-[#111113] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Braik Super Admin</p>
          <h1 className="mt-2 text-xl font-semibold">Backend Console</h1>
          <nav className="mt-5 space-y-2 text-sm">
            <Link href="/admin" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Overview
            </Link>
            <Link href="/admin/users" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Accounts
            </Link>
            <Link href="/admin/teams" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Teams
            </Link>
            <Link
              href="/admin/athletic-departments"
              className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              Athletic Departments
            </Link>
            <Link
              href="/admin/provisioning"
              className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              Provisioning
            </Link>
            {caps && (caps.canViewBilling || caps.canManageBilling) ? (
              <Link href="/admin/billing" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                Billing
              </Link>
            ) : null}
            {caps?.canViewAuditLogs ? (
              <Link href="/admin/audit" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                Audit
              </Link>
            ) : null}
            {caps && (caps.canViewAuditLogs || caps.canManageUsers) ? (
              <Link href="/admin/document-audit" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                Document audit
              </Link>
            ) : null}
            {caps?.canManageRoles ? (
              <Link href="/admin/roles" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                Roles & Permissions
              </Link>
            ) : null}
            {caps?.canManagePlatformSettings ? (
              <Link href="/admin/settings/system" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                System Settings
              </Link>
            ) : null}
            <Link href="/admin/dashboard" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Dashboard
            </Link>
            <Link href="/dashboard" className="mt-3 block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Exit to App
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
