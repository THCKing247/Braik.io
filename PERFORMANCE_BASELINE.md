# Braik Performance Baseline

This document defines the Phase 0 baseline process for measuring whether Braik feels faster, smoother, and more seamless after each optimization phase.

**Source of truth together with** [PERFORMANCE_GUIDELINES.md](./PERFORMANCE_GUIDELINES.md) (first render, shell/bootstrap fetching, Suspense, and dashboard home import rules).

---

## Current findings (audit snapshot)

_Audited in-repo (no production traffic). Commands run locally after `npm install`._

| Area | Status |
| --- | --- |
| **Homepage (`/`)** | Marketing home is a **client** page (`app/(marketing)/page.tsx`) with `next/dynamic` for below-the-fold chunks (lead form, FAQ CTA) and `next/image` for hero/LCP; aligns with guidelines on lazy non-LCP work. |
| **Dashboard first paint** | **`DashboardTeamShellGate`** gates on **`GET /api/dashboard/shell`** (React Query). Home content uses **`useDashboardShellIdentity`**, static **`TeamDashboard`** import on dashboard home, and **`useBraikPerfDashboardBootstrapReady`** when bootstrap exposes meaningful dashboard slice. |
| **Dashboard bootstrap** | **`lib/dashboard/dashboard-bootstrap-query.ts`** stages **`bootstrap-light`** → **`bootstrap-deferred-core`** → **`bootstrap-deferred-heavy`** (intentional waterfall for idle/first paint — not the same as duplicate fetches of identical shell fields). |
| **Route transitions** | **`BraikPerfAppRouterListener`** logs **`route_transition`** and **`route_transition.intent_to_commit`** when **`markBraikRouteIntent`** is used (e.g. sidebar). |
| **Messaging** | Thread body loads via **`GET /api/messages/thread/:id`** with `includeParticipants=0` for faster open; sends use **optimistic** `setMessages` then reconcile. **No `[braik-perf]` events** are wired in `messaging-manager.tsx` yet — timing is by DevTools / Network for now. |
| **Bundles** | **`npm run build`** did **not** complete type-check in this audit, so **route-level chunk sizes were not captured**. **`next.config.js`** enables **`optimizePackageImports`** for `lucide-react` and several Radix packages. Run **`npm run analyze`** after a green build. |
| **Lint** | **`npm run lint`** **fails** (exit 1): multiple **`react/no-unescaped-entities`** errors on marketing/legal/components, **`react-hooks/rules-of-hooks`** on `app/(portal)/dashboard/(team)/profile/page.tsx`, and **missing ESLint rule definitions** for `@typescript-eslint/no-require-imports` / `no-var-requires` in `components/native/native-app-bootstrap.tsx`, plus many hook-deps **warnings**. **`next.config.js`** sets **`eslint.ignoreDuringBuilds: true`**, so CI/build can still produce artifacts while lint debt remains. |
| **Typecheck** | **`npm run typecheck`** / **`next build` type validation** **fail**: **`scripts/verify-separation.ts`** imports **`../lib/separation-verification`** but the module lives at **`lib/enforcement/separation-verification.ts`**. Additional errors are reported under **`tests/*.ts`** (fixtures vs current `lib/roles`, missing `jest` types, etc.) even though `tsconfig.json` lists **`exclude: ["tests", "scripts"]`** — treat as **tooling/scope drift** until resolved. |
| **Tests (package scripts)** | **`npm run test:playbook`**, **`test:braik-ai`**, **`test:braik-ai-report`**, **`test:release-guards`**, **`test:games-scoring`** **passed** in this environment. |

---

## Risks

1. **Production build / type safety**: Failing `tsc` on scripts (and reported test files) blocks **`next build`** at the “Checking validity of types” step — **no reliable bundle baseline** until fixed.
2. **Lint vs ship**: **`ignoreDuringBuilds`** hides ESLint failures in **`next build`**; **`rules-of-hooks`** errors are **runtime-risk** if that branch ships.
3. **Messaging metrics gap**: Without gated **`[braik-perf]`** (or Web Vitals-style marks) on thread open and send paths, regressions rely on manual profiling.
4. **Staged bootstrap**: Multiple bootstrap endpoints are **by design**; mistaken “deduping” could break idle scheduling (`DEFERRED_*` timings in `dashboard-bootstrap-query.ts`).
5. **Extra first-load work**: Dashboard home **`ATHLETIC_DIRECTOR`** path triggers **`/api/routing/organization-default`** — legitimate, but should be counted in “first usable” traces.

---

## Next measurements needed

