# Braik performance guidelines

Practical rules that complement Phase 0–8 work. Prefer **measurement** over assumptions; use guardrail scripts before merging large UI changes.

## Core principles

1. **Default to the server** — fetch auth-safe data in Server Components and route handlers; push interactivity to small client islands.
2. **Minimize client JS** — every `"use client"` file pulls React runtime cost into the browser bundle; justify each boundary.
3. **One network truth** — avoid duplicate polling + realtime for the same entity; coordinate TanStack Query `staleTime` with Supabase channels.
4. **Mobile-first cost** — phones pay for blur, shadow, duplicate hidden layouts, and animation; see `PHASE_7_MOBILE_PERFORMANCE_REPORT.md`.
5. **Database is not free** — new filters, joins, and sort orders need indexes and/or RPC review (see `PHASE_5_DATABASE_PERFORMANCE_REPORT.md`).

## Server Components vs `"use client"`

| Use **Server Components** for | Use **`"use client"`** for |
|-------------------------------|----------------------------|
| Page shells, static marketing, data reads that only need cookies/headers on server | `useState`, `useEffect`, browser APIs, Radix/listeners |
| Serializing props to thin client children | Form libraries that require controlled inputs on client |
| SEO-critical HTML without hydration mismatch risk | Complex widgets explicitly scoped (dashboard, playbook canvas) |

**Rules**

- Do not add `"use client"` at the top of `app/**/page.tsx` unless the route truly needs client-only behavior; prefer a client child component.
- Colocate client boundaries: one small wrapper is better than marking an entire feature file `"use client"`.

## Dynamic imports

Use `next/dynamic` / `import()` when:

- The dependency is **heavy** (charts, PDF, rich editors) and not needed for first paint.
- The feature is **below the fold** or behind a tab/modal.
- You would otherwise ship a large library to every route that imports the parent.

Avoid dynamic import indirection for tiny components — it adds chunks and async boundaries without benefit.

## Heavy libraries

- **Charts** (`recharts`, etc.): dynamic import at the chart panel; avoid importing from shared layout files.
- **Documents** (`mammoth`, PDF libs): keep on server or behind upload flows; never bundle for marketing pages.
- **Payments** (`stripe`, `@stripe/stripe-js`): load Stripe.js only on checkout/payment routes.
- **AI / SMS / Twilio / OpenAI**: **server-only** (`app/api/**`, `lib/**`); never import server SDKs into client components.

Run `npm run perf:audit` to see allowlisted vs flagged imports.

## Media & attachments

Align with `PHASE_6_MEDIA_PERFORMANCE_REPORT.md`:

- Use `next/image` with accurate `sizes`; avoid `priority` except true LCP heroes.
- Lazy-load previews and video; no autoplay on mobile by default.
- Prefer signed URLs + lazy fetch over embedding large assets in initial HTML.

## Mobile smoothness

See `PHASE_7_MOBILE_PERFORMANCE_REPORT.md`:

- Do not mount expensive desktop-only trees on phones (conditional render > `hidden` for heavy subtrees).
- Prefer `transform` / `opacity` for motion; respect `prefers-reduced-motion`.
- Scroll containers: `touch-scroll`, `overscroll-contain` where appropriate.

## Database & indexing

- New queries that scan large tables or add filters → review with `PHASE_5_DATABASE_PERFORMANCE_REPORT.md` patterns.
- Prefer RPC/batched reads for inbox-style workloads over N+1 client fetches.
- Do not ship schema changes without migration + index discipline (out of scope for front-end-only PRs but required when touching SQL).

## Realtime subscriptions

- Subscribe **narrowly** (single thread, single team scope), not broad `postgres_changes` fan-out without filters.
- Tear down channels on unmount / route change.
- Do not stack realtime + aggressive polling for the same resource; pick one driver for freshness.

## TanStack Query (React Query)

- Prefer **sensible `staleTime`** on dashboard payloads (e.g. 30s–5m) over refetch-on-every-focus for stable data.
- Use **`placeholderData`** / server prefetch for perceived speed.
- Invalidate narrowly (`queryKey` specificity) after mutations — avoid global cache nukes.

---

## PR checklist (short)

Also tracked in `.github/pull_request_template.md`.

- [ ] New `"use client"` boundary justified?
- [ ] Heavy deps only via dynamic import or server routes?
- [ ] No expensive hidden desktop/mobile duplicates?
- [ ] No always-on animation / polling / broad realtime without ticket context?
- [ ] Images/media lazy except LCP?
- [ ] DB/query changes reviewed + index considered?
- [ ] `npm run typecheck` / `npm run build` for meaningful UI changes?
- [ ] Large UI: `npm run analyze` or `npm run perf:bundle` after build?

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run analyze` | `@next/bundle-analyzer` (requires `ANALYZE=true` via script) |
| `npm run perf:bundle` | Chunk size report vs `performance-budget.config.json` |
| `npm run perf:audit` | use-client scan + heavy imports + bundle budget (needs `.next` for budget) |
| `npm run perf:audit:strict` | Same with strict exit codes (CI opt-in) |
| `npm run prod:checklists` | Print pointers to deploy / observability markdown |
| `npm run prod:audit` | `perf:audit` + checklist pointers (Phase 9) |

See `PERFORMANCE_REGRESSION_CHECKLIST.md`, `PHASE_8_GUARDRAILS_REPORT.md`, and `PHASE_9_DEPLOYMENT_OBSERVABILITY_REPORT.md`.

**Production API tracing:** server-only `BRAIK_API_DEBUG=1` enables `braikApiDebug()` in selected routes (`lib/debug/braik-api-debug.ts`).
