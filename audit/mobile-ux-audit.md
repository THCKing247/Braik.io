# Braik.io Mobile UX Audit

**Audit date:** 2026-06-07  
**Method:** Code review + attempted local capture at `http://localhost:3000`  
**Viewport reference:** 390×844 (iPhone-class, Playwright)  
**Screenshot folder:** `audit/screenshots/mobile/`

---

## Environment blocker

Same as desktop audit: **no route renders** without `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. All mobile screenshots in `audit/screenshots/mobile/` currently show the Next.js runtime error overlay.

---

## Mobile shell architecture

| Portal | Max content width | Bottom nav height | Safe area |
|--------|-------------------|-------------------|-----------|
| Coach | 480px centered (`MobilePortalShell`) | 68px + safe inset | `env(safe-area-inset-bottom)` |
| Player | `max-w-lg` | ~68px, 44px min tap targets | Yes |
| Parent | `max-w-lg` | Same pattern | Yes |

**Breakpoint:** `lg` (1024px) — below this, coach uses bottom tab bar; at/above, sidebar layout.

**Global mobile CSS classes** (`globals.css`):

- `.mobile-text-title`, `.mobile-text-subtitle`, `.mobile-text-body`, `.mobile-text-caption` — sans-first typography for phone UI.

---

## Marketing / home at mobile width

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/mobile/landing.png` (error overlay) |
| **Critical product decision** | Home page content is **`lg:hidden` replaced by login** (`MobileRootRedirect`). Phones at `/` do **not** see the marketing site — they see the auth app shell. |
| Implication | Mobile users never experience hero, features, or pricing from `/` without navigating to inner marketing routes manually. |
| Marketing inner pages | Pricing, FAQ, etc. use responsive stacks — drawer nav in header, 52px+ CTAs. |
| Header mobile | Hamburger → right drawer (w-72), body scroll locked. |
| Touch targets | Drawer links and CTAs meet ~44px guidance. |
| Scroll | Body scroll; menu open locks body — correct pattern. |

**Recommendation priority:** Decide whether login-only at `/` on mobile is intentional (app-first) or a discovery gap.

---

## Auth at mobile width

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/mobile/login.png` (error overlay) |
| Shell | `MobileAppLoginScreen` — dark full viewport `#0B1220`, blue radial blooms, inverted logo. |
| Form | `HeroLoginForm variant="app"` — white rounded-2xl card, remember-me in localStorage. |
| Contrast | High — white card on dark; good readability. |
| vs Desktop login | Completely different visual language (dark app vs white marketing). |
| Signup mobile | Role selection uses marketing header + stacked cards — third visual mode. |
| Onboarding | No mobile-specific polish; same plain wizard as desktop. |

---

## Coach portal mobile (`max-lg`)

| Criterion | Assessment |
|-----------|------------|
| Screenshots | `coach-dashboard.png`, `roster.png`, etc. (error overlays) |
| Chrome | White sticky top bar (centered logo) + fixed bottom 5-tab bar: Home \| Roster \| Calendar \| Messages \| More. |
| Active tab color | **Blue** `rgb(var(--accent))` — differs from desktop sidebar **orange** active state. |
| Content width | Capped at 480px, centered — app-like phone column on wider phones/tablets. |
| Tap targets | Tab icons + labels; More opens bottom sheet for secondary routes. |
| Scroll | Main column scrolls; tab bar fixed; schedule page adds extra bottom padding calc. |
| Body scroll | Generally contained in main — good. |
| Hidden scrollbars | **High impact on mobile** — users may not discover scrollable roster/lists. |
| Messages | Same `MessagingManager` as desktop — dense for phone; likely stacked/single-pane modes in narrow width (verify live). |
| Loading | Shell skeleton → compact route pulse (avoids double full-screen spinner). |
| Empty states | Text-only; no thumb-scale empty illustrations. |

### Mobile usability risks (coach)

1. Sidebar-only features buried in **More** sheet — discoverability depends on sheet organization.
2. Blue mobile tabs vs orange desktop sidebar — inconsistent wayfinding color.
3. Messages three-column logic compressed — regression risk on small heights (iOS keyboard, safe areas).
4. 480px shell on tablet widths leaves unused horizontal space (intentional per mobile-app-like rules).

---

## Player portal mobile

