# Phase 4 — Client bundle & hydration reduction

## Goals addressed

- Homepage is **mostly server-rendered** (`app/(marketing)/page.tsx` is a Server Component).
- Marketing shell/static copy ships **without** a root `"use client"` boundary covering the whole page.
- **Heavy chart library** (`recharts`) is **not eagerly bundled** with AD overview stat cards.
- **Bundle analyzer** is wired for repeatable before/after comparisons (`npm run analyze`).

## Bundle analyzer baseline vs after (Next.js build route table)

Captured with `@next/bundle-analyzer` (`cross-env ANALYZE=true npm run build`). Reports open from `.next/analyze/client.html` after a successful analyze build.

| Metric | Baseline | After Phase 4 |
|--------|----------|----------------|
| Route `/` size | **9.13 kB** | **4.26 kB** |
| `/` First Load JS | **186 kB** | **181 kB** |
| First Load JS shared by all | **82.8 kB** | **82.8 kB** (unchanged) |
| `/dashboard` First Load JS | **189 kB** | **189 kB** (unchanged) |
| `/dashboard/messages` First Load JS | **165 kB** | **165 kB** (unchanged) |

**Interpretation**

- **~4.9 kB** less homepage route JS: marketing layout/copy now compiled as server-first; interactive islands are smaller leaves (hero CTAs, pricing observer, final shatter CTA, footer/header remain client as before).
- **~5 kB** lower homepage first-load total: aligns with smaller route module + deferred **lead form** chunk (`next/dynamic`).
- Shared chunks unchanged: global providers and framework bundles dominate; Phase 4 deliberately avoided risky provider tree splits.

### Heavy libraries (spot-check)

| Library | Where | Notes |
|---------|--------|--------|
| **recharts** | AD coaches pie chart | Now loaded via `next/dynamic` from `ad-overview-cards.tsx` → separate async chunk. |
| **mammoth** | `lib/documents/extract-text.ts` | Already **dynamic `import()`** server-side. |
| **openai** | `lib/braik-ai/openai-client.ts` | Server-only usage. |
| **twilio** | `lib/twilio/sendSms.ts` | Server-only usage. |
| **@stripe/stripe-js** | dependency present | No client imports found in repo grep; payment UI remains scoped when touched. |

jspdf, pdf-lib, html2canvas: **no direct imports** found in TS/TSX scan.

## Files changed

| File | Change |
|------|--------|
| `next.config.js` | Wrap config with `@next/bundle-analyzer` when `ANALYZE=true`. |
| `package.json` | `analyze` script; devDeps: `@next/bundle-analyzer@14.2.18`, `cross-env`. |
| `app/(marketing)/page.tsx` | **Server Component**; exports `metadata`; renders `MarketingHomeView`. |
| `components/marketing/marketing-home-view.tsx` | **Server** marketing page body; composes client islands. |
| `components/marketing/marketing-pricing-view-tracker.tsx` | **Client** — IntersectionObserver + `viewed_pricing` (replaces inline `useEffect` on homepage). |
| `components/marketing/marketing-hero-cta-row.tsx` | **Client** — hero shatter CTA + tracked pricing/demo links. |
| `components/marketing/marketing-final-shatter-cta.tsx` | **Client** — final CTA + analytics. |
| `components/portal/ad/ad-overview-cards.tsx` | `next/dynamic` for `AdCoachesPieChartCard` (recharts async). |

## “Use client” audit (summary)

**Must stay client (representative)**

- `SiteHeader`, `SiteFooter` — pathname, session, forms, modals.
- `ScrollReveal`, `HeroShatterCta`, `LeadCaptureForm`, `MarketingFaqAccordion`, `MobileRootRedirect`.
- Dashboard shell (Phase 3), messaging, Coach B, React Query surfaces.

**Homepage now server-side**

- Static structure, copy, section dividers, most layout wrappers live under **`MarketingHomeView`** without `"use client"`.

## Hydration / HTML expectations

- Crawlers receive **full marketing copy in the server HTML** for `/` (same sections as before).
- **Diagram**: switched from `<img>` to **`next/image`** with explicit dimensions + `sizes` for responsive optimization (alt unchanged).
- Lead capture form **loads in a separate client chunk** after navigation (dynamic); skeleton matches prior intentional deferral.

## Validation

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm run analyze` | Pass (HTML reports under `.next/analyze/`) |

## Known follow-ups (not in Phase 4)

- Further shrink **shared** JS by splitting **`app/providers.tsx`** into route-aware subtrees (riskier; coordinate with auth/marketing).
- Replace repeated **`ScrollReveal`** instances with CSS-only motion-safe reveals where product accepts losing scroll-triggered fade (would reduce many small client trees).
- Audit remaining **`"use client"`** marketing pages (`/features`, `/pricing`, etc.) with the same server-first pattern.

## Phase 5

**Not started** — no database or query-layer changes in this phase.
