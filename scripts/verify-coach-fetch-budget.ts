/**
 * Head coach dashboard fetch budget verification (production build + DEBUG_FETCHES).
 *
 *   $env:NEXT_PUBLIC_DEBUG_FETCHES="1"; npm run build
 *   $env:NEXT_PUBLIC_DEBUG_FETCHES="1"; npm run start
 *   npx tsx scripts/verify-coach-fetch-budget.ts
 *
 * Env: BASE_URL, COACH_EMAIL, COACH_PASSWORD, SHORT_ORG_ID (default 1), SHORT_TEAM_ID (default 1)
 */

import { chromium, type Page, type Request } from "playwright"

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")
const COACH_EMAIL = process.env.COACH_EMAIL ?? "coach@example.com"
const COACH_PASSWORD = process.env.COACH_PASSWORD ?? "password123"
const SHORT_ORG = process.env.SHORT_ORG_ID ?? "1"
const SHORT_TEAM = process.env.SHORT_TEAM_ID ?? "1"
const SETTLE_MS = 8_000

const SUPABASE_RPC_RE =
  /\/rest\/v1\/rpc\/(messaging_unread_total_for_team_user|message_threads_inbox_stats)/i

type RouteStep = {
  name: string
  path: string
  hard?: boolean
  action?: (page: Page) => Promise<void>
}

type UrlCount = { url: string; count: number; methods: Set<string> }

function normalizeTrackedUrl(req: Request): string | null {
  try {
    const u = new URL(req.url())
    if (u.origin !== new URL(BASE_URL).origin) return null
    if (u.pathname.startsWith("/api/")) return `${u.pathname}${u.search}`
    if (u.search.includes("_rsc=")) return `${u.pathname}${u.search}`
    return null
  } catch {
    return null
  }
}

function bump(map: Map<string, UrlCount>, url: string, method: string) {
  const e = map.get(url) ?? { url, count: 0, methods: new Set<string>() }
  e.count += 1
  e.methods.add(method)
  map.set(url, e)
}

function rows(map: Map<string, UrlCount>) {
  return [...map.values()]
    .map((r) => ({ url: r.url, count: r.count, methods: [...r.methods].join(",") }))
    .sort((a, b) => b.count - a.count || a.url.localeCompare(b.url))
}

function countMatching(map: Map<string, UrlCount>, re: RegExp): UrlCount[] {
  return [...map.values()].filter((r) => re.test(r.url))
}

async function login(page: Page) {
  const res = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: COACH_EMAIL, password: COACH_PASSWORD, rememberMe: true },
  })
  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`Login failed (${res.status()}): ${body.slice(0, 400)}`)
  }
}

async function collectStep(
  page: Page,
  step: RouteStep,
  network: Map<string, UrlCount>,
  supabaseRpc: string[],
) {
  network.clear()
  supabaseRpc.length = 0

  const onRequest = (req: Request) => {
    const api = normalizeTrackedUrl(req)
    if (api) bump(network, api, req.method())
    if (SUPABASE_RPC_RE.test(req.url())) {
      supabaseRpc.push(`${req.method()} ${req.url()}`)
    }
  }
  page.on("request", onRequest)

  await page.goto(`${BASE_URL}${step.path}`, { waitUntil: "domcontentloaded" })
  if (step.hard) {
    await page.reload({ waitUntil: "domcontentloaded" })
  }

  network.clear()
  supabaseRpc.length = 0
  await page.evaluate(() => {
    const w = window as Window & { __braikFetchReset?: () => void }
    w.__braikFetchReset?.()
  })

  if (step.action) {
    await step.action(page)
  }

  await page.waitForTimeout(SETTLE_MS)

  const monitorSummary = await page.evaluate(() => {
    const w = window as Window & {
      __braikFetchSummary?: () => {
        rows: Array<{ url: string; count: number; methods: string }>
        duplicates: Array<{ url: string; count: number }>
      } | null
    }
    return w.__braikFetchSummary?.() ?? null
  })

  page.off("request", onRequest)

  return { network: rows(network), supabaseRpc: [...supabaseRpc], monitorSummary }
}

