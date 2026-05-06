# Phase 10 — Release readiness & product-flow performance QA

**Date:** 2026-05-06 (agent session)  
**Scope:** End-to-end validation *per plan* after Phases 0–9. **Browser-based manual QA** in this session is *reasoning + documentation*; a human must run `DEPLOY_SMOKE_TEST_CHECKLIST.md` / `PERFORMANCE_RELEASE_CHECKLIST.md` before a production cut.

## Summary

| Area | Result |
|------|--------|
| Automated | `npm run typecheck`, `npm run perf:audit`, `npm run build` **pass** (see below). |
| Bundle / route sizes | Recorded from latest `next build` output + `check-bundle-budget` (see **Release baseline**). |
| Client perf instrumentation | **Master switch** `NEXT_PUBLIC_BRAIK_PERF=1` added (`lib/debug/braik-client-perf-master.ts`); wires nav, shell, bootstrap, auth client, AD teams client logs. **No** `web_vitals.lcp` in repo — follow-up P2. |
| Supabase / Netlify live dashboards | **Not accessed** from this environment — use `PRODUCTION_OBSERVABILITY_CHECKLIST.md`. |
| **Go / no-go** | **GO for merge of this PR** from a *tooling/CI* perspective; **conditional GO for production** until human smoke + Supabase/Netlify spot checks complete. |

## Test environment

- **Local / CI:** Windows; Node as per project; commands run in repo root.
- **Production URL:** not exercised (no live browser session).

## Build / deploy version

- **Branch / commit:** not pinned in this doc — fill at release time.
- **Netlify:** `netlify.toml` — `npm run build`, `publish = ".next"`, `NODE_VERSION = "22"`, `@netlify/plugin-nextjs` (see `PHASE_9_DEPLOYMENT_OBSERVABILITY_REPORT.md`).

## Validation command results

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `npm run perf:audit` | Pass (within `performance-budget.config.json`; informational client-file sizes) |
| `npm run build` | Pass |
| `npm run analyze` | **Not re-run** (full duplicate production build + analyzer); run manually before major releases |

## Release baseline (bundle / First Load JS)

From **`next build`** route table (sizes are Next “First Load JS” for route + shared):

| Route / artifact | First Load JS (approx.) |
|-------------------|-------------------------|
| **Shared First Load JS** | **82.8 kB** |
| **Homepage `/`** | **181 kB** |
| **`/dashboard`** | **189 kB** |
| **`/dashboard/messages`** | **165 kB** |
| **`/dashboard/roster/[playerId]`** | **243 kB** (largest portal route in table) |

From **`perf:audit` → check-bundle-budget** (`.next/static/chunks`):

| Metric | Value |
|--------|-------|
| Largest raw chunk | **~336 KB** (`5530.*.js`) |
| Shared-ish heuristic sum | **~344 KB** raw (script-estimated) |

**Heavy dependency audit:** `recharts` in `ad-coaches-pie-chart-card` (allowlisted); no new unexpected heavy imports flagged.

## Routes tested (coverage model)

| Category | Coverage |
|----------|----------|
| **Marketing / public** | Reasoned: `/`, `/pricing`, `/request-access`, `/login` exist in build output; middleware redirects retired `/signup` → `/request-access`. |
| **Auth** | Reasoned: `/login`, `/api/auth/*`, cookie gate via `middleware.ts` unchanged. |
| **Dashboard** | Build lists all `/dashboard/*` routes; shell deferred bootstrap patterns preserved (Phase 3). |
| **Messaging** | `/dashboard/messages`; `MessagingManager` + `navPerfDev` markers preserved; Phase 7 mobile pane split preserved in codebase review. |
| **Media** | Lazy attachment components referenced in Phase 6 docs; no schema change this phase. |
| **Admin** | `/admin/*` routes built as λ. |
| **AD portal** | `/dashboard/ad/*` built. |
| **Recruiting public** | `/recruiting/[slugOrId]` present. |

