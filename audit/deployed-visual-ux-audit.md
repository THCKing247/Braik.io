# Deployed Visual UX Audit — braik.io (Desktop)

**Audit date:** 2026-06-07  
**URL:** https://braik.io  
**Viewport:** 1440×900  
**Method:** Playwright full-page screenshots, no login  
**Screenshots:** `audit/deployed-screenshots/desktop/`

---

## Executive summary

Production marketing and auth surfaces are **polished and on-brand** at desktop width: cinematic hero, athletic typography, blue primary CTAs, orange demo accent, and consistent header/footer. Auth gating works for `/dashboard` and `/player/*`. Several **public access paths are confusing or blocked** (`/parent/join`, `/enter-player-code`), and **footer copyright years conflict** (2023–2026). A persistent **under-development banner** affects first impression on every page.

---

## Page reviews

### `/` — Landing (desktop only at this width)

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/desktop/landing.png` |
| **First impression** | Premium sports-ops positioning — stadium hero, bold “BRAIK THE BUSYWORK. RUN THE TEAM.” Strong credibility cues (1000+ programs). |
| **Brand consistency** | Blue CTAs, orange “Request demo,” navy dark sections — cohesive marketing palette. Logo orange/blue matches CTAs. |
| **Header** | Sticky white bar; large logo; clear nav (Features, About, Why Braik, Pricing, FAQ). CTAs: Join Your Team (blue), Parent Access, Coach access, Sign in. Readable. |
| **Footer** | 4-column layout; platform/resources/support/get-app; Apex TSG attribution. Dense but scannable. |
| **Spacing / alignment** | Generous section rhythm; alternating white/navy bands. Hero CTAs well grouped. Some sections (role matrix) are text-heavy. |
| **Scroll** | Long single-page marketing scroll; body scrolls correctly. |
| **Loading** | No visible skeleton; hero image loads into place (possible brief flash). |
| **UX problems** | Many competing hero CTAs (4 buttons); “JOIN YOUR TEAM” repeated down-page; development banner reduces production polish. |
| **Recommended fix** | Reduce hero CTA count to 2 primaries; remove or soften dev banner for production; tighten role-matrix density. |
| **Risk** | Low (marketing polish) |

---

### `/login`

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/desktop/login.png` |
| **First impression** | Clean, trustworthy B2B login — marketing header + centered card. |
| **Brand** | Athletic “WELCOME BACK” headline; blue outline secondary buttons; LOGIN uses dark outline (not filled primary). |
| **Header / footer** | Full marketing chrome — consistent with landing. |
| **Spacing** | Card well centered; footer far below fold on 900px height. |
| **Scroll** | Page scrolls; card + footer stack vertically. |
| **Loading** | Instant form render. |
| **UX problems** | **LOGIN button less prominent** than blue “Join your team” / “Parent access” inside card; duplicate CTAs in header, card, and footer; dev banner on auth page. |
| **Recommended fix** | Make LOGIN filled primary (navy or blue); demote join/parent to links below primary action. |
| **Risk** | Medium (conversion / clarity) |

---

### `/request-access` (signup redirect target)

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/desktop/request-access.png` |
| **First impression** | Clear two-path split: players vs coaches/schools. |
| **Brand** | Blue player card; navy waitlist/demo actions — on-brand. |
| **Layout** | Two-column cards; **right column much taller** (embedded demo form) — vertical imbalance. |
| **Scroll** | Long page due to coach contact form. |
| **UX problems** | Coach path buries waitlist under large form; player path is concise; copyright shows **© 2026** (future year). |
| **Recommended fix** | Balance column heights; move demo form to separate step; fix copyright year. |
| **Risk** | Medium (signup friction) |

---

### `/pricing`

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/desktop/pricing.png` |
| **First impression** | Professional, transparent pricing — tier cards, “Most Popular” on Pro Video. |
| **Brand** | Blue accents, navy final CTA band — consistent. |
| **Header** | Shows “JOIN WAITLIST” instead of “JOIN YOUR TEAM” — **label inconsistency** vs other pages. |
| **Cards** | Uniform white bordered cards; good alignment in 4-column grids. |
| **Scroll** | Smooth; sections well separated. |
| **UX problems** | Football-specific headline may mismatch multi-sport marketing elsewhere; waitlist vs join terminology varies site-wide. |
| **Recommended fix** | Unify CTA labels; align sport positioning (all sports vs football). |
| **Risk** | Low–medium (brand messaging) |

---

