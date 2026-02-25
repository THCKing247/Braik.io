import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasAdminAccess } from "@/lib/admin-access"

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
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Braik Owner Console</p>
            <h1 className="text-xl font-semibold">Admin Portal</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-white/80 hover:text-white">
              Dashboard
            </Link>
            <Link href="/admin/users" className="text-white/80 hover:text-white">
              Users
            </Link>
            <Link href="/admin/teams" className="text-white/80 hover:text-white">
              Teams
            </Link>
            <Link href="/admin/tickets" className="text-white/80 hover:text-white">
              Tickets
            </Link>
            <Link href="/admin/announcements" className="text-white/80 hover:text-white">
              Announcements
            </Link>
            <Link href="/admin/audit" className="text-white/80 hover:text-white">
              Audit
            </Link>
            <Link href="/dashboard" className="text-white/80 hover:text-white">
              Main App
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
