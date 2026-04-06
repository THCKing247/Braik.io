"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { adminUi, isAdminNavActive } from "@/lib/admin/admin-ui"

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

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname()
  const active = isAdminNavActive(pathname, href)
  return (
    <Link
      href={href}
      className={cn(adminUi.navLink, active && adminUi.navLinkActive)}
    >
      {children}
    </Link>
  )
}

export function AdminProtectedShell({ children }: { children: ReactNode }) {
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
      <div className={adminUi.loadingCenter}>
        <p className="text-sm text-slate-400">Loading admin…</p>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className={adminUi.errorCenter}>
        <p className="text-sm text-slate-300">Could not verify admin access.</p>
        <Link href="/admin/login" className={cn(adminUi.link, "text-base")}>
          Admin login
        </Link>
      </div>
    )
  }

  return (
    <div className={adminUi.shellGradient}>
      <div className="flex w-full gap-0">
        <aside className={adminUi.sidebar}>
          <p className={adminUi.brandKicker}>Braik</p>
          <h1 className={adminUi.sidebarTitle}>Admin Console</h1>
          <p className="mt-1 text-xs text-slate-500">Platform operations &amp; governance</p>
          <nav className="mt-6 space-y-1 text-sm">
            <NavLink href="/admin">Overview</NavLink>
            <NavLink href="/admin/users">Accounts</NavLink>
            <NavLink href="/admin/teams">Teams</NavLink>
            <NavLink href="/admin/athletic-departments">Athletic Departments</NavLink>
            <NavLink href="/admin/provisioning">Provisioning</NavLink>
            {caps && (caps.canViewBilling || caps.canManageBilling) ? (
              <NavLink href="/admin/billing">Billing</NavLink>
            ) : null}
            {caps?.canViewAuditLogs ? <NavLink href="/admin/audit">Audit</NavLink> : null}
            {caps && (caps.canViewAuditLogs || caps.canManageUsers) ? (
              <NavLink href="/admin/document-audit">Document audit</NavLink>
            ) : null}
            {caps?.canManageRoles ? <NavLink href="/admin/roles">Roles &amp; Permissions</NavLink> : null}
            {caps?.canManagePlatformSettings ? (
              <NavLink href="/admin/settings/system">System Settings</NavLink>
            ) : null}
            <NavLink href="/admin/dashboard">Dashboard</NavLink>
            <p className={adminUi.navSectionLabel}>Leave</p>
            <Link href="/dashboard" className={cn(adminUi.navLink, "mt-1")}>
              Exit to App
            </Link>
          </nav>
        </aside>
        <main className={adminUi.main}>{children}</main>
      </div>
    </div>
  )
}
