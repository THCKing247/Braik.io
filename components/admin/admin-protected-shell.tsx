"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Phase = "loading" | "ok" | "error"

const ACCESS_CHECK_TIMEOUT_MS = 20_000

export function AdminProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("loading")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), ACCESS_CHECK_TIMEOUT_MS)
      try {
        const res = await fetch("/api/admin/access-check", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        })
        if (res.status === 401) {
          router.replace("/admin/login")
          return
        }
        if (res.status === 403) {
          router.replace("/")
          return
        }
        if (!res.ok) {
          let detail = String(res.status)
          try {
            const body = (await res.json()) as { error?: string; reason?: string }
            if (body.error) detail = body.error
            else if (body.reason) detail = body.reason
          } catch {
            /* ignore */
          }
          if (process.env.NODE_ENV === "development") {
            console.warn("[admin] access-check failed", res.status, detail)
          }
          throw new Error(detail)
        }
        if (!cancelled) setPhase("ok")
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          if (process.env.NODE_ENV === "development") {
            console.warn("[admin] access-check timed out after", ACCESS_CHECK_TIMEOUT_MS, "ms")
          }
        }
        if (!cancelled) setPhase("error")
      } finally {
        window.clearTimeout(timeoutId)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (phase === "loading") {
    return (
      <div className="min-h-screen w-full bg-admin-page text-zinc-100 flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading admin…</p>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen w-full bg-admin-page text-zinc-100 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-zinc-300">Could not verify admin access.</p>
        <Link href="/admin/login" className="text-cyan-300 underline">
          Admin login
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-admin-page text-zinc-100">
      <div className="flex w-full gap-0">
        <aside className="sticky top-0 h-screen w-72 shrink-0 border-r border-white/[0.08] bg-admin-sidebar p-5 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Braik Super Admin</p>
          <h1 className="mt-2 text-xl font-semibold text-zinc-50">Backend Console</h1>
          <nav className="mt-5 space-y-2 text-sm">
            <Link href="/admin" className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
              Overview
            </Link>
            <Link href="/admin/users" className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
              Accounts
            </Link>
            <Link href="/admin/teams" className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
              Teams
            </Link>
            <Link
              href="/admin/athletic-departments"
              className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
            >
              Athletic Departments
            </Link>
            <Link
              href="/admin/provisioning"
              className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
            >
              Provisioning
            </Link>
            <Link href="/admin/billing" className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
              Billing
            </Link>
            <Link href="/admin/audit" className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
              Audit
            </Link>
            <Link href="/admin/document-audit" className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
              Document audit
            </Link>
            <Link href="/admin/settings/system" className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
              System Settings
            </Link>
            <Link href="/admin/dashboard" className="block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
              Dashboard
            </Link>
            <Link href="/dashboard" className="mt-3 block rounded px-3 py-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100">
              Exit to App
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-6 py-6 text-zinc-100">{children}</main>
      </div>
    </div>
  )
}
