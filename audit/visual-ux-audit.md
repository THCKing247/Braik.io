# Braik.io Visual UX Audit (Desktop)

**Audit date:** 2026-06-07  
**Method:** Code review + attempted local capture at `http://localhost:3000`  
**Viewport reference:** 1440×900 (Playwright)  
**Screenshot folder:** `audit/screenshots/desktop/`

---

## Environment blocker (must resolve before live audit)

The dev server starts (`npm run dev`) but **every route crashes at runtime** with:

> `Braik Supabase: missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env / Netlify and rebuild the app.`

**Required to render any page:**

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (hard crash in `src/lib/supabaseClient.ts`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase client (required immediately after URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server API routes, auth, data loading |

**Strongly recommended for production-like sessions:**

| Variable | Role |
|----------|------|
| `AUTH_SECRET` | Session signing (warn-only in dev if missing) |

**Optional (feature-specific):** `POSTMARK_*`, `STRIPE_*`, `OPENAI_API_KEY`, `TWILIO_*`

All desktop screenshots currently show the Next.js error overlay — see `audit/screenshots/desktop/*.png`. Re-run `node audit/capture-screenshots.js` after configuring `.env.local`.

---

## Global design system

| Token | Value / usage | Source |
|-------|---------------|--------|
| Page background | Light Steel `#F7F9FC` (`--snow`) | `app/globals.css` |
| Cards | White `#FFFFFF` on platinum borders | CSS vars `--surface`, `--platinum` |
| Primary accent (CSS) | Blue `#2563EB` (`--accent`) | `globals.css` |
| Brand navy (free portals) | `#081838` / `#081848` | `components/portal/portal-brand-tokens.ts` |
| Brand orange | `#F85808` / hover `#D83808` | `portal-brand-tokens.ts` |
| Coach sidebar | Slate `#0f172a` + orange active states | `dashboard-sidebar.tsx` |
| Typography | Inter (`font-sans`), Teko/Oswald (`font-athletic`) | `tailwind.config.ts` |
| Scrollbars | **Hidden globally** on all elements | `globals.css` lines 5–12 |

**Brand tension:** Marketing and coach content lean **blue + Light Steel**; free portals and coach sidebar lean **navy + orange**. Three distinct navy hex families appear across the product.

---

## Page-by-page checklist (desktop)

Legend: **Live** = blocked by env; **Code** = inferred from components.

### Landing / home (`/`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/landing.png` (error overlay) |
| First impression | **Code:** Full-bleed fog/field hero, athletic uppercase type, dark gradients — premium sports-tech feel. **Live:** Not observable. |
| Brand colors | Hero uses slate/navy dark bands + blue CTAs; orange reserved for “Request demo” (`home-theme.ts`). Consistent within marketing, diverges from portal orange. |
| Header | Sticky white bar, large logo (4.5rem), blue active nav underline (`site-header.tsx`). |
| Footer | 4-column white footer, support modal, Apex TSG credit. |
| Spacing / alignment | `container mx-auto px-4` sections; consistent marketing rhythm. |
| Cards | `MarketingCard` variants (light + dark glass on navy sections). |
| Fonts | Athletic display in hero; sans in body — intentional hierarchy. |
| Button hierarchy | Primary blue filled; secondary outline; demo orange — clear. |
| Loading | `app/(marketing)/loading.tsx` — full-screen pulse gradient. |
| Empty states | N/A on home. |
| Scroll | Body scroll; mobile menu locks `document.body.overflow`. |
| Layout issues | Logo height (4.5rem) dominates header on tablet widths. |

### Login (`/login`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/login.png` (error overlay) |
| First impression | **Code:** Marketing header + centered form on soft gradient (`from-[#F8FAFC] to-white`), footer below — clean B2B SaaS pattern. |
| Brand | Blue link hovers; sign-in button uses legacy `btn-signin-red` (navy → blue hover in CSS). |
| Header / footer | Full marketing chrome on desktop. |
| Form | `HeroLoginForm` — athletic h1, muted helper text. |
| Loading | Inline submit spinner in form. |
| Mobile note | At `< lg`, home redirects to login dark app shell — **different visual product** than desktop login. |

### Signup / onboarding (`/signup/role`, `/onboarding`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/signup-role.png` (capture failed — redirect); `onboarding.png` (error overlay) |
| Signup | Role cards with blue selected border (`border-[#3B82F6] bg-[#EFF6FF]`), emoji icons — friendly but less polished than marketing hero. |
| Onboarding | `onboarding-wizard.tsx` — shadcn Card/Input, no marketing chrome; reads as internal tool vs signup continuation. |
| Loading | Pulse skeleton blocks while session resolves. |

### Coach dashboard (`/dashboard`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/coach-dashboard.png` (error overlay) |
| First impression | **Code:** Light Steel canvas + dark sidebar + navy team banner gradient (`#17385F` → `#0F315C`) — professional, dense. |
| Command center feel | Home stacks calendar strip, announcements, notifications widgets; staged bootstrap limits first paint. |
| Header | Fixed 5rem top bar: logo, team switcher, profile (`dashboard-nav.tsx`). |
| Sidebar | 240px slate `#0f172a`, orange section labels, orange active left border + pulse animation. |
| Module consistency | White cards + CSS-var borders; banner uses custom navy not in brand tokens. |
| Loading | Layered: shell skeleton → route pulse → in-widget skeletons (`dashboard-shell-loading-skeleton.tsx`, `dashboard-route-skeletons.tsx`). |
| Empty states | Inline muted text — no shared illustration pattern. |
| Scroll | `ScrollFadeContainer` on main; messages/settings use inner scroll ownership. |
| Performance feel | Shell → bootstrap-light → deferred-core waterfall; home feels structured but not instant. |

### Roster (`/dashboard/roster`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/roster.png` (error overlay) |
| Layout | `RosterManagerEnhanced` — grid/table with desktop skeletons. |
| Cards | Player cards consistent with portal card tokens. |
| Empty | “No players…” inline copy. |
| Scroll | Table/grid in main scroll; hidden scrollbars reduce affordance. |
| Loading | `RosterDesktopSkeleton` grid pulse. |

### Schedule (`/dashboard/schedule`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/schedule.png` (error overlay) |
| Layout | `TeamScheduleContent` + game views; calendar skeleton on route transition. |
| Scroll | Special bottom padding to clear mobile tab bar when resized — maintenance risk. |
| Performance | Single season-range games query on mount (medium load per `page-api-load-map.md`). |

### Messages (`/dashboard/messages`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/messages.png` (error overlay) |
| Layout | Three-column desktop: contacts / conversation / threads (`messaging-manager.tsx`). |
| Empty | “No conversations yet” / “No messages yet” — text only. |
| Scroll | Custom overflow chain; outer column `overflow-y-hidden` on desktop. |
| Performance | High — bootstrap + RPC + Realtime + contacts parallel load. |
| Contrast | Role-colored bubbles (HC blue, coaches orange, players green, parents purple) per messaging rules. |

### Settings (`/dashboard/settings`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/settings.png` (error overlay) |
| Layout | `PortalUnderlineTabs` + section panels; full-height inner scroll on lg. |
| Loading | Dedicated bundle fetch (`/api/me/settings-page-bundle`), separate from bootstrap. |
| Cards | Standard shadcn cards; account/team/calendar sections. |

### Documents (`/dashboard/documents`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/documents.png` (error overlay) |
| Layout | Category tabs + document grid (`documents-manager.tsx`). |
| Empty | Centered “No documents found”. |
| Loading | Grid skeleton on `listLoading`. |

### Game video library (`/dashboard/game-video`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/game-video.png` (error overlay) |
| Layout | `GameVideoLibrary` — browse + film room modal. |
| Empty | Bordered entitlement card with explanation. |
| Performance | **Highest risk** — N+1 clip fetches per video (`page-api-load-map.md`). |
| Loading | Likely blank until videos + clips resolve — skeleton coverage unclear. |

### Player entry (`/enter-player-code`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/enter-player-code.png` (error overlay) |
| Purpose | Gateway to free player portal — form-centric, marketing-adjacent styling expected. |

### Parent join (`/parent/join`)

| Criterion | Assessment |
|-----------|------------|
| Screenshot | `audit/screenshots/desktop/parent-join.png` (error overlay) |
| Purpose | Parent link-code entry — trust-focused copy expected. |

---

## Cross-cutting desktop issues

1. **Hard env gate** — No page renders without Supabase trio; first-run developer experience is a crash overlay, not a graceful config message.
2. **Accent split** — Blue CSS accent vs orange sidebar active vs orange player/parent tabs.
3. **Hidden scrollbars** — Lists (roster, messages, documents) may appear truncated.
4. **No unified empty-state system** — Coach modules use ad hoc muted text.
5. **Marketing vs portal discontinuity** — Landing is cinematic dark/light; coach portal is Light Steel + dark sidebar; auth onboarding is plain forms.

---

## Performance perception (desktop, code-informed)

| Page | Content speed | Blank while loading? | Skeletons helpful? | Layout jump risk | Nav feel |
|------|---------------|----------------------|--------------------|------------------|----------|
| Landing | Dynamic imports below fold | Pulse page loader | Partial | Hero image may shift | Instant route change |
| Login | Fast once env fixed | Form-only | Minimal | Low | Instant |
| Dashboard | Staged bootstrap | Shell skeleton first | Yes — layered | Banner/widgets may pop in | Shell cached 10 min |
| Roster | Bootstrap then tab fetches | Grid skeleton | Yes | Tab switches refetch | Medium |
| Schedule | Dedicated games query | Calendar skeleton | Yes | Medium | Medium |
| Messages | Waits on deferred-core | Thread list delay | Partial | Column widths stable | Feels heavy |
| Settings | Isolated bundle | Full page wait | Limited | Low | Medium |
| Documents | useEffect fetch | Grid skeleton | Yes | Low | Medium |
| Game video | N+1 clips | Likely long blank | Weak | High when clips arrive | Slow |

---

## Re-audit steps (when env is configured)

1. Copy Supabase keys to `.env.local` (see Environment blocker above).
2. Restart `npm run dev`.
3. Run `node audit/capture-screenshots.js`.
4. Log in with seeded accounts (`undoc/TEST_ACCOUNTS.md`).
5. Capture authenticated routes: `/dashboard`, roster, schedule, messages, settings, documents, game-video.
6. Capture player portal: `/player/[accountId]`, `/player/[accountId]/prep/film`.
7. Capture parent portal: `/parent/[linkCode]`.