### `/privacy`

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/desktop/privacy.png` |
| **First impression** | Serious legal presentation — dark policy card on light page. |
| **Brand** | Blue section headings on dark card — readable, distinct from main marketing. |
| **UX** | “Mark as reviewed” button with scroll-to-enable — good compliance pattern; effective date March 22, 2025 vs footer **© 2023** mismatch. |
| **Recommended fix** | Sync copyright and effective dates; ensure review button enables at scroll bottom. |
| **Risk** | Medium (trust / legal) |

---

### `/terms`

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/desktop/terms.png` |
| **First impression** | Matches privacy pattern (marketing chrome + legal body). |
| **Brand** | Consistent header/footer with rest of site. |
| **Risk** | Low — verify same date consistency as privacy. |

---

### `/features`, `/about`, `/faq`, `/why-braik`

| Field | Assessment |
|-------|------------|
| **Screenshots** | `desktop/features.png`, `about.png`, `faq.png`, `why-braik.png` |
| **First impression** | Features page: clear categorized cards (Team Ops, Communication, Payments). FAQ/About follow marketing system. |
| **Brand** | Blue checkmarks, athletic headings, white cards — consistent. |
| **Spacing** | Card grids align well at 1440px. |
| **UX problems** | Features mentions “IL/JH” in mobile capture — possible typo for “HS/JH”; long scroll on features. |
| **Risk** | Low |

---

### `/join` (public invite redemption)

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/desktop/join.png` |
| **First impression** | Minimal error-state card — “Invalid invite link” with code entry. |
| **Brand** | Sparse; only dev banner + centered card. |
| **UX problems** | Visiting `/join` without token shows error immediately — OK for invalid links; **“Redeem code” button appears gray/disabled** until code entered; little branding reassurance for anxious parents/players. |
| **Recommended fix** | Add Braik logo, friendlier copy, clearer primary button styling. |
| **Risk** | Medium (onboarding trust) |

---

### `/enter-player-code` — **redirect issue**

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/desktop/enter-player-code.png` (shows login page) |
| **Expected** | Public player code entry |
| **Actual** | Redirect to `/login?callbackUrl=%2Fparent%2Fjoin` |
| **UX problems** | **Wrong callback** — player code path sends users toward parent join after login. |
| **Recommended fix** | Fix middleware/route guard to allow public player code page or correct callback URL. |
| **Risk** | **Critical** (player onboarding broken) |

---

### `/parent/join` — auth gated

| Field | Assessment |
|-------|------------|
| **Screenshot** | `audit/deployed-screenshots/desktop/parent-join.png` (login page) |
| **Expected** | Public parent link-code entry |
| **Actual** | Redirect to login with `callbackUrl=/parent/join` |
| **UX problems** | Parents cannot start join flow without signing in first — may be intentional but hurts discoverability from marketing “Parent Access” CTAs. |
| **Recommended fix** | Confirm product intent; if public join is required, expose form before auth. |
| **Risk** | High (parent onboarding) |

---

### Protected: `/dashboard`, `/player/demo`, `/onboarding`

| Field | Assessment |
|-------|------------|
| **Screenshots** | `desktop/dashboard-protected.png`, `player-protected.png`, `onboarding.png` |
| **Behavior** | All redirect to `/login` with appropriate `callbackUrl` — **expected and correct**. |
| **UX** | Login page preserves callback — good return path after auth. |
| **Risk** | None (working as designed) |

---

## Cross-cutting desktop findings

| Issue | Severity | Evidence |
|-------|----------|----------|
| Dev banner on every page | High | All screenshots |
| CTA label inconsistency (Join / Waitlist / Get Started) | Medium | Header across pages |
| Copyright year drift (2023, 2024, 2026) | Medium | Privacy, request-access, features footers |
| Login button hierarchy inverted | Medium | `desktop/login.png` |
| `/enter-player-code` wrong redirect | Critical | manifest.json |
| `/parent/join` requires login | High | manifest.json |
| Marketing home not shown below ~1024px | High | tablet/mobile landing = login |

---

## Performance perception (deployed, desktop)

| Page | Content speed | Blank while loading? | Layout jump? |
|------|---------------|----------------------|--------------|
| Landing | Fast — hero visible quickly | Minimal | Hero image may shift |
| Login | Instant | No | Low |
| Pricing | Fast | No | Low |
| Request-access | Fast | No | Low |
| Features | Fast | No | Low |
| Join | Instant | No | Low |

Production feels **snappy on public pages** — no blank shell observed at capture time.

---

## Not audited (requires safe test account)

- Coach dashboard, roster, schedule, messages, settings, documents, game video
- Player portal (`/player/[accountId]/*`)
- Parent portal (`/parent/[linkCode]/*`)
- Authenticated onboarding wizard
- In-app loading skeletons, empty states, portal chrome
