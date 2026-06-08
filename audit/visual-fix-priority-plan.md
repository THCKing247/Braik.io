# Braik.io Visual Fix Priority Plan

**Audit date:** 2026-06-07  
**Source audits:** `visual-ux-audit.md`, `mobile-ux-audit.md`, `portal-experience-audit.md`  
**Note:** Live screenshots blocked by missing env — references point to error-state captures until re-run.

---

## Critical — hurts usability or trust

| # | Page / area | Screenshot | Problem | Recommended fix | Risk | Files likely involved |
|---|-------------|------------|---------|-----------------|------|------------------------|
| C1 | **All routes** | `audit/screenshots/desktop/landing.png`, `mobile/landing.png` | App throws runtime error when `NEXT_PUBLIC_SUPABASE_URL` (and related keys) missing — no graceful dev fallback | Add `.env.local` with Supabase trio; consider dev-only friendly error page instead of crash overlay | **High** (blocks all QA) | `src/lib/supabase-project-env.ts`, `src/lib/supabaseClient.ts`, `.env.example` |
| C2 | **Player home**, **Parent home** | — (needs auth) | Mock/sample feed posts always render alongside live data — users may trust fabricated game results, travel packets, film notes as real | Remove static demo posts; show branded empty state with “No updates yet” and optional coach prompt | **High** (trust) | `components/portal/player-portal/player-portal-home.tsx`, `components/portal/parent-portal/parent-portal-home.tsx`, feed list components |
| C3 | **Parent portal nav** | — | Tabs labeled **“Player”** (athlete profile/docs) and **“Profile”** (reminders) — easy mis-tap, breaks wayfinding | Rename to distinct labels (e.g. “Athlete”, “Reminders” or “My account”) | **Medium** (logic change) | `components/portal/parent-portal/parent-portal-chrome.tsx` |
| C4 | **Global lists** (roster, messages, documents, settings) | — | Scrollbars hidden globally (`* { scrollbar-width: none }`) — users may not discover scrollable content | Opt-in thin scrollbars or scroll-fade cues on overflow containers | **Low** (CSS only) | `app/globals.css`, `components/ui/scroll-fade-container.tsx`, `ScrollableListContainer` usages |
| C5 | **Parent portal** | — | No payments/dues surface — parents expect fee status; absence feels incomplete or hidden | Add payments summary card/tab linking to collections or Stripe portal if in scope | **Medium** (product scope) | New parent component + collections/billing APIs |

---

## High — obvious visual or brand problem

| # | Page / area | Screenshot | Problem | Recommended fix | Risk | Files likely involved |
|---|-------------|------------|---------|-----------------|------|------------------------|
| H1 | **Coach sidebar** vs **Coach mobile tabs** | — | Desktop sidebar active = **orange**; mobile bottom tab active = **blue** — same app, different accent logic | Pick one primary nav accent (recommend orange to match brand tokens) and apply to both | **Low** | `components/portal/dashboard-sidebar.tsx`, `components/portal/dashboard-mobile-tab-bar.tsx` |
| H2 | **Coach dashboard banner** | — | Custom navy gradient `#17385F` → `#0F315C` doesn’t match `braikBrand.navy` (`#081838`) | Replace with tokenized navy scale from `portal-brand-tokens.ts` | **Low** | `components/portal/team-dashboard.tsx` (banner section) |
| H3 | **Marketing** vs **portals** | — | Three navy families: marketing `#0a1628`, coach banner `#17385F`, portals `#081838` | Document canonical navy scale; refactor hardcoded hex to tokens | **Low** | `components/portal/portal-brand-tokens.ts`, `components/marketing/home/home-theme.ts`, team banner |
| H4 | **Mobile `/`** | `audit/screenshots/mobile/landing.png` | Marketing home hidden on mobile — phones land on login, not product story | Product decision: add mobile marketing summary OR accept app-first with link to `/features` | **Medium** (IA) | `app/(marketing)/page.tsx`, `MobileRootRedirect`, `components/auth/mobile-app-login-screen.tsx` |
| H5 | **Login desktop** vs **Login mobile** | `desktop/login.png`, `mobile/login.png` | Two distinct visual products (white marketing vs dark app shell) — brand discontinuity at first auth touchpoint | Align key elements (logo treatment, primary button color) while keeping layout differences | **Low** | `app/(auth)/login/page.tsx`, `components/auth/mobile-app-login-screen.tsx`, `components/marketing/hero-login-form.tsx` |
| H6 | **Player bottom nav** | — | Tab labeled **“Team”** routes to Film hub (Study/Film/Playbooks) — label mismatch | Rename tab to “Film” or “Prep” per `player-prep-hub-only` rule | **Low** | `components/portal/player-portal/player-portal-chrome.tsx` |
| H7 | **Onboarding** | `audit/screenshots/desktop/onboarding.png` | Plain shadcn form — feels disconnected from signup marketing polish | Add lightweight brand header/progress stepper matching signup role cards | **Low** | `components/portal/onboarding-wizard.tsx`, `components/portal/onboarding-page-client.tsx` |
| H8 | **Marketing header** | — | Logo `h-[4.5rem]` dominates sticky header — reduces nav space on tablet | Reduce to ~3rem on `md`, keep larger on `lg` hero contexts only | **Low** | `components/marketing/site-header.tsx` |

