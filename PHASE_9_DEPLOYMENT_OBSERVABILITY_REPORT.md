# Phase 9 — Deployment & observability report

**Scope:** Production deployment/runtime behavior for Braik on **Netlify + Next.js + Supabase**. No product feature changes; no schema changes; no secrets documented below.

## Deployment settings reviewed (repo + CI)

| Setting | Source | Current / notes |
|--------|--------|------------------|
| Build command | `netlify.toml` | `npm run build` |
| Publish directory | `netlify.toml` | `.next` (required for `@netlify/plugin-nextjs`) |
| Plugin | `netlify.toml` | `@netlify/plugin-nextjs` |
| Node version | `netlify.toml` `[build.environment]` | **22** (updated to align with `.github/workflows/deploy-guard.yml`) |
| Prebuild | `package.json` | `tsx scripts/verify-env.ts && npm run typecheck` before `next build` |
| Env verification | `scripts/verify-env.ts` | Requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` on **CI / Netlify / production** builds; warns if `AUTH_SECRET` missing |

**Not available from repo alone (manual Netlify dashboard):** linked site name, production branch, branch deploy previews, per-context env scopes, function region, asset optimization toggles, custom redirects beyond Next. Record those in this doc when audited in the UI.

## Build / runtime settings reviewed

| Area | Notes |
|------|--------|
| Next.js | `next.config.js` — eslint ignored during builds (existing); images allow `**.supabase.co` public storage paths; bundle analyzer when `ANALYZE=true` only |
| Middleware | `middleware.ts` — Edge-safe cookie gate for `/dashboard` and `/admin`; no JWT verification on Edge (documented pattern for Netlify) |
| API routes | Several routes set `dynamic = "force-dynamic"`, `runtime = "nodejs"`, `fetchCache = "force-no-store"` where critical (e.g. `app/api/events/route.ts`) |

## Environment variables reviewed (names only)

| Name | Intended scope | Safety notes |
|------|----------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Public project URL only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Public anon key; RLS enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Never `NEXT_PUBLIC_*`; admin/server routes |
| `AUTH_SECRET` | Server | Session signing; `verify-env` warns if unset in CI builds |
| `OPENAI_API_KEY`, Stripe, Twilio, etc. | Server API routes | Must not be exposed to browser |
| `NEXT_PUBLIC_BRAIK_*` perf flags | Client | Feature/debug toggles; keep **off** in prod unless diagnosing |
| `ANALYZE` | Build-time only | Set via `npm run analyze`; not for normal Netlify production builds |
| `BRAIK_API_DEBUG` | **Server** | **New (Phase 9):** set to `1` only when troubleshooting API verbosity (`lib/debug/braik-api-debug.ts`) |
| `BRAIK_AI_DEBUG` | Server | Existing Coach B prompt debugging (`app/api/ai/chat/route.ts`) |

**Rule:** Only keys that are safe to expose belong in `NEXT_PUBLIC_*`.

## Caching headers reviewed / changes

| Change | Details |
|--------|---------|
| API responses | `next.config.js` adds `Cache-Control: private, no-store, must-revalidate` for **`/api/:path*`** so authenticated / user-specific JSON is not cached by shared caches. |
| Static assets | Hashed `_next/static` files remain governed by Next / CDN defaults (long-lived immutable assets). **No** broad `public, max-age` added for HTML. |
| Middleware | No cache headers added to dashboard HTML here (session-sensitive). |

**Rollback:** Remove the `headers()` export from `next.config.js` if a conflict appears with Netlify edge behavior (unlikely).

## API / runtime latency — audits & safe fixes

### Implemented in Phase 9

1. **`POST /api/events`** — Verbose `console.log` traces gated behind **`BRAIK_API_DEBUG=1`** (`braikApiDebug`). Insert failures use **`console.error`**; non-fatal side-effect failures use **`console.warn`**.
2. **`POST /api/messages/send`** — Verbose traces gated; **removed unconditional extra DB query** listing all thread participants unless **`BRAIK_API_DEBUG=1`** (saves latency + reduces data exposure on denied paths).
3. **`POST /api/ai/chat`** — Non-error traces gated via **`braikApiDebug`** (Coach B already had **`BRAIK_AI_DEBUG`** for prompt/debug).

### Hot routes to monitor (documentation only — no shape changes)

| Pattern | Risk |
|---------|------|
| Dashboard bootstrap, roster, messages, notifications | Large JSON or many sequential awaits |
| Playbook / canvas routes | Heavy client bundles; API should stay slim |
| Stripe/Twilio/OpenAI routes | Ensure SDK usage stays server-side |

Further narrowing payloads / pagination remains future work when callers can change.

## Supabase / Netlify logs — review status

| System | Status |
|--------|--------|
| Supabase advisors / logs | **Not queried live from this repo session** — requires dashboard access. Follow **`PRODUCTION_OBSERVABILITY_CHECKLIST.md`**. |
| Netlify deploy history | **Not queried live** — verify latest deploy and duration in UI after release. |

**Do not** mutate production DB from Phase 9 tasks.

## Production logging changes summary

- **Default production:** fewer unconditional **`console.log`** lines on high-traffic routes.
- **Troubleshooting:** set **`BRAIK_API_DEBUG=1`** on Netlify (server env) temporarily; unset after incident.
- **Errors:** **`console.error`** retained for real failures.

## Changes made (files)

| File | Change |
|------|--------|
| `netlify.toml` | `NODE_VERSION` **20 → 22** |
| `next.config.js` | `headers()` for `/api/:path*` Cache-Control |
| `lib/debug/braik-api-debug.ts` | **New** — gated debug helper |
| `app/api/events/route.ts` | Gated traces + leveled errors |
| `app/api/messages/send/route.ts` | Gated traces; conditional participant list query |
| `app/api/ai/chat/route.ts` | Gated trace logs |
| `package.json` | **`prod:checklists`**, **`prod:audit`** |
| `scripts/print-production-checklists.mjs` | **New** |
| `PRODUCTION_OBSERVABILITY_CHECKLIST.md` | **New** |
| `DEPLOY_SMOKE_TEST_CHECKLIST.md` | **New** |

## Risks

| Risk | Mitigation |
|------|------------|
| Node 22 on Netlify | Matches CI; if a native addon breaks, revert `NODE_VERSION` to **20** in `netlify.toml` |
| API Cache-Control | If any route relied on CDN caching GET APIs (unlikely), behavior becomes explicitly non-cache — desired for private data |
| `BRAIK_API_DEBUG` | Can increase log volume and PII-adjacent metadata — use short-lived |

## Rollback notes

1. **Git revert** commits touching `next.config.js`, `netlify.toml`, API routes, or new debug helper.
2. **Netlify** — publish previous deploy.
3. **Env** — remove `BRAIK_API_DEBUG` when done debugging.

## Observability artifacts

- **`PRODUCTION_OBSERVABILITY_CHECKLIST.md`** — post-deploy monitoring.
- **`DEPLOY_SMOKE_TEST_CHECKLIST.md`** — manual smoke flows.
- **Phase 8** — `npm run perf:audit`, `PERFORMANCE_REGRESSION_CHECKLIST.md`.

## Validation results

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm run perf:audit` | Pass (Phase 8 bundle + audits; OK within thresholds) |

*(Attach CI links / deploy IDs in your PR as needed.)*

## Follow-up production risks

- Align **documented** Netlify dashboard settings (branch, env scopes, function region) with this repo when available.
- Periodically run **Supabase Performance advisor** after query changes.
- Consider reducing **`console.log`** in remaining API routes incrementally using **`braikApiDebug`**.
