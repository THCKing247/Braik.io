# Braik Performance Baseline

This document defines the Phase 0 baseline process for measuring whether Braik feels faster, smoother, and more seamless after each optimization phase.

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
