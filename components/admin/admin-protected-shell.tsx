"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { adminNavLinkClass, adminUi, isAdminNavActive } from "@/lib/admin/admin-ui"
import { AdminLoadingShell } from "@/components/admin/admin-loading-shell"

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
    <Link href={href} className={adminNavLinkClass(active)}>
      {children}
    </Link>
  )
}

function NavSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className={adminUi.navSectionLabel}>{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
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
    return <AdminLoadingShell />
  }

  if (phase === "error") {
    return (
      <div className={adminUi.errorCenter}>
        <p className="text-sm font-medium text-slate-200">Could not verify admin access.</p>
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
          <h1 className={adminUi.sidebarTitle}>Admin</h1>
          <p className={adminUi.sidebarTagline}>Platform operations</p>
          <nav className="mt-8 text-sm">
            <NavSection title="Operations">
              <NavLink href="/admin/dashboard">Dashboard</NavLink>
              <NavLink href="/admin/users">Accounts</NavLink>
              <NavLink href="/admin/teams">Teams</NavLink>
              <NavLink href="/admin/athletic-departments">Athletic departments</NavLink>
              <NavLink href="/admin/provisioning">Provisioning</NavLink>
            </NavSection>

            <NavSection title="Platform">
              {caps && (caps.canViewBilling || caps.canManageBilling) ? (
                <NavLink href="/admin/billing">Billing</NavLink>
              ) : null}
              {caps?.canViewAuditLogs ? <NavLink href="/admin/audit">Audit</NavLink> : null}
              {caps && (caps.canViewAuditLogs || caps.canManageUsers) ? (
                <NavLink href="/admin/document-audit">Document audit</NavLink>
              ) : null}
              {caps?.canManageRoles ? <NavLink href="/admin/roles">Roles &amp; permissions</NavLink> : null}
              {caps?.canManagePlatformSettings ? <NavLink href="/admin/settings/system">System settings</NavLink> : null}
            </NavSection>

            <NavSection title="Session">
              <Link href="/dashboard" className={adminNavLinkClass(false)}>
                Exit to app
              </Link>
            </NavSection>
          </nav>
        </aside>
        <main className={adminUi.main}>{children}</main>
      </div>
    </div>
  )
}
