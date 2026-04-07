# Braik performance guidelines

Surgical rules for **first render**, **dashboard bootstrap**, and **future regressions**. The team portal is intentionally client-driven around `GET /api/dashboard/shell` and React Query — do not replace that architecture without an explicit project decision.

---

## A. First render

1. **Above-the-fold** content must not depend on avoidable secondary fetches when the same data exists in **shell** or **bootstrap** payloads.
2. **Header, team summary, and dashboard home** should align on **one identity rule**: `useDashboardShellIdentity()` (`lib/hooks/use-dashboard-shell-identity.ts`). If bootstrap/`AppBootstrapProvider` already exposes `user.id`, do not keep the main surface in a skeleton only because `useSession()` is still `"loading"`.
3. **Secondary widgets** (engagement hints, optional panels) must not block core layout or the team banner. Use viewport deferral, lazy chunks, or local skeletons — patterns already used in `dashboard-layout-client.tsx` (`DeferredDashboardEngagementHints`).
4. **Marketing home (`app/(marketing)/page.tsx`)**: only true **LCP** imagery (hero background) uses `priority` on `next/image`. Below-the-fold images stay lazy; heavy sections use `next/dynamic` with minimal placeholders.

---

## B. Fetching

1. **No duplicate client fetches** for fields already on:
   - `GET /api/dashboard/shell` (nav, teams, subscription flags), or  
   - `GET /api/dashboard/bootstrap` / merged deferred payloads (see `dashboard-bootstrap-query`, `AppBootstrapProvider`).
2. **Fallback fetches** (e.g. `GET /api/teams/:id` when bootstrap lacks team summary) must run only when bootstrap is **absent or failed**, not on every mount. `TeamBanner` already encodes this pattern.
3. Prefer **extending bootstrap** or **merging query cache** over adding parallel first-render request chains.

---

## C. Skeletons and Suspense

1. Skeletons should be **granular** (widget or row), not full-screen wrappers, unless the route truly has no shell yet (`DashboardShellLoadingSkeleton` while shell query is pending).
2. **`useSearchParams`** requires a **Suspense** boundary — keep it **close** to the consumer (`DashboardPageShell`, `AdPortalLandingGate`), not unnecessarily duplicated at multiple levels without reason.
3. Do not leave users in a **full page skeleton** for data derivable from an **already-successful** bootstrap query.

---

## D. Client components

1. Do not mark **large** route files as `"use client"` unless hooks or event handlers require it. Prefer server parents + small client islands when the product allows.
2. Avoid **mount-only `useEffect`** that immediately fires redundant fetches when React Query already has fresh data for the same key.
3. **`app/(portal)/dashboard/(team)/page.tsx`**: dashboard home uses a **static** import of `TeamDashboard` so the home surface does not pay an extra dynamic chunk + sequential loading UI on top of shell/bootstrap.

---

## E. Images

1. Prefer **WebP** (or AVIF where supported) for static marketing/portal assets; keep `sizes` accurate for layout.
2. **`priority`** only for **LCP** candidates (e.g. marketing hero). Do not add `priority` to below-fold or sidebar art.
3. Remove stale **PNG/JPEG** references after WebP migration and verification.

---

## F. Dynamic imports (`next/dynamic` / `React.lazy`)

1. Use dynamic import when the chunk is **large** and **not** needed for first paint (e.g. marketing lead form, playbook sub-features).
2. **Do not** dynamically import the **primary** content of the default dashboard landing route if it only adds a second loading phase after the shell — prefer static import for `/dashboard` home (`TeamDashboard`).

---

## G. Checklist for new work

For any **new dashboard widget** or **portal surface**, answer briefly in the PR description:

| Question | Notes |
|----------|--------|
| Does it affect **first render**? | Y/N — which layout segment |
| Does it add a **new fetch**? | Endpoint; can it use bootstrap/shell instead? |
| Does it **extend** an existing payload or create a **new waterfall**? | |
| Does it add a **Suspense** boundary? | Scope of fallback |
| Is there **fallback** logic that duplicates existing loading architecture? | Remove “just in case” duplicates |

---

## Reference files (keep comments in sync when changing flow)

- `components/portal/dashboard-team-shell-gate.tsx` — shell query, first gate
- `components/portal/dashboard-page-shell.tsx` — team resolution + `sessionStillLoading`
- `components/portal/dashboard-team-inner.tsx` — `AppBootstrapProvider` + URL team alignment
- `lib/hooks/use-dashboard-shell-identity.ts` — identity for skeleton alignment
- `lib/dashboard/dashboard-bootstrap-query.ts` — bootstrap + deferred merge
- `app/(portal)/dashboard/(team)/page.tsx` — dashboard home composition
