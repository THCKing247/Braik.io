# Next performance priority plan

**Audit date:** 2026-06-02  
**Constraint:** Reports and follow-up PRs only unless explicitly approved. **Do not** simplify protected dashboard staged bootstrap.

---

## Phase 1: Validate Supabase singleton

| | |
|--|--|
| **Goal** | Confirm `getSupabaseServer()` process-level reuse is safe in CI/production and does not regress types or build. |
| **Files involved** | `src/lib/supabaseServer.ts`, all `getSupabaseServer()` consumers (API + lib), `package.json` scripts |
| **Reason** | Recent perf change touches every service-role code path; must pass `typecheck` and production build with real env. |
| **Risk level** | **Low** (behavioral parity); build env misconfiguration is **ops risk**, not code risk |
| **Validation commands** | `npm install` → `npm run typecheck` → `npm run build` with full `.env.local` (Supabase URL, anon key, service role key) |
| **Rollback plan** | Revert singleton in `supabaseServer.ts` to per-call `createClient()`; no DB/migration rollback needed |

**Status (this audit):**

- `typecheck`: **PASS** (after `npm install`).
- `build`: **FAIL** locally without `NEXT_PUBLIC_SUPABASE_URL` — **unrelated** to singleton; compile succeeded.

---

## Phase 2: Identify top 3 slowest / highest-risk pages

| | |
|--|--|
| **Goal** | Measure and document LCP / request count for game video, messages, roster depth, player/parent home. |
| **Files involved** | `components/portal/game-video-library.tsx`, `components/portal/messaging-manager.tsx`, `components/portal/roster-manager-enhanced.tsx`, `components/portal/player-portal/player-portal-home.tsx`, `components/portal/parent-portal/parent-portal-context.tsx`, `components/perf/braik-perf-instrumentation.tsx` |
| **Reason** | Prioritize bootstrap work by measured impact, not guesses (see `audit/page-api-load-map.md`). |
| **Risk level** | **Low** (read-only profiling) |
| **Validation commands** | DevTools Network throttling; optional `__BRAIK_DEBUG_AUTH` / dashboard bootstrap client perf logs; document request waterfalls |
| **Rollback plan** | N/A — no code changes |

**Current top 3 (static audit):**

1. **Game video** — N+1 clip fetches.  
2. **Messages** — parallel API + Supabase RPC + Realtime.  
3. **Parent portal entry** — shell then `portal-context` gate.

---

## Phase 3: Build first bootstrap endpoint

| | |
|--|--|
| **Goal** | Ship **`GET /api/parent-portal/bootstrap`** (or equivalent) merging shell-relevant parent fields + `portal-context` payload. |
| **Files involved** | New `app/api/parent-portal/bootstrap/route.ts`, `components/portal/parent-portal/parent-portal-context.tsx`, `app/api/parent/portal-context/route.ts` (shared builder in `lib/`), React Query key in `lib/queries/keys.ts` |
| **Reason** | Removes the strict UI block until `portal-context` returns; highest clarity waterfall in free portal. |
| **Risk level** | **Medium** — authz for parent link codes |
| **Validation commands** | `npm run typecheck`; manual parent home load (1 bootstrap request vs 2+); `npm run test:release-guards` if messaging permissions touched |
| **Rollback plan** | Feature flag or revert provider to call `portal-context` only; keep old route |

**Alternative first ship:** Game video list aggregation if parent portal is partner-owned — coordinate ownership before coding.

---

## Phase 4: Defer heavy data

| | |
|--|--|
| **Goal** | Ensure non-critical payloads load after first paint (intersection observer, idle callback, or staged endpoints). |
| **Files involved** | `game-video-library.tsx` (clip lazy load), `messaging-manager.tsx` (contacts on compose only), `roster-manager-enhanced.tsx` (readiness tabs), `team-dashboard.tsx` / `notifications-widget.tsx` (seed from deferred-core) |
| **Reason** | Reduces bytes and main-thread work before interactive shell. |
| **Risk level** | **Medium** — UX must show skeletons, not empty errors |
| **Validation commands** | Network: verify clip/detail calls only after user opens video; messages contacts not on cold load |
| **Rollback plan** | Re-enable eager fetches behind query `enabled: true` defaults |

**Protected:** Keep `bootstrap-deferred-heavy` timing (`DEFERRED_HEAVY_AFTER_CORE_MS`) unchanged unless metrics prove otherwise.

---

## Phase 5: Reduce client-side Supabase calls

| | |
|--|--|
| **Goal** | Move `messaging_unread_total` / `message_threads_inbox_stats` / `notifications_feed_v1` RPCs behind server routes used by React Query (session cookie auth), shrinking anon RPC surface. |
| **Files involved** | `lib/messaging/messaging-queries.ts`, `lib/notifications/notifications-api-query.ts`, new thin API routes, `components/portal/messaging-manager.tsx` |
| **Reason** | Fewer parallel client DB round-trips; easier caching on bootstrap/messages bundle. |
| **Risk level** | **Medium** — RPC grants and RLS must match server checks |
| **Validation commands** | `npm run typecheck`; messages inbox unread parity test; no increase in service-role exposure to browser |
| **Rollback plan** | Keep `supabase.rpc` paths behind feature flag |

**Separate (server perf):** Consolidate `getSupabaseAdminClient()` onto shared singleton — not part of Phase 1 validation scope.

---

## Phase 6: Retest page load times

| | |
|--|--|
| **Goal** | Compare before/after request counts and LCP for dashboard home, messages, game video, parent home. |
| **Files involved** | Same as Phase 2; production Netlify/Vercel deploy preview |
| **Reason** | Verify phases 3–5 actually moved metrics. |
| **Risk level** | **Low** |
| **Validation commands** | `npm run build` in CI with secrets; Lighthouse or WebPageTest on preview URL; compare HAR files |
| **Rollback plan** | Revert Phase 3–5 PRs independently; dashboard bootstrap untouched |

---

## Cross-cutting rules

1. **Viewport / mobile:** Player/parent bootstraps must not restructure mobile DOM (see `.cursor/rules/viewport-desktop-mobile-tablet.mdc`).  
2. **Film hub:** Do not change prep/film business logic in game-video perf work — aggregation only.  
3. **Partner work:** Do not modify unrelated partner-owned files without coordination.  
4. **Database:** No RLS/index/migration changes in performance PRs unless explicitly scoped.

---

## Quick reference: audit artifacts

| File | Contents |
|------|----------|
| `audit/supabase-singleton-validation.md` | Typecheck/build results, client inventory, singleton safety |
| `audit/page-api-load-map.md` | Per-area entry points and fetch waterfalls |
| `audit/bootstrap-endpoint-opportunities.md` | Proposed endpoints and ordering |
| `audit/next-performance-priority-plan.md` | This phased plan |
