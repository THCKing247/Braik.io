# Deployed Public Route Screenshots — braik.io

**Audit date:** 2026-06-07  
**Target:** https://braik.io  
**Capture tool:** Playwright (`audit/capture-deployed-screenshots.js`)  
**Manifest:** `audit/deployed-screenshots/manifest.json`

Viewports:

| Folder | Size |
|--------|------|
| `desktop/` | 1440×900 |
| `tablet/` | 768×1024 |
| `mobile/` | 390×844 |

No authentication used. No forms submitted.

---

## Route access summary

| Route | Public? | Final URL (desktop) | HTTP | Notes |
|-------|---------|---------------------|------|-------|
| `/` | Yes | `/` | 200 | Desktop = marketing home; **mobile & tablet = login shell** |
| `/login` | Yes | `/login` | 200 | Marketing chrome (desktop); dark app shell (mobile) |
| `/signup` | Redirect | `/request-access` | 200 | Signup consolidated to request-access |
| `/signup/role` | Redirect | `/request-access` | 200 | Same |
| `/pricing` | Yes | `/pricing` | 200 | Full pricing page |
| `/privacy` | Yes | `/privacy` | 200 | Dark policy card + scroll-to-review |
| `/terms` | Yes | `/terms` | 200 | Legal page |
| `/features` | Yes | `/features` | 200 | Feature grid |
| `/about` | Yes | `/about` | 200 | About page |
| `/faq` | Yes | `/faq` | 200 | FAQ |
| `/why-braik` | Yes | `/why-braik` | 200 | Why Braik |
| `/request-access` | Yes | `/request-access` | 200 | Player signup + coach waitlist/demo form |
| `/join` | Yes | `/join` | 200 | **Invalid invite link** UI (no token) — code entry public |
| `/enter-player-code` | Redirect | `/login?callbackUrl=%2Fparent%2Fjoin` | 200 | **Unexpected** — should target player code flow, not parent join |
| `/parent/join` | Redirect | `/login?callbackUrl=%2Fparent%2Fjoin` | 200 | Parent join gated behind login |
| `/onboarding` | Redirect | `/login?callbackUrl=/onboarding` | 200 | Auth required |
| `/dashboard` | Redirect | `/login?callbackUrl=%2Fdashboard` | 200 | Expected auth gate |
| `/player/demo` | Redirect | `/login?callbackUrl=%2Fplayer%2Fdemo` | 200 | Expected auth gate |

---

## Screenshot index

### Landing `/`

| Viewport | Path |
|----------|------|
| Desktop | `audit/deployed-screenshots/desktop/landing.png` |
| Tablet | `audit/deployed-screenshots/tablet/landing.png` |
| Mobile | `audit/deployed-screenshots/mobile/landing.png` |

**Note:** Tablet and mobile captures show the **Team Workspace login screen**, not the marketing homepage.

---

### Login `/login`

| Viewport | Path |
|----------|------|
| Desktop | `audit/deployed-screenshots/desktop/login.png` |
| Tablet | `audit/deployed-screenshots/tablet/login.png` |
| Mobile | `audit/deployed-screenshots/mobile/login.png` |

---

### Signup (redirects to request-access)

| Viewport | Path |
|----------|------|
| Desktop | `audit/deployed-screenshots/desktop/signup.png` |
| Desktop (role) | `audit/deployed-screenshots/desktop/signup-role.png` |
| Tablet | `audit/deployed-screenshots/tablet/signup.png` |
| Mobile | `audit/deployed-screenshots/mobile/signup.png` |

---

### Request access `/request-access` (effective signup)

| Viewport | Path |
|----------|------|
| Desktop | `audit/deployed-screenshots/desktop/request-access.png` |
| Tablet | `audit/deployed-screenshots/tablet/request-access.png` |
| Mobile | `audit/deployed-screenshots/mobile/request-access.png` |

---

### Pricing `/pricing`

| Viewport | Path |
|----------|------|
| Desktop | `audit/deployed-screenshots/desktop/pricing.png` |
| Tablet | `audit/deployed-screenshots/tablet/pricing.png` |
| Mobile | `audit/deployed-screenshots/mobile/pricing.png` |

---

### Privacy `/privacy`

| Viewport | Path |
|----------|------|
| Desktop | `audit/deployed-screenshots/desktop/privacy.png` |
| Tablet | `audit/deployed-screenshots/tablet/privacy.png` |
| Mobile | `audit/deployed-screenshots/mobile/privacy.png` |

---

### Terms `/terms`

| Viewport | Path |
|----------|------|
| Desktop | `audit/deployed-screenshots/desktop/terms.png` |
| Tablet | `audit/deployed-screenshots/tablet/terms.png` |
| Mobile | `audit/deployed-screenshots/mobile/terms.png` |

---

### Features `/features`

| Viewport | Path |
|----------|------|
| Desktop | `audit/deployed-screenshots/desktop/features.png` |
| Tablet | `audit/deployed-screenshots/tablet/features.png` |
| Mobile | `audit/deployed-screenshots/mobile/features.png` |

---

### About, FAQ, Why Braik

| Route | Desktop | Tablet | Mobile |
|-------|---------|--------|--------|
| `/about` | `desktop/about.png` | `tablet/about.png` | `mobile/about.png` |
| `/faq` | `desktop/faq.png` | `tablet/faq.png` | `mobile/faq.png` |
| `/why-braik` | `desktop/why-braik.png` | `tablet/why-braik.png` | `mobile/why-braik.png` |

---

### Join / player / parent access

| Route | Desktop | Tablet | Mobile | Result |
|-------|---------|--------|--------|--------|
| `/join` | `desktop/join.png` | `tablet/join.png` | `mobile/join.png` | Public invalid-invite UI |
| `/enter-player-code` | `desktop/enter-player-code.png` | `tablet/enter-player-code.png` | `mobile/enter-player-code.png` | Redirect → login (parent callback) |
| `/parent/join` | `desktop/parent-join.png` | `tablet/parent-join.png` | `mobile/parent-join.png` | Redirect → login |

---

### Protected routes (auth redirect captures)

| Route | Desktop | Tablet | Mobile | Redirect target |
|-------|---------|--------|--------|-----------------|
| `/dashboard` | `desktop/dashboard-protected.png` | `tablet/dashboard-protected.png` | `mobile/dashboard-protected.png` | `/login?callbackUrl=%2Fdashboard` |
| `/player/demo` | `desktop/player-protected.png` | `tablet/player-protected.png` | `mobile/player-protected.png` | `/login?callbackUrl=%2Fplayer%2Fdemo` |
| `/onboarding` | `desktop/onboarding.png` | `tablet/onboarding.png` | `mobile/onboarding.png` | `/login?callbackUrl=/onboarding` |

---

## Global elements visible in all captures

- **Development banner:** `🚧 Site currently under development — Braik v1.0.6 coming soon` (dark bar, all viewports)
- **Brand logo:** Orange/blue Braik mark consistent across marketing pages
- **No loading spinners observed** at 2.5s wait — pages render as static HTML quickly on production

---

## Re-capture command

```bash
node audit/capture-deployed-screenshots.js
```

Previous local audit screenshots remain in `audit/screenshots/` (unchanged).
