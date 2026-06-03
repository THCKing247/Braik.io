# Supabase singleton validation

**Audit date:** 2026-06-02  
**Scope:** Validate `src/lib/supabaseServer.ts` module-level service-role client reuse. **No code changes** in this pass.

## Change under review

`getSupabaseServer()` now caches a single `SupabaseClient` in `supabaseServerClient` for the lifetime of the Node process, with:

- `auth.autoRefreshToken: false`
- `auth.persistSession: false`
- One-time optional URL log (`BRAIK_LOG_SUPABASE_URL=0` to disable)

Prior behavior: `createClient()` on every `getSupabaseServer()` call.

---

## 1. Build validation commands

| Command | Environment | Result |
|---------|-------------|--------|
| `npm run typecheck` | Initial: no `node_modules` | **Failed** — `'tsc' is not recognized` |
| `npm run typecheck` | After `npm install` | **Passed** (`tsc --noEmit`, exit 0) |
| `npm run build` | After `npm install`, no `.env` Supabase vars | **Failed** at static generation |

### Typecheck (final)

```
> braik@1.0.5 typecheck
> tsc --noEmit
(exit 0)
```

**Relation to `supabaseServer.ts`:** None. Failure before install was tooling/env only.

### Build (final)

- **Compile:** succeeded (`✓ Compiled successfully`, type check during build OK).
- **Failure phase:** `Generating static pages` — prerender errors.
- **Primary errors:**
  - `Error: Braik Supabase: missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env / Netlify and rebuild the app.`
  - Affected routes include `/login`, `/admin/*`, pages that import client Supabase at module scope, and API routes probed during SSG.
  - Font download warnings (`fonts.gstatic.com` socket hang up) — environmental, non-blocking for compile.
  - `Dynamic server usage` logs for several API routes during static collection — expected for dynamic handlers, not compile failures.

**Relation to `supabaseServer.ts`:** **Unrelated.** Failures come from `requireNextPublicSupabaseUrl()` / `requireSupabaseProjectUrl()` at **build-time prerender**, not from singleton logic. Service-role key is not required for those particular client-bundle errors.

**To get a green local build:** Provide `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` per project docs, then re-run `npm run build`.

---

## 2. Supabase client inventory

### Approved server helpers

| Module | Pattern | Role |
|--------|---------|------|
| `src/lib/supabaseServer.ts` | **Module singleton** via `getSupabaseServer()` | Service role, RLS bypass — **primary server path** (~250+ call sites) |
| `src/lib/supabaseAdmin.ts` | Module-level `supabaseAdmin` / `requireSupabaseAdmin()` | Service role (scripts, dev seed) |
| `lib/supabase/supabase-admin.ts` | `getSupabaseAdminClient()` — **new client per call** | Auth admin, signup, invites, realtime broadcast |

### Approved browser helper

| Module | Pattern | Role |
|--------|---------|------|
| `src/lib/supabaseClient.ts` | Module singleton `supabaseClient` | Anon key, persisted session |
| `lib/supabaseClient.ts` | Re-export `supabase` alias | Same singleton |

### Direct `createClient()` outside helpers

Only in the three files above (plus duplicate path `src\lib\supabaseServer.ts` on Windows). **No stray `createClient` in random components.**

---

## 3. Server-side usage (`getSupabaseServer`)

**Import path:** `@/src/lib/supabaseServer` (canonical).

**Categories:**

- **API routes** (`app/api/**`): vast majority of data mutations/reads.
- **Server libs** (`lib/**`): bootstrap builders, RBAC, messaging utils, roster loaders, billing, AI executors, etc.
- **RSC pages (limited):** admin overview, athletic departments, invite pages, recruiting slug page — server components calling `getSupabaseServer()` at render time.

**Not using singleton (separate code paths):**

- `getSupabaseAdminClient()` — ~20 call sites (auth provisioning, player join, waitlist, `broadcast-thread-message`, etc.).
- `requireSupabaseAdmin()` from `src/lib/supabaseAdmin.ts` — dev seed route.

---

## 4. Browser / client usage

| File | Usage |
|------|--------|
| `lib/auth/client-auth.ts` | `supabaseClient` — `setSession`, `signOut`, `getSession`, `onAuthStateChange` |
| `lib/messaging/messaging-queries.ts` | `supabase.rpc('messaging_unread_total_for_team_user')`, `message_threads_inbox_stats` |
| `components/portal/messaging-manager.tsx` | Realtime channels via `supabase` |
| `app/(auth)/login/page.tsx`, `signup/player`, `join/page.tsx` | Auth flows |
| `lib/notifications/notifications-api-query.ts` | `notifications_feed_v1` RPC (imported by server/query paths — verify call site is client-only when used from UI) |

**Type-only imports:** 80+ `lib/**` files import `SupabaseClient` type only (no runtime client).

---

## 5. Risky service-role patterns

| Risk | Severity | Notes |
|------|----------|-------|
| Singleton shares one client per process | **Low** | Intended; `supabase-js` clients are designed to be reused. No per-request Authorization header mutation observed in helpers. |
| Service role on API routes without session checks | **Pre-existing** | RLS bypass requires route-level auth (session/RBAC). Singleton does not change enforcement. |
| **`getSupabaseAdminClient()` creates a new client every call** | **Medium (perf)** | Separate from this change; multiplies connection setup in auth/signup hot paths. |
| Client RPC for messaging unread/stats | **Low–medium** | Uses **anon** client + DB RPC; must rely on RLS/grants. Not service role. |
| `supabaseAdmin` module export | **Low** | Second service-role singleton; only used where env is complete. |

---

## 6. Singleton safety assessment

**Verdict: Safe to keep**, assuming production already ran with service-role env configured.

**Why:**

1. **Immutable config** — URL and service key read once at first `getSupabaseServer()`; client options disable session persistence.
2. **Node concurrency model** — One event loop per process; no cross-thread sharing issues unlike multi-threaded runtimes.
3. **Call-site contract unchanged** — Still returns `SupabaseClient`; all existing `const supabase = getSupabaseServer()` patterns remain valid.
4. **Performance intent aligned** — Reduces repeated client construction on high-QPS API routes (bootstrap, roster, messages).

**Caveats (operational, not blockers):**

- **Serverless / edge:** In platforms that freeze or recycle isolates, “per process” ≈ per instance — still correct. Cold starts create one client per new instance.
- **Dev HMR:** Changing Supabase URL in `.env` without restart may keep old client until process restart (standard Node dev behavior).
- **Do not store per-user state on the returned client** — no evidence of that pattern today.

**Not introduced by singleton but worth tracking:** duplicate service-role factories (`getSupabaseServer` vs `getSupabaseAdminClient` vs `supabaseAdmin`).

---

## 7. Recommended follow-ups (report only)

1. Document that CI/production builds must export Supabase env before `next build`.
2. Long-term: consolidate `getSupabaseAdminClient()` onto `getSupabaseServer()` or a shared singleton factory (separate PR; out of scope for this validation).
3. Re-run `npm run build` with full `.env.local` in CI to confirm prerender green — validates unrelated env gate, not singleton logic.
