# Deployed Visual Screenshot Index — braik.io

**Capture date:** 2026-06-07  
**Target:** https://braik.io  
**Method:** Playwright full-page screenshots (no login, no form submission)  
**Machine manifest:** `../braik-visual-audit-screenshots/manifest.json`

---

## Screenshot folder (outside repository)

**Path:** `c:\Users\mjgat\OneDrive\Documents\braik-visual-audit-screenshots`

Structure:

```
braik-visual-audit-screenshots/
├── desktop/     (1440×900)
├── tablet/      (768×1024)
├── mobile/      (390×844)
├── manifest.json
└── capture.js
```

> **Reminder:** All PNG screenshots live **outside** the Braik.io git repository. They are **not committed** and should not be copied into `audit/screenshots/` or `audit/deployed-screenshots/` unless explicitly requested.

---

## Viewports

| Folder | Size |
|--------|------|
| `desktop/` | 1440×900 |
| `tablet/` | 768×1024 |
| `mobile/` | 390×844 |

**Total screenshots captured:** 39 (13 routes × 3 viewports)

---

## Route summary

| Route | Public result | Redirect / block |
|-------|---------------|-------------------|
| `/` | 200 | Desktop = marketing home; **mobile & tablet = Team Workspace login shell** |
| `/login` | 200 | Marketing login (desktop); dark app shell (mobile/tablet) |
| `/signup` | 200 | Redirect → `/request-access` |
| `/signup/role` | 200 | Redirect → `/request-access` |
| `/pricing` | 200 | — |
| `/privacy` | 200 | — |
| `/terms` | 200 | — |
| `/parent-access` | **404** | Page not found |
| `/join-your-team` | **404** | Page not found |
| `/request-access` | 200 | Effective signup / get-access page |
| `/join` | 200 | Invalid-invite UI with invite code field (no token) |
| `/parent/join` | 200 | Redirect → `/login?callbackUrl=%2Fparent%2Fjoin` |
| `/enter-player-code` | 200 | Redirect → `/login?callbackUrl=%2Fparent%2Fjoin` (unexpected callback) |

**Live equivalents for 404 slugs:** use `/request-access` (signup) and header CTAs “Join your team” / “Parent access” on `/login`.

---

## Screenshot inventory

Paths below are relative to `braik-visual-audit-screenshots/`.

### `/` — Landing

| File | Viewport | Note |
|------|----------|------|
| `desktop/landing.png` | 1440×900 | Full marketing homepage — stadium hero, CTAs, feature sections |
| `tablet/landing.png` | 768×1024 | Dark Team Workspace login (marketing home hidden) |
| `mobile/landing.png` | 390×844 | Dark Team Workspace login — welcome back, sign-in card |

### `/login`

| File | Viewport | Note |
|------|----------|------|
| `desktop/login.png` | 1440×900 | Marketing header/footer + centered sign-in card |
| `tablet/login.png` | 768×1024 | Dark app login shell |
| `mobile/login.png` | 390×844 | Dark app login shell with join/parent buttons |

### `/signup` (redirects to request-access)

| File | Viewport | Note |
|------|----------|------|
| `desktop/signup.png` | 1440×900 | Get Access page — player vs coach paths |
| `tablet/signup.png` | 768×1024 | Same (redirected) |
| `mobile/signup.png` | 390×844 | Stacked player + coach cards |

### `/signup/role` (redirects to request-access)

| File | Viewport | Note |
|------|----------|------|
| `desktop/signup-role.png` | 1440×900 | Same Get Access content as `/signup` |
| `tablet/signup-role.png` | 768×1024 | Same |
| `mobile/signup-role.png` | 390×844 | Same |

### `/pricing`

| File | Viewport | Note |
|------|----------|------|
| `desktop/pricing.png` | 1440×900 | Tier cards, video add-ons, navy CTA band |
| `tablet/pricing.png` | 768×1024 | 2-column pricing grids |
| `mobile/pricing.png` | 390×844 | Single-column stacked pricing cards |

### `/privacy`

| File | Viewport | Note |
|------|----------|------|
| `desktop/privacy.png` | 1440×900 | Dark policy card on light page |
| `tablet/privacy.png` | 768×1024 | Policy card stacked layout |
| `mobile/privacy.png` | 390×844 | Long legal scroll |

### `/terms`

| File | Viewport | Note |
|------|----------|------|
| `desktop/terms.png` | 1440×900 | Terms of service — marketing chrome |
| `tablet/terms.png` | 768×1024 | Terms content stacked |
| `mobile/terms.png` | 390×844 | Terms mobile scroll |

### `/parent-access` (404)

| File | Viewport | Note |
|------|----------|------|
| `desktop/parent-access.png` | 1440×900 | Next.js 404 page + dev banner |
| `tablet/parent-access.png` | 768×1024 | 404 |
| `mobile/parent-access.png` | 390×844 | 404 |

### `/join-your-team` (404)

| File | Viewport | Note |
|------|----------|------|
| `desktop/join-your-team.png` | 1440×900 | Next.js 404 page + dev banner |
| `tablet/join-your-team.png` | 768×1024 | 404 |
| `mobile/join-your-team.png` | 390×844 | 404 |

### `/request-access`

| File | Viewport | Note |
|------|----------|------|
| `desktop/request-access.png` | 1440×900 | Player signup + coach waitlist/demo form |
| `tablet/request-access.png` | 768×1024 | Two-column access paths |
| `mobile/request-access.png` | 390×844 | Stacked access + long demo form |

### `/join` (invite redemption)

| File | Viewport | Note |
|------|----------|------|
| `desktop/join.png` | 1440×900 | “Invalid invite link” + code entry (public) |
| `tablet/join.png` | 768×1024 | Same centered card |
| `mobile/join.png` | 390×844 | Same card, mobile width |

### `/parent/join` (auth redirect)

| File | Viewport | Note |
|------|----------|------|
| `desktop/parent-join.png` | 1440×900 | **Shows login** — redirected before parent join UI |
| `tablet/parent-join.png` | 768×1024 | Login shell after redirect |
| `mobile/parent-join.png` | 390×844 | Login shell after redirect |

### `/enter-player-code` (auth redirect)

| File | Viewport | Note |
|------|----------|------|
| `desktop/enter-player-code.png` | 1440×900 | **Shows login** — callbackUrl points to `/parent/join` |
| `tablet/enter-player-code.png` | 768×1024 | Login after redirect |
| `mobile/enter-player-code.png` | 390×844 | Login after redirect |

---

## Global elements (all captures)

- Dev banner: `🚧 Site currently under development — Braik v1.0.6 coming soon`
- No authentication used; no forms submitted
- Protected app routes (`/dashboard`, `/player/*` with auth) were **not** captured in this pass

---

## Re-capture (outside repo)

```bash
node c:/Users/mjgat/OneDrive/Documents/braik-visual-audit-screenshots/capture.js
```

Requires Playwright installed in that folder (`npm install playwright`).
