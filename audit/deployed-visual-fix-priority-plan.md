# Deployed Visual Fix Priority Plan — braik.io

**Audit date:** 2026-06-07  
**Source:** Production screenshots at https://braik.io  
**Evidence:** `audit/deployed-screenshots/`, `audit/deployed-screenshots/manifest.json`

---

## Critical — hurts usability or trust

| # | Page | Screenshot | Problem | Recommended fix | Risk | Files likely involved |
|---|------|------------|---------|-----------------|------|------------------------|
| DC1 | `/enter-player-code` | `desktop/enter-player-code.png` | Redirects to `/login?callbackUrl=%2Fparent%2Fjoin` instead of player code flow | Fix route guard/middleware callback to player join or render public code page | **High** (routing) | `middleware.ts`, `app/(auth)/enter-player-code/page.tsx`, auth redirect helpers |
| DC2 | `/` mobile & tablet | `mobile/landing.png`, `tablet/landing.png` | Homepage shows login only — no product story for mobile/tablet visitors | Product decision: show condensed marketing hero OR prominent “Learn about Braik” link | **Medium** (IA) | `app/(marketing)/page.tsx`, `MobileRootRedirect`, `mobile-app-login-screen.tsx` |
| DC3 | Site-wide | All screenshots | Persistent “Site currently under development — Braik v1.0.6 coming soon” banner | Remove or gate to staging/preview only | **Low** (config) | `SuspensionBanner` or global layout banner component |
| DC4 | `/pricing` | `desktop/pricing.png` vs `mobile/pricing.png` | Possible **price mismatch** ($250 desktop vs $299 mobile base) | Verify single pricing source; fix responsive render bug if unintentional | **High** (trust) | `app/(marketing)/pricing/page.tsx`, pricing content components |

---

## High — obvious visual or brand problem

| # | Page | Screenshot | Problem | Recommended fix | Risk | Files likely involved |
|---|------|------------|---------|-----------------|------|------------------------|
| DH1 | `/parent/join` | `desktop/parent-join.png` | Public parent join redirects to login — parents from “Parent Access” CTAs cannot start without account | Expose public parent code/link form or clarify login-first flow in marketing copy | **Medium** | `app/parent/join/page.tsx`, `middleware.ts`, marketing CTAs |
| DH2 | `/login` | `desktop/login.png`, `mobile/login.png` | LOGIN button less prominent than Join/Parent inside card | Style LOGIN as filled primary; move secondary paths below | **Low** | `hero-login-form.tsx`, `button.tsx` |
| DH3 | Footer site-wide | `privacy.png`, `request-access.png`, `features.png` | Copyright years conflict: **© 2023, 2024, 2026** across pages | Single dynamic copyright year | **None** | `site-footer.tsx` |
| DH4 | Header CTAs | `pricing.png` vs `landing.png` | Inconsistent labels: Join Your Team / Join Waitlist / Get Started | Standardize CTA copy per funnel stage | **Low** | `site-header.tsx`, `join-cta.ts`, page-specific headers |
| DH5 | `/join` | `desktop/join.png` | Invalid-invite state looks sparse; gray “Redeem code” appears disabled | Add logo, supportive copy, primary button styling | **Low** | `app/join/page.tsx` |
| DH6 | `/request-access` | `desktop/request-access.png` | Coach column much taller than player — unbalanced desktop layout | Split demo form to second step or collapsible section | **Low** | `app/(marketing)/request-access/page.tsx` |
| DH7 | Marketing copy | `mobile/features.png` | Banner text varies (“alpha development” vs “v1.0.6 coming soon”) | Unify status messaging | **None** | Global banner component |

---

## Medium — polish issue

| # | Page | Screenshot | Problem | Recommended fix | Risk | Files likely involved |
|---|------|------------|---------|-----------------|------|------------------------|
| DM1 | `/` desktop | `desktop/landing.png` | Four competing hero CTAs | Limit to 2 primary + “More ways to join” link | **Low** | `home-hero-cta-row.tsx` |
| DM2 | `/login` mobile | `mobile/login.png` | “Forgot password?” left-aligned breaks symmetry | Center under card | **None** | `hero-login-form.tsx` |
| DM3 | `/pricing` mobile | `mobile/pricing.png` | Very long scroll before CTA | Sticky bottom CTA or section jump links | **Low** | pricing page mobile styles |
| DM4 | `/privacy` | `desktop/privacy.png` | Effective date 2025 vs footer 2023 | Align legal dates | **None** | privacy page, footer |
| DM5 | `/features` | `mobile/features.png` | Possible typo “IL/JH” in hero bullets | Correct to “HS/JH” or intended abbreviation | **None** | features marketing copy |
| DM6 | `/signup` | redirects to request-access | `/signup` and `/signup/role` redirect — bookmarks may confuse | Add redirect notice or keep alias documented | **None** | signup route redirects |
| DM7 | Login vs marketing | desktop vs mobile login | Two visual identities (white marketing vs dark app) | Align button colors/logo treatment | **Low** | login page, mobile-app-login-screen |

---

## Low — nice-to-have

| # | Page | Screenshot | Problem | Recommended fix | Risk | Files likely involved |
|---|------|------------|---------|-----------------|------|------------------------|
| DL1 | `/` desktop | `desktop/landing.png` | Role matrix section dense | Add icons or collapse on mobile/desktop | **Low** | marketing home sections |
| DL2 | `/pricing` | `desktop/pricing.png` | “Football programs” headline vs multi-sport site copy | Harmonize positioning | **None** | pricing hero copy |
| DL3 | `/join` mobile | `mobile/join.png` | Large empty whitespace | Reduce min-height or add illustration | **None** | join page layout |
| DL4 | Marketing header | all desktop pages | Logo very tall (4.5rem) | Slightly reduce on md breakpoints | **None** | `site-header.tsx` |

---

## Auth-blocked — expected, no fix needed

| Route | Behavior | Screenshot |
|-------|----------|------------|
| `/dashboard` | → login + callback | `dashboard-protected.png` |
| `/player/demo` | → login + callback | `player-protected.png` |
| `/onboarding` | → login + callback | `onboarding.png` |

---

## Still needs safe test account

Cannot confirm from public audit:

| Area | What to verify |
|------|----------------|
| Coach dashboard | Sidebar orange vs mobile tab blue, command-center density, skeletons |
| Roster / schedule / messages | Scroll containers, empty states, mobile tab bar |
| Player portal | Navy/orange shell, Film hub nav label, feed mock content |
| Parent portal | Player vs Profile tab confusion, payments surface |
| Game video | N+1 loading perception |
| In-app messaging | Three-column mobile collapse, contrast |

Use **dedicated staging test accounts** — not production personal credentials.

---

## Suggested execution order

1. **DC1** — Fix `/enter-player-code` redirect (player onboarding broken path).
2. **DC4** — Verify pricing consistency across viewports.
3. **DC3** — Remove production dev banner when ready to launch.
4. **DC2 / DH1** — Mobile `/` strategy + parent join public access.
5. **DH2, DH3, DH4** — Login hierarchy, copyright, CTA labels.
6. **DM*** polish items.
7. Staging authenticated audit for portal interiors.

---

## Re-audit

```bash
node audit/capture-deployed-screenshots.js
```

Compare against `audit/deployed-screenshots/manifest.json` for redirect regressions.
