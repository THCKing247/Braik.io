"use client"

/**
 * Dev-only same-origin /api request counter. Warns on duplicate URLs during one page load
 * and on direct browser Supabase REST RPC calls (messaging inbox stats must use Braik API).
 */

const SUPABASE_RPC_PATH_RE = /\/rest\/v1\/rpc\/(messaging_unread_total_for_team_user|message_threads_inbox_stats)/i

type Entry = { count: number; methods: Set<string> }

let installed = false
let pageLoadId = ""
const counts = new Map<string, Entry>()

function monitorEnabled(): boolean {
  if (typeof window === "undefined") return false
  if (process.env.NEXT_PUBLIC_DEBUG_FETCHES === "1") return true
  return process.env.NODE_ENV !== "production"
}

function resetForNavigation() {
  counts.clear()
  pageLoadId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
}

function track(url: string, method: string) {
  if (!monitorEnabled()) return
  const entry = counts.get(url) ?? { count: 0, methods: new Set<string>() }
  entry.count += 1
  entry.methods.add(method)
  counts.set(url, entry)
  if (entry.count === 2) {
    console.warn(`[braik-fetch] duplicate same-origin request during page load: ${method} ${url}`, {
      pageLoadId,
    })
  }
}

function normalizeApiUrl(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const u = new URL(raw, window.location.origin)
    if (u.origin !== window.location.origin) return null
    if (!u.pathname.startsWith("/api/")) return null
    return `${u.pathname}${u.search}`
  } catch {
    return null
  }
}

function warnSupabaseRpc(url: string, method: string) {
  if (!monitorEnabled()) return
  if (!SUPABASE_RPC_PATH_RE.test(url)) return
  console.warn(`[braik-fetch] direct browser Supabase messaging RPC (use /api/messages/* instead): ${method} ${url}`, {
    pageLoadId,
  })
}

/** Patch `window.fetch` once; safe to call from instrumentation mount. */
export function installClientApiFetchMonitor(): void {
  if (!monitorEnabled() || installed || typeof window === "undefined") return
  installed = true
  resetForNavigation()

  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
    const apiUrl = normalizeApiUrl(input)
    if (apiUrl) track(apiUrl, method)

    try {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const absolute = new URL(raw, window.location.origin).href
      warnSupabaseRpc(absolute, method)
    } catch {
      /* ignore */
    }

    return nativeFetch(input, init)
  }

  window.addEventListener("popstate", resetForNavigation)

  if (monitorEnabled()) {
    const w = window as Window & {
      __braikFetchSummary?: () => ClientApiFetchSummary | null
      __braikFetchReset?: () => void
    }
    w.__braikFetchSummary = logClientApiFetchSummary
    w.__braikFetchReset = resetClientApiFetchMonitor
  }
}

export type ClientApiFetchSummaryRow = { url: string; count: number; methods: string }

export type ClientApiFetchSummary = {
  pageLoadId: string
  total: number
  duplicates: ClientApiFetchSummaryRow[]
  rows: ClientApiFetchSummaryRow[]
}

export function getClientApiFetchSummary(): ClientApiFetchSummary | null {
  if (!monitorEnabled()) return null
  const rows = [...counts.entries()]
    .map(([url, e]) => ({ url, count: e.count, methods: [...e.methods].join(",") }))
    .sort((a, b) => b.count - a.count || a.url.localeCompare(b.url))
  const duplicates = rows.filter((r) => r.count > 1)
  return { pageLoadId, total: rows.length, duplicates, rows }
}

export function resetClientApiFetchMonitor(): void {
  if (!monitorEnabled()) return
  resetForNavigation()
}

export function logClientApiFetchSummary(): ClientApiFetchSummary | null {
  const summary = getClientApiFetchSummary()
  if (!summary) return null
  console.info("[braik-fetch] same-origin /api summary", summary)
  return summary
}
