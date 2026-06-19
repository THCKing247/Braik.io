# Deployed Mobile UX Audit — braik.io

**Audit date:** 2026-06-07  
**URL:** https://braik.io  
**Viewports:** Mobile 390×844, Tablet 768×1024  
**Screenshots:** `audit/deployed-screenshots/mobile/`, `audit/deployed-screenshots/tablet/`

---

## Executive summary

On production, **phones and tablets do not see the marketing homepage at `/`** — they land on the **dark Team Workspace login shell**. Marketing content remains reachable via `/features`, `/pricing`, etc. with hamburger nav. Mobile login is **app-like and readable**; pricing and request-access **stack well**. Key issues: **no product story at `/` on mobile**, **parent/player join paths blocked or misrouted**, and **long pricing page scroll fatigue**.

---

## `/` at mobile (390×844)

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/mobile/landing.png` |
| **What renders** | **Login screen**, not marketing home |
| **First impression** | Dark navy app shell — professional, native-feeling; “Team Workspace” label clarifies purpose. |
| **Brand** | White Braik logo on dark; orange not prominent on login (blue accents on inputs/buttons). |
| **Header** | Dev banner only — no marketing nav on this view. |
| **Tap targets** | Sign in, Join your team, Parent access buttons appear ≥44px — good. |
| **Form** | White card; email focused state (blue ring); “Keep me signed in” checked by default. |
| **Footer links** | Privacy · Terms · Help & FAQ — small but tappable; Staff admin sign-in pill. |
| **Scroll** | Single viewport — no scroll issues. |
| **Loading** | Instant. |
| **UX problems** | New visitors typing braik.io on phone **never see product value prop**; must discover Features/Pricing via footer or direct URL. |
| **Recommended fix** | Add lightweight marketing teaser above login OR link “What is Braik?” prominently. |
| **Risk** | **High** (mobile acquisition) |

---

## `/` at tablet (768×1024)

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/tablet/landing.png` |
| **What renders** | **Same login shell as mobile** — marketing home still hidden at 768px. |
| **Implication** | iPad portrait users also miss homepage hero. |
| **Risk** | **High** — tablet treated as mobile for `/`. |

---

## `/login` mobile

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/mobile/login.png` |
| **First impression** | Identical dark app shell to `/` on mobile — consistent. |
| **Brand** | Strong “Welcome back” athletic type; high contrast. |
| **Button hierarchy** | White SIGN IN with shadow vs blue-outline join/parent — primary is visible but join/parent compete. |
| **Spacing** | Card uses ~90% width; comfortable margins. |
| **Scroll** | Fits one screen; no body scroll problems. |
| **UX problems** | “Forgot password?” left-aligned under card breaks center symmetry; dev banner consumes vertical space. |
| **Risk** | Low–medium |

---

## Marketing pages on mobile

### `/features`

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/mobile/features.png` |
| **First impression** | Clear feature cards in single column — scannable. |
| **Header** | Logo + Sign in + hamburger — standard mobile marketing chrome. |
| **Banner** | Shows “alpha development” variant on some pages — **inconsistent with v1.0.6 banner** elsewhere. |
| **Cards** | Consistent icon + title + description; good thumb-friendly padding. |
| **Scroll** | Long page; body scroll smooth. |
| **CTA** | Blue “Join your team” + outlined “Book a demo” at bottom — clear. |
| **Risk** | Low |

### `/pricing` mobile

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/mobile/pricing.png` |
| **First impression** | Dense but readable — stacked pricing cards. |
| **Layout** | Single column; “Most Popular” badge on Pro Video visible. |
| **Scroll** | **Very long** — scroll fatigue risk before final CTA. |
| **Header** | Logo + Login + menu — compact. |
| **UX problems** | Base platform shows **$299** on mobile capture vs **$250** on desktop — **pricing display inconsistency** to verify; footer © 2024 vs 2026 elsewhere. |
| **Risk** | Medium (trust if prices differ) |

### `/pricing` tablet

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/tablet/pricing.png` |
| **Layout** | 2×2 grids begin to appear — good use of 768px width. |
| **Header** | Full marketing nav visible with condensed CTAs. |
| **Scroll** | Shorter than mobile due to grid — better tablet experience. |
| **Risk** | Low |