| Criterion | Assessment |
|-----------|------------|
| Screenshot | Not captured (requires auth + account segment) |
| Shell | Full navy gradient (`braikPlayerTheme.shell`), orange bloom overlays, fixed header + bottom nav. |
| Bottom nav | Feed \| Calendar \| Messages \| **Team** \| Profile — 44px+ targets, `active:scale-[0.98]`. |
| Active tab | Orange `#F85808` pill — strong, on-brand for player experience. |
| Film hub | Secondary segmented control: Study \| Film \| Playbooks (`PlayerPortalPrepShell`). |
| Label issue | Bottom tab says **“Team”** but routes to Film hub — players may not associate tab with film/study/playbooks. |
| Content | `max-w-lg`, main `overflow-y-auto`, `pb-28` for nav clearance — correct app scroll model. |
| Typography | Athletic gradients in header; uppercase micro-labels on tabs. |
| Age-friendly | High contrast navy/orange, large tabs, simple 5-item nav — good. |
| Feed | Mock/sample posts when no live data — “Sample posts” badge helps but content always looks populated. |
| Study/playbooks | Dark embedded panels `#0a1220` — slight tone mismatch vs shell `#081838`. |
| Desktop at mobile width | No `lg:` desktop player layout — bottom nav persists on large screens (intentional per rules). |

---

## Parent portal mobile

| Criterion | Assessment |
|-----------|------------|
| Screenshot | Not captured (requires link code) |
| Shell | Same navy gradient as player on mobile; calmer surfaces in `braikParentTheme`. |
| Bottom nav | Feed \| Calendar \| Messages \| **Player** \| **Profile** |
| **Nav confusion** | Tab 4 “Player” → athlete profile/documents; Tab 5 “Profile” → reminders — easy to mis-tap. |
| Trust | Athlete snapshot uses light card `#F8F8F8` on dark — readable stats grid. |
| Payments | **No dedicated payments tab or page** in parent portal components — gap for dues/trust. |
| Messages | Full coach `MessagingManager` in dark bordered container — powerful but dense for parents. |
| Feed | Mix of live announcements + static demo posts — trust concern if demos look real. |
| Desktop crossover | At `lg+`, parent shell switches to **light** header/nav (`lg:bg-white`) while player stays dark — parent-only desktop light shift. |

---

## Mobile scroll behavior summary

| Area | Body scroll | Content scroll | Issues |
|------|-------------|----------------|--------|
| Marketing drawer open | Locked | — | Correct |
| Coach mobile | Main only | `ScrollFadeContainer` | Hidden scrollbars |
| Coach messages/settings | Outer hidden | Inner pane | Complex; iOS keyboard risk |
| Player/parent | Main column | `overflow-y-auto` + bottom padding | Sound app pattern |
| Schedule | Main + extra padding | Tab bar clearance | Special-case CSS |

---

## Mobile performance perception

| Surface | Feels fast? | Blank loading? | Notes |
|---------|-------------|------------------|-------|
| Login app shell | Yes (once env fixed) | Brief pulse | Dark shell paints quickly |
| Coach home | Medium | Shell skeleton | 4+ network gates on player home |
| Coach messages | Slow | Thread list waits | High parallel load |
| Player home | Medium-slow | Bootstrap + highlights | Waterfall documented |
| Parent entry | Slow | portal-context blocks children | Hard gate before UI |
| Game video | Slow | N+1 clips | Worst portal perf |

---

## Mobile screenshot inventory

| File | Route | Status |
|------|-------|--------|
| `landing.png` | `/` | Error overlay (env) |
| `login.png` | `/login` | Error overlay (env) |
| `signup-role.png` | `/signup/role` | Error overlay (env) |
| `onboarding.png` | `/onboarding` | Error overlay (env) |
| `coach-dashboard.png` | `/dashboard` | Error overlay (env) |
| `roster.png` | `/dashboard/roster` | Error overlay (env) |
| `schedule.png` | `/dashboard/schedule` | Error overlay (env) |
| `messages.png` | `/dashboard/messages` | Error overlay (env) |
| `settings.png` | `/dashboard/settings` | Error overlay (env) |
| `documents.png` | `/dashboard/documents` | Error overlay (env) |
| `game-video.png` | `/dashboard/game-video` | Error overlay (env) |
| `enter-player-code.png` | `/enter-player-code` | Error overlay (env) |
| `parent-join.png` | `/parent/join` | Error overlay (env) |

**Missing (needs env + auth):** player portal routes, parent portal routes, authenticated coach content states, empty/loading intermediate states.

---

## Mobile-specific priority themes

1. Resolve env blocker — no mobile UX validation possible without it.
2. Clarify `/` mobile strategy (login-only vs marketing).
3. Fix parent nav labels (Player vs Profile).
4. Rename player “Team” tab to “Film” or similar.
5. Re-enable scroll affordance (thin scrollbars or fade cues) on long lists.
6. Replace mock feed content with true empty states on player/parent home.
7. Add parent payments/dues surface if in product scope.