function violationsForStep(
  stepName: string,
  network: Array<{ url: string; count: number; methods: string }>,
  supabaseRpc: string[],
) {
  const issues: string[] = []
  const get = (re: RegExp) => network.filter((r) => re.test(r.url))

  if (stepName.includes("coach landing")) {
    const ad = get(/\/api\/me\/ad-portal\b/)
    const n = ad.reduce((s, r) => s + r.count, 0)
    if (n > 1) issues.push(`/api/me/ad-portal called ${n} times (max 1)`)
  }

  if (stepName.includes("team home")) {
    const ann = get(/\/api\/teams\/[^/]+\/team-announcements\b/)
    const n = ann.reduce((s, r) => s + r.count, 0)
    if (n > 1) issues.push(`team-announcements called ${n} times (max 1)`)
  }

  if (stepName.includes("roster default")) {
    for (const pat of [
      /readiness\?[^]*summaryOnly=1/,
      /readiness\?[^]*playerFlagsOnly=1/,
      /readiness\?[^]*section=attention/,
      /readiness\?[^]*section=checklist/,
    ]) {
      const hits = get(pat)
      if (hits.length) issues.push(`unexpected readiness on default roster: ${hits.map((h) => h.url).join(", ")}`)
    }
  }

  if (stepName.includes("readiness tab")) {
    const bundle = get(/readiness\?[^]*bundle=1/)
    if (!bundle.length) issues.push("missing readiness?bundle=1 on readiness tab")
    const bad = get(/readiness\?[^]*(summaryOnly=1|playerFlagsOnly=1)/)
    if (bad.length) issues.push(`forbidden readiness variants: ${bad.map((b) => b.url).join(", ")}`)
    const sections = get(/readiness\?[^]*section=(attention|checklist)/)
    if (sections.length > 1) {
      issues.push(`multiple readiness sections in one view: ${sections.map((s) => `${s.url} x${s.count}`).join("; ")}`)
    }
  }

  if (stepName.includes("messages list")) {
    const threads = get(/\/api\/messages\/threads\?/)
    const n = threads.reduce((s, r) => s + r.count, 0)
    if (n !== 1) issues.push(`/api/messages/threads list calls: ${n} (expected 1)`)
  }

  if (stepName === "5 messages list") {
    const heavyPrefetch = network.filter(
      (r) =>
        r.url.includes("_rsc=") &&
        /\/(inventory|game-video|roster|playbooks|documents)(?:\?|$)/.test(r.url),
    )
    if (heavyPrefetch.length) {
      issues.push(
        `heavy route RSC prefetch from messages: ${heavyPrefetch.map((h) => h.url).join(", ")}`,
      )
    }
  }

  if (stepName.includes("message thread")) {
    const read = get(/\/api\/messages\/threads\/[^/]+\/read/)
    const readN = read.reduce((s, r) => s + r.count, 0)
    if (readN !== 1) issues.push(`POST read calls: ${readN} (expected 1)`)
    const detail = get(/\/api\/messages\/thread\/[^/?]+/)
    const detailN = detail.reduce((s, r) => s + r.count, 0)
    if (detailN !== 1) issues.push(`GET thread detail calls: ${detailN} (expected 1)`)
  }

  if (stepName.includes("game video")) {
    const aggregated = get(/\/api\/teams\/[^/]+\/game-videos\/clips(?:\?|$)/)
    const aggN = aggregated.reduce((s, r) => s + r.count, 0)
    if (aggN !== 1) {
      issues.push(`GET /game-videos/clips calls: ${aggN} (expected 1)`)
    }
    const perFilm = get(/\/api\/teams\/[^/]+\/game-videos\/[^/]+\/clips\b/)
    if (perFilm.length) {
      issues.push(
        `per-film clip list on library load (use team /clips): ${perFilm.map((p) => `${p.url} x${p.count}`).join("; ")}`,
      )
    }
  }

  if (supabaseRpc.length) {
    issues.push(`browser Supabase RPC: ${supabaseRpc.join("; ")}`)
  }

  const dups = network.filter((r) => r.count > 1)
  if (dups.length) {
    issues.push(`duplicate /api URLs: ${dups.map((d) => `${d.url} x${d.count}`).join("; ")}`)
  }

  return issues
}

async function openFirstMessageThread(page: Page) {
  const link = page.locator('a[href*="/messages/"]').first()
  await link.waitFor({ state: "visible", timeout: 15_000 })
  await link.click()
}

async function main() {
  const teamBase = `/dashboard/org/${SHORT_ORG}/team/${SHORT_TEAM}`
  const steps: RouteStep[] = [
    { name: "1 coach landing (hard reload)", path: "/dashboard/coach", hard: true },
    { name: "2 team home", path: teamBase },
    { name: "3 roster default", path: `${teamBase}/roster` },
    { name: "4 readiness tab", path: `${teamBase}/roster?tab=readiness` },
    { name: "5 messages list", path: `${teamBase}/messages` },
    {
      name: "6 message thread",
      path: `${teamBase}/messages`,
      action: openFirstMessageThread,
    },
    { name: "7 messages list (return)", path: `${teamBase}/messages` },
    { name: "8 inventory", path: `${teamBase}/inventory` },
    { name: "9 game video", path: `${teamBase}/game-video` },
  ]

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log(`Verifying coach fetch budget at ${BASE_URL}`)
  console.log(`Coach: ${COACH_EMAIL} | team path: ${teamBase}\n`)

  await login(page)

  const network = new Map<string, UrlCount>()
  const supabaseRpc: string[] = []
  const report: Array<{
    step: string
    network: Array<{ url: string; count: number; methods: string }>
    supabaseRpc: string[]
    issues: string[]
    monitorDuplicates: string[]
  }> = []

  for (const step of steps) {
    console.log(`— ${step.name}`)
    const result = await collectStep(page, step, network, supabaseRpc)
    const issues = violationsForStep(step.name, result.network, result.supabaseRpc)
    const monitorDuplicates =
      result.monitorSummary?.duplicates?.map((d) => `${d.url} x${d.count}`) ?? []
    report.push({
      step: step.name,
      network: result.network,
      supabaseRpc: result.supabaseRpc,
      issues,
      monitorDuplicates,
    })
    if (issues.length) {
      console.log("  FAIL:", issues.join(" | "))
    } else {
      console.log("  OK")
    }
    const top = result.network.slice(0, 12)
    if (top.length) {
      for (const r of top) {
        console.log(`    ${r.count}x ${r.url}`)
      }
    }
  }

  await browser.close()

  const failed = report.filter((r) => r.issues.length > 0)
  console.log("\n=== Summary ===")
  console.log(`Steps: ${report.length} | Failed: ${failed.length}`)
  if (failed.length) {
    for (const f of failed) {
      console.log(`\n${f.step}:`)
      for (const i of f.issues) console.log(`  - ${i}`)
    }
    process.exit(1)
  }
  console.log("All steps passed fetch budget checks.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