1. **Fix typecheck** (minimum: `verify-separation` import path), **`Remove-Item -Recurse -Force .next`** if stale route types appear, then run **`npm run build`** and **`npm run analyze`**; record **largest first-load JS** and **largest route chunks** (dashboard home, messages, playbooks, marketing `/`).
2. **Homepage**: Incognito Performance trace + **`NEXT_PUBLIC_BRAIK_PERF=1`** for **`web_vitals.lcp`** / CLS observer output; confirm hero **`priority`** only on LCP candidate.
3. **Dashboard**: **`BRAIK_PERF=1`** / **`NEXT_PUBLIC_BRAIK_PERF=1`** — capture **`dashboard.bootstrap_content_ready`**, **`route_transition.intent_to_commit` p50/p95**, **`slow_mount`** if any.
4. **Messaging**: Add **temporary** gated marks (per guidelines) for **thread open** (path select → first message paint) and **send** (submit → optimistic row → server-confirmed), or document **Network** timings for **`/api/messages/thread/*`** and **`POST /api/messages/send`**.
5. **Duplicate-fetch audit**: For each new dashboard widget, verify no parallel **`GET /api/teams/:id`** when bootstrap already carries team summary (**`PERFORMANCE_GUIDELINES.md` B**).
6. **PR template**: Use **`.github/pull_request_template.md`** for performance PR questions (see end of this file).

---

## Concrete checklists (fill metrics in the table below)

### 1. Homepage load performance

- [ ] Cold load `/` in incognito; CPU throttle **4×** for at least one run.
- [ ] Record **LCP**, **CLS**, long tasks, total JS time (Performance panel).
- [ ] Confirm below-fold sections use **lazy** `dynamic()` / non-priority images (see `app/(marketing)/page.tsx` comments vs [PERFORMANCE_GUIDELINES.md](./PERFORMANCE_GUIDELINES.md) §A/E).
- [ ] With `NEXT_PUBLIC_BRAIK_PERF=1`, capture **`web_vitals.lcp`** console line.

### 2. Dashboard first usable load

- [ ] After sign-in, measure until **team dashboard chrome + home content** is interactive (not only shell skeleton).
- [ ] Capture **`dashboard.bootstrap_content_ready`** from `[braik-perf]` (requires meaningful bootstrap slice + `useBraikPerfDashboardBootstrapReady` in `TeamDashboard`).
- [ ] Note **`GET /api/dashboard/shell`** and **`bootstrap-light`** waterfall order in Network.
- [ ] If testing **ATHLETIC_DIRECTOR**, include **`/api/routing/organization-default`** in the trace.

### 3. Dashboard route transitions

- [ ] Click primary **sidebar** destinations (each should use intent marking where implemented).
- [ ] Log **`route_transition.intent_to_commit`** (click → pathname commit) and **`route_transition`** (commit → commit).
- [ ] Compare to targets: **p50 &lt; 300ms**, **p95 &lt; 800ms** intent-to-commit (see Metrics table).

### 4. Messaging thread open latency

- [ ] Navigate to Messages; select a thread (path-driven selection in `MessagingManager`).
- [ ] Network: **`GET /api/messages/thread/:id?limit=40&attachments=metadata&includeParticipants=0`** TTFB + download.
- [ ] UI: time to **first message list paint** (manual or Performance mark — **instrumentation TBD**).
- [ ] Target: **&lt; 500ms p50** after cached shell (see Metrics table).

### 5. Messaging send-to-render latency

- [ ] Send one message; observe **optimistic** append vs **server-confirmed** list state (`messaging-manager.tsx`).
- [ ] Network: **`POST`** send route + any follow-up **`loadMessages`** refresh.
- [ ] Target: **optimistic render &lt; 100ms** perceived (see Metrics table).

### 6. Largest route / client bundles

- [ ] Run `npm run analyze` after a **successful** `next build`.
- [ ] Save treemap notes for: **shared** chunk, **dashboard** entry, **messages**, **marketing `/`**, **playbook/PDF**-heavy routes.
- [ ] Cross-check **`optimizePackageImports`** in `next.config.js` for icon/Radix bloat.

### 7. Duplicate first-render API calls

- [ ] In Network, filter first paint for: **`/api/dashboard/shell`**, **`bootstrap-light`**, **`bootstrap-deferred-*`** — expect **staged** loads, not repeated identical requests with same payload.
- [ ] Flag any **`GET /api/teams/:id`** on dashboard home if bootstrap already includes team summary (guidelines: **fallback only** when bootstrap missing/failed).
- [ ] Watch for **double shell** or **parallel** bootstrap keys for the same `teamId` in React Query devtools (if enabled).

### 8. Lint, typecheck, and test status

- [ ] `npm run lint` — track **errors vs warnings**; do not assume green because `next build` skips lint.
- [ ] `npm run typecheck` — must be green for **`prebuild`** / release confidence.
- [ ] Run: `test:playbook`, `test:braik-ai`, `test:braik-ai-report`, `test:release-guards`, `test:games-scoring` (and any feature-specific scripts).

---

## Performance PR checklist (also in `.github/pull_request_template.md`)

Every **performance-related** PR should answer:

