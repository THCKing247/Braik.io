"use client"

import { Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

const QUICK_LINKS = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/users", label: "Accounts" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/provisioning", label: "Provisioning" },
  { href: "/admin/audit", label: "Audit" },
] as const

/**
 * Fixed (sticky) admin chrome: global search jumps to Accounts with a query; quick links for core surfaces.
 */
export function AdminTopBar() {
  const router = useRouter()
  const [q, setQ] = useState("")

  const runSearch = useCallback(() => {
    const trimmed = q.trim()
    const sp = new URLSearchParams()
    if (trimmed) sp.set("q", trimmed)
    const qs = sp.toString()
    router.push(qs ? `/admin/users?${qs}` : "/admin/users")
  }, [q, router])

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[var(--admin-header,3rem)] shrink-0 items-center gap-3 border-b border-admin-border",
        "bg-admin-surface/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-admin-surface/90 sm:gap-4 sm:px-4"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-admin-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              runSearch()
            }
          }}
          placeholder="Search accounts (email, name)…"
          className={cn(adminUi.toolbarInput, "min-w-0 flex-1 md:max-w-md")}
          aria-label="Search accounts"
        />
        <button type="button" onClick={runSearch} className={cn(adminUi.btnSecondarySm, "hidden sm:inline-flex")}>
          Go
        </button>
      </div>
      <nav
        className="hidden items-center gap-1 overflow-x-auto lg:flex"
        aria-label="Quick navigation"
      >
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded px-2 py-1 text-xs font-semibold text-admin-secondary transition-colors hover:bg-admin-stripe hover:text-admin-primary"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