## Desktop scenarios (reasoned / doc-backed)

- **Homepage & CTAs:** Marketing routes compile; no structural change this phase.
- **Login → dashboard:** Middleware requires `sb-access-token` for `/dashboard`; Supabase config enforced by `verify-env` on CI builds.
- **Sidebar / route transitions:** `DashboardLayoutClient` + conditional sidebar mount at `lg+` (Phase 7); perf hooks via `NEXT_PUBLIC_BRAIK_PERF=1`.
- **Notifications badge:** Component unchanged; manual badge check still required.
- **Coach B:** `/api/ai/chat` + gated logs (Phase 9).
- **Widgets:** Deferred hints / readiness patterns unchanged.

## Mobile scenarios (reasoned)

- **Viewport:** Phase 7 documented (`PHASE_7_MOBILE_PERFORMANCE_REPORT.md`): tab bar, More sheet, messaging list/detail unmount behavior.
- **Keyboard / modals:** Not re-tested in browser; note in follow-ups if issues recur.

## Messaging scenarios

- Thread open / fetch / render markers: `navPerfDev("messages.thread_open.*")` when **`NEXT_PUBLIC_BRAIK_PERF=1`** (via master bundle).
- Send path: optimistic markers `messages.send.*` in `use-optimistic-message-send.ts`.
- **Realtime:** Requires live Supabase — manual check.

## Media scenarios

- Private attachments / signed URLs: **no change** this phase; authorization unchanged.
- Follow **Phase 6** checklist for release verification.

## Dashboard scenarios

- Bootstrap split APIs unchanged; `dashboardBootstrapClientPerf` enabled under master perf flag.

## Auth / portal scenarios

| Portal | Notes |
|--------|--------|
| Coach / staff | Full dashboard tree in build. |
| Player / parent | Routes gated by RBAC in app (unchanged). |
| Recruiter | `/dashboard/recruiting`, public recruiting page. |
| Platform admin | `/admin/*` λ routes. |

## Phase 0 instrumentation verification

| Expected (task) | Actual |
|-----------------|--------|
| `web_vitals.lcp` | **Not implemented** — add as P2 follow-up (`reportWebVitals` / `web-vitals` package). |
| `route_transition` | Implemented as **`[braik-nav-perf]`** labels (`navPerfDev`), not separate JSON event names. |
| Dashboard readiness | **`[braik-dashboard-perf]`** (`dashboardShellPerf`) |
| Messaging thread open/send | **`messages.thread_open.*`**, **`messages.send.*`** via `navPerfDev` |
| Gated / safe | **Yes** — only when `NEXT_PUBLIC_BRAIK_PERF=1` or granular flags; logs use IDs/metadata, not message bodies (avoid logging content in prod). |

**How to verify locally:** `npm run dev:perf` → open dashboard/messages → confirm console lines above.

## Known regressions

- **None identified** from automated commands in this session.
- **Manual-only risks:** auth cookie edge cases, Netlify function cold starts, Supabase regional latency — track under operational follow-ups.

## Fixes made (this phase)

| Change | Purpose |
|--------|---------|
| `lib/debug/braik-client-perf-master.ts` | Master client perf switch `NEXT_PUBLIC_BRAIK_PERF` |
| Wired into nav / shell / bootstrap / auth client / AD teams perf | Single-env QA |
| `npm run dev:perf` | Convenience script |
| `PERFORMANCE_REGRESSION_CHECKLIST.md` | Correct perf env documentation |

## Follow-up tickets

See **`PERFORMANCE_FOLLOW_UPS.md`**.

## Go / no-go recommendation

- **Code merge:** **GO** (typecheck + build + perf audit green; small additive perf wiring only).
- **Production release:** **CONDITIONAL GO** — complete **`PERFORMANCE_RELEASE_CHECKLIST.md`** human sections + Supabase/Netlify sanity from **`PRODUCTION_OBSERVABILITY_CHECKLIST.md`** before tagging production.