### `/request-access` mobile

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/mobile/request-access.png` |
| **First impression** | Clear player vs coach sections stacked. |
| **Player card** | Blue tint card — stands out; primary CTA full width. |
| **Coach section** | Waitlist + long demo form — **requires heavy scrolling**. |
| **Form fields** | Adequate touch height; labels above inputs. |
| **Risk** | Medium (coach path length) |

### `/privacy`, `/terms` mobile

| Field | Assessment |
|-------|------------|
| **Screenshots** | `mobile/privacy.png`, `mobile/terms.png` |
| **Behavior** | Dark policy card stacks; text readable with pinch not required. |
| **Scroll** | Long legal scroll; review button pattern on privacy. |
| **Risk** | Low |

---

## Join / access flows on mobile

### `/join`

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/mobile/join.png` |
| **UI** | Centered invalid-invite card; invite code field + Redeem / Sign in. |
| **Mobile** | Card width appropriate; plenty of vertical whitespace. |
| **UX problems** | Gray redeem button looks disabled; minimal branding. |
| **Risk** | Medium |

### `/enter-player-code` & `/parent/join`

| Field | Assessment |
|-------|------------|
| **Screenshots** | Show login shell (redirected) |
| **Behavior** | Same as desktop — **no public player/parent join UI** without auth. |
| **Risk** | **Critical** for player code path (wrong callback); **High** for parent join |

---

## Protected routes on mobile

| Route | Screenshot | Result |
|-------|------------|--------|
| `/dashboard` | `mobile/dashboard-protected.png` | Login with callback — expected |
| `/player/demo` | `mobile/player-protected.png` | Login with callback — expected |
| `/onboarding` | `mobile/onboarding.png` | Login with callback — expected |

---

## Mobile scroll behavior summary

| Page | Body scroll | Issues |
|------|-------------|--------|
| Login shell | None / minimal | Dev banner reduces usable height |
| Features | Long scroll | OK |
| Pricing | Very long | Fatigue |
| Request-access | Long (form) | OK for players; heavy for coaches |
| Join | No scroll | Large empty areas |

No **double-scroll** or **background bleed** observed on public mobile pages.

---

## Tablet-specific notes (768×1024)

| Page | Behavior |
|------|----------|
| `/` | Login shell (not marketing) |
| `/pricing` | 2-column grids — good |
| `/login` | Still dark app shell at `/login` path; marketing login at desktop only |
| Marketing nav | Partial desktop nav appears on pricing tablet shot |

**Gap:** Tablet width does not unlock marketing home at `/` — only inner marketing routes use full chrome.

---

## Mobile vs desktop brand consistency

| Element | Mobile | Desktop |
|---------|--------|---------|
| `/` experience | Dark login app | Full marketing hero |
| Primary CTA color | Blue | Blue + orange demo |
| Typography | Athletic headings on login | Athletic + sans marketing |
| Logo | White on dark (login) | Color on white (marketing) |
| Dev banner | Present | Present |

**Verdict:** Intentional split (app-first mobile) but **weak brand continuity** between mobile entry and desktop marketing.

---

## Performance perception (mobile deployed)

| Page | Feels fast? | Notes |
|------|-------------|-------|
| Login shell | Yes | Dark bg paints immediately |
| Features | Yes | Cards render quickly |
| Pricing | Yes but long | Content-heavy |
| Request-access | Yes | Form immediate |

No spinners or skeletons on public routes — acceptable for marketing.

---

## Requires safe test account to verify

- Player portal bottom nav, Film hub, feed
- Parent portal tabs, athlete profile, messages
- Coach mobile tab bar, roster cards, messages layout
- Authenticated scroll/keyboard behavior in portals
- Real empty/loading states inside app
