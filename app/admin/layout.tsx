import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasAdminAccess } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"

export default async function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const allowed = await hasAdminAccess(session.user.id, session.user.email)
  if (!allowed) {
    await writeAdminAuditLog({
      actorId: session.user.id,
      action: "admin_access_denied",
      targetType: "route",
      targetId: "/admin",
      metadata: { reason: "layout_guard_reject" },
    }).catch(() => undefined)
    redirect("/")
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
              Users
            </Link>
            <Link href="/admin/teams" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Teams
            </Link>
            <Link href="/admin/billing" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Billing
            </Link>
            <Link href="/admin/audit" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Audit
            </Link>
            <Link href="/admin/settings/system" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              System Settings
            </Link>
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
