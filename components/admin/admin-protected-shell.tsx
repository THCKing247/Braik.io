"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Phase = "loading" | "ok" | "error"

export function AdminProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("loading")

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
              href="/admin/provisioning"
              className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              Provisioning
            </Link>
            <Link href="/admin/billing" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Billing
            </Link>
            <Link href="/admin/audit" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Audit
            </Link>
            <Link href="/admin/document-audit" className="block rounded px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Document audit
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