---

## Medium — polish issue

| # | Page / area | Screenshot | Problem | Recommended fix | Risk | Files likely involved |
|---|-------------|------------|---------|-----------------|------|------------------------|
| M1 | **Coach empty states** (roster, documents, messages, game-video) | — | Text-only “No X yet” — no illustration, no primary action | Extract shared `PortalEmptyState` (icon, title, description, CTA) modeled on `AdEmptyState` | **Low** | `components/portal/ad/ad-empty-state.tsx` (pattern), roster/documents/messages managers |
| M2 | **Coach messages** | `audit/screenshots/desktop/messages.png` | Dense three-column UI; complex scroll ownership — fragile on short viewports | Audit mobile/stack breakpoints; add scroll region labels for a11y | **Medium** | `components/portal/messaging-manager.tsx`, `dashboard-layout-client.tsx` |
| M3 | **Parent desktop (`lg+`)** | — | Mobile dark navy → desktop light header/nav shift may jar on resize | Smooth transition: keep navy header with light content, or document as intentional | **Low** | `components/portal/parent-portal/parent-portal-chrome.tsx` |
| M4 | **Player study/playbooks** | — | Embedded panels `#0a1220` vs shell `#081838` — tone mismatch | Use `braikPlayerTheme.surface` tokens consistently | **Low** | `components/portal/player-portal/player-portal-study-guides.tsx`, `player-portal-playbooks.tsx` |
| M5 | **Coach message badges** | — | Amber badges vs brand orange | Use `braikBrand.orange` or semantic token | **Low** | `components/portal/messaging-manager.tsx`, `dashboard-mobile-tab-bar.tsx` |
| M6 | **Coach B sidebar panel** | — | Blue CTA on orange-accent panel | Use orange primary or neutral outline consistent with panel | **Low** | `components/portal/dashboard-sidebar.tsx`, Coach B components |
| M7 | **Schedule mobile** | — | Special bottom padding calc for tab bar — brittle | Centralize tab-bar offset CSS variable | **Low** | Schedule page, `dashboard-mobile-tab-bar.tsx`, layout client |
| M8 | **Signup flow** | — | Each signup step composes marketing header independently — spacing drift possible | Shared `(auth)/signup/layout.tsx` wrapper | **Low** | `app/(auth)/signup/**/page.tsx` |
| M9 | **Marketing demo CTA** | — | Orange only on “Request demo” — underuses brand orange vs blue CTAs | Optional: secondary orange accent on one more conversion point | **Low** | `components/marketing/home/home-theme.ts`, `home-hero-cta-row.tsx` |

---

## Low — nice-to-have

