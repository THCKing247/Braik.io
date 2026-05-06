# Performance regression checklist

Use before/after comparisons when landing performance-sensitive PRs. Pair with `PERFORMANCE_GUIDELINES.md` and Phase reports.

## References

| Doc | Contents |
|-----|----------|
| `PERFORMANCE_GUIDELINES.md` | Day-to-day rules |
| `PHASE_4_REPORT.md` | Earlier phase notes |
| `PHASE_5_DATABASE_PERFORMANCE_REPORT.md` | Queries, indexes, RPC |
| `PHASE_6_MEDIA_PERFORMANCE_REPORT.md` | Images, video, attachments |
| `PHASE_7_MOBILE_PERFORMANCE_REPORT.md` | Mobile shell, messaging, touch |
| `PHASE_8_GUARDRAILS_REPORT.md` | Scripts, budgets, strict modes |

*(If `PERFORMANCE_BASELINE.md` is added later, store numeric baselines there.)*

## Local profiling

1. **Chrome DevTools → Performance** — record interaction (open dashboard, switch thread, open modal). Watch long tasks & layout thrash.
2. **Network** — throttle to Fast 3G for mobile-shaped loads; verify no accidental eager media.
3. **`NEXT_PUBLIC_BRAIK_PERF=1`** (`npm run dev:perf`) — enables client perf bundle: `[braik-nav-perf]`, `[braik-dashboard-perf]`, `[braik-bootstrap-client]`, `[braik-auth-timing]` (client), messaging thread markers, etc. See `lib/debug/braik-client-perf-master.ts`. Not set in production by default.

## Bundle analysis

```bash
npm run build
npm run analyze
```

Opens / writes analyzer output (via `@next/bundle-analyzer` when `ANALYZE=true`). Inspect largest chunks and shared bundles.

```bash
npm run perf:bundle
```

Prints largest `.next/static/chunks/*.js` files vs `performance-budget.config.json` (warning-first).

## Automation

```bash
npm run perf:audit
```

Runs use-client audit, heavy-import audit, and bundle budget (no-op budget if `.next` missing).

```bash
npm run perf:audit:strict
```

Opt-in CI-style enforcement — fails only when thresholds / allowlists are violated per script rules.

## Scenarios to exercise

### Dashboard (authenticated)

- Cold load home dashboard (coach vs player path if applicable).
- Navigate via sidebar / mobile tab bar / More sheet.
- Open a heavy widget route (stats, documents) once.

### Messaging

- Open messages; switch threads; compose (mobile list/detail if applicable).
- Scroll long image-heavy thread.

### Mobile

- iPhone-sized & Android-sized viewport: tab bar, More sheet, messages pane switching.
- Confirm no duplicate desktop sidebar mount (Phase 7).

### Media-heavy

- Thread with multiple attachments; roster/profile photos grid.
- Confirm lazy loading and non-priority images except true LCP.

### Database

- For SQL changes: run relevant diagnostics from `scripts/` / `PHASE_5_DATABASE_PERFORMANCE_REPORT.md` (readonly queries, `EXPLAIN` where appropriate).

## What to record (before / after)

| Metric | Tool / source |
|--------|----------------|
| Largest client chunk (KB) | `npm run perf:bundle` |
| Approx. shared bundle heuristic | same script output |
| LCP / INP (optional) | Lighthouse CI or Chrome trace |
| DB query time | Supabase logs / `EXPLAIN` |
| “use client” file count / largest files | `node scripts/audit-use-client.mjs` |

Store snapshots in the PR description or in `PERFORMANCE_BASELINE.md` when you formalize baselines.

## CI

`Deploy Guard` runs `npm run build` then `npm run perf:audit` (informational). Strict gates are opt-in via `perf:audit:strict` or per-script env vars — see `PHASE_8_GUARDRAILS_REPORT.md`.