- Does this affect **first render**?
- Does it add a **new fetch**?
- Can the data come from **shell/bootstrap** instead?
- Does it add a new **Suspense/loading** state?
- What **before/after measurement** proves the improvement?

---

## Goals

Capture repeatable before/after data for:

- Web Vitals: LCP, CLS, FID, long interactions / INP signals
- route transition latency
- user intent to route commit latency
- dashboard bootstrap readiness
- messaging thread open latency
- messaging send-to-render latency
- bundle size by route
- slow client mounts and hydration-heavy components

## Runtime switches

Client instrumentation is gated and logs to the browser console with the `[braik-perf]` prefix.

```bash
NEXT_PUBLIC_BRAIK_PERF=1 npm run dev
```

Server instrumentation is gated separately.

```bash
BRAIK_PERF=1 npm run dev
```

Disable explicitly when needed:

```bash
NEXT_PUBLIC_BRAIK_PERF=0 BRAIK_PERF=0 npm run dev
```

## Bundle analysis

Run:

```bash
npm install
npm run analyze
```

The bundle analyzer opens Next.js client and server bundle treemaps. Save screenshots or notes for:

- largest shared client chunks
- largest route-specific client chunks
- dashboard routes
- messaging routes
- marketing homepage
- PDF/document-related chunks
- duplicated dependencies

## Browser profiling checklist

Use Chrome DevTools Performance panel with CPU throttling set to 4x for at least one run.

### Scenario A: public homepage

1. Open `/` in a fresh incognito window.
2. Record page load.
3. Capture:
   - LCP
   - CLS
   - long interactions
   - total JS execution time
   - largest client chunks

### Scenario B: authenticated dashboard load

1. Sign in.
2. Navigate to the main dashboard.
3. Record from click/sign-in completion until dashboard content is usable.
4. Capture:
   - `dashboard.bootstrap_content_ready`
   - slow mount logs
   - route transition logs
   - long interactions

### Scenario C: dashboard navigation

1. Click through the main sidebar routes.
2. Capture:
   - `route_transition.intent_to_commit`
   - `route_transition`
   - any long interactions over 40ms

### Scenario D: messaging thread open

1. Open Messages.
2. Select a thread.
3. Capture:
   - thread open latency
   - message list render timing
   - network waterfall for `/api/messages/thread/*`
   - scroll jank or long interactions

### Scenario E: message send

1. Send a message in an existing thread.
2. Capture:
   - click/submit to optimistic render
   - API completion latency
   - final server-confirmed render latency
   - duplicate renders or layout shifts

### Scenario F: long thread / attachment-heavy thread

1. Open a thread with many messages and attachments.
2. Scroll top to bottom.
3. Capture:
   - dropped frames
   - long interactions
   - image/attachment request count
   - memory growth

## Metrics table

Record baseline values here before beginning Phase 1 and Phase 2.

| Scenario | Metric | Baseline | After Phase 1 | After Phase 2 | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| Homepage | LCP | TBD | TBD | TBD |  |
| Homepage | CLS | TBD | TBD | TBD |  |
| Dashboard load | dashboard.bootstrap_content_ready | TBD | TBD | TBD |  |
| Dashboard nav | route_transition.intent_to_commit p50 | TBD | TBD | TBD |  |
| Dashboard nav | route_transition.intent_to_commit p95 | TBD | TBD | TBD |  |
| Messages | thread open latency | TBD | TBD | TBD |  |
| Messages | send-to-optimistic-render | TBD | TBD | TBD |  |
| Messages | send-to-server-confirmed-render | TBD | TBD | TBD |  |
| Messages | long interactions count | TBD | TBD | TBD |  |
| Bundle | largest client route chunk | TBD | TBD | TBD |  |
| Bundle | first load shared JS | TBD | TBD | TBD |  |

## Console log examples

Expected logs look like:

```text
[braik-perf] {"event":"web_vitals.lcp","ms":1234,"t":1300}
[braik-perf] {"event":"route_transition.intent_to_commit","to":"/dashboard/...","ms":420,"t":5000}
[braik-perf] {"event":"dashboard.bootstrap_content_ready","teamId":"...","ms_since_origin":1800,"t":1820}
```

## Performance targets

Initial targets for the optimization program:

- LCP under 2.5s on desktop and under 3.5s on mobile
- CLS under 0.1
- route intent-to-commit under 300ms p50 and under 800ms p95
- messaging thread open under 500ms p50 after cached shell load
- message optimistic render under 100ms
- no repeated long interactions during normal message scrolling

## Rules for future phases

- Do not mark an optimization complete without a before/after measurement.
- Prefer route-level and interaction-level measurements over broad impressions.
- Keep instrumentation gated behind `BRAIK_PERF` / `NEXT_PUBLIC_BRAIK_PERF`.
- Do not add analytics dependencies to critical client bundles unless necessary.
- Keep screenshots or notes from bundle analyzer after each major refactor.