| # | Page / area | Screenshot | Problem | Recommended fix | Risk | Files likely involved |
|---|-------------|------------|---------|-----------------|------|------------------------|
| L1 | **All portals** | — | `duration-[200ms]` Tailwind ambiguity warning in dev console | Escape class per Tailwind suggestion | **None** | Various components using ambiguous duration |
| L2 | **All pages** | — | Next.js viewport metadata deprecation warnings | Move viewport to `generateViewport` export | **None** | Marketing/auth layout `metadata` exports |
| L3 | **Marketing** | — | Browserslist data 6 months old | Run `npx update-browserslist-db@latest` | **None** | Dev dependency maintenance |
| L4 | **Coach tablet** | — | 480px `MobilePortalShell` leaves side gutters on tablet | Optional `md:max-w-xl` content expansion behind review | **Medium** (viewport rule) | `components/mobile/mobile-portal-shell.tsx` |
| L5 | **Player portal desktop** | — | Bottom nav on wide screens — no `lg` desktop variant | Accept per mobile-app-like rules OR add desktop-only extras with `lg:` | **Medium** (viewport rule) | `player-portal-chrome.tsx` |
| L6 | **Loading branding** | — | Generic pulse skeletons — no Braik logo micro-animation | Branded loader variant for shell-level waits | **Low** | `components/ui/app-loader.tsx`, `dashboard-shell-loading-skeleton.tsx` |
| L7 | **Auth remember-me** | — | localStorage for remember-me — no visual indicator on return visit | Pre-check remember-me if stored | **Low** | `components/marketing/hero-login-form.tsx` |

---

## Performance perception fixes (cross-cutting)

These affect “feels fast” more than pixels but belong in a visual/UX pass:

| Priority | Page | Problem | Recommended fix | Risk | Files likely involved |
|----------|------|---------|-----------------|------|------------------------|
| Critical | **Game video** | N+1 clip fetches — long blank/library pop-in | Batch clips endpoint or lazy-load clips on expand | **Medium** | `components/portal/game-video-library.tsx`, game-video API routes |
| High | **Messages** | Parallel bootstrap + RPC + contacts + Realtime | Ensure single unread source; defer contacts until pane open | **Medium** | `messaging-manager.tsx`, bootstrap merge, `lib/enforcement/messaging-permissions.ts` |
| High | **Parent entry** | portal-context hard gate before paint | Merge portal-context into shell or stream skeleton earlier | **Medium** | `parent-portal-context.tsx`, `/api/parent/portal-context` |
| High | **Player home** | shell + roster/me + bootstrap + highlights | Parallelize where safe; skeleton feed cards | **Medium** | `player-portal-home.tsx`, shell/roster APIs |
| Medium | **Settings** | Independent bundle — always waits on navigation | Prefetch settings bundle on More hover / idle | **Low** | `settings-page-client.tsx`, `/api/me/settings-page-bundle` |
| Medium | **Documents** | useEffect fetch, no React Query cache | Migrate to RQ with staleTime | **Low** | `documents-manager.tsx`, `/api/documents` |

---

## Suggested execution order

1. **Unblock environment** (C1) — required before any visual verification.
2. **Trust fixes** (C2, C3, C5) — parent/player wayfinding and honest content.
3. **Brand unification** (H1–H3, H6) — nav accents, navy tokens, player tab label.
4. **Scroll affordance** (C4) — quick global CSS win.
5. **Empty states** (M1) — coach polish.
6. **Performance** (game video, messages, parent gate) — complements visual “fast” goal.
7. **Nice-to-haves** (L*) — as capacity allows.

---

## Re-verification checklist

After fixes, re-run:

```bash
# 1. Configure .env.local with Supabase keys
npm run dev

# 2. Capture screenshots
node audit/capture-screenshots.js

# 3. Manual passes
# - Coach: login → dashboard → roster → schedule → messages → settings → documents → game-video
# - Player: enter-player-code → home → Film hub (study/film/playbooks) → messages
# - Parent: parent/join → feed → calendar → messages → athlete profile
# - Desktop (1440px) + mobile (390px) for each
```

Update screenshot references in this document and sibling audits when live captures exist.
