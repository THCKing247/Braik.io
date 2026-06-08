# Braik.io Portal Experience Audit

**Audit date:** 2026-06-07  
**Scope:** Coach dashboard, player free portal, parent free portal  
**Method:** Component architecture review + performance map cross-reference (`audit/page-api-load-map.md`)  
**Live validation:** Blocked — missing Supabase environment variables (see `audit/visual-ux-audit.md`)

---

## Executive summary

Braik operates **three distinct visual products** under one brand:

| Portal | Visual identity | Nav model | Primary user |
|--------|-----------------|-----------|--------------|
| **Coach** | Light Steel workspace + dark slate sidebar (orange accents) | Sidebar (desktop) / bottom tabs (mobile) | Staff |
| **Player** | Navy gradient shell + orange active tabs | Bottom tabs only | Athletes |
| **Parent** | Navy mobile / light desktop hybrid + orange tabs | Bottom tabs only | Families |

The player and parent portals successfully **feel different from coach** — darker, simpler, thumb-first. The coach portal feels **professional and module-dense** but suffers from **accent inconsistency** (blue content vs orange sidebar vs custom banner navy) and **performance waterfalls** on heavy modules.

Trust risks concentrate in **mock/demo feed content** on player/parent home and **missing parent payments surface**.

---

## Coach portal

### Does it feel professional and fast?

**Professional — yes (in code/design intent).**

- Enterprise Light Steel palette (`#F7F9FC` page, white cards).
- Fixed chrome: team switcher, profile, structured sidebar sections with orange labels.
- Team dashboard banner uses athletic typography and record stats — “program headquarters” tone.
- Layered loading (shell skeleton → route pulse → widget skeletons) avoids a single blank flash.

**Fast — partially.**

- Shell query cached 10 minutes — return navigation should feel instant.
- Home uses **staged bootstrap** (light → deferred-core → deferred-heavy) — good architecture, but users still wait for widgets to populate.
- **Game video**, **messages**, and **roster depth/readiness** are documented slow paths.

### Command center assessment

| Module | Command-center quality | Notes |
|--------|------------------------|-------|
| Dashboard home | Strong | Calendar strip + announcements + notifications in one glance |
| Roster | Strong | Enhanced manager, depth/readiness tabs add depth |
| Schedule / calendar | Good | Season view; games query on mount |
| Messages | Powerful but heavy | Full three-column messaging manager — appropriate for staff |
| Documents | Adequate | Category tabs, grid; isolated fetch |
| Game video | Feature-rich, slow | Film room modal; N+1 clip loading |
| Settings | Isolated | Own bundle endpoint — doesn’t reuse bootstrap |
| AI assistant | Present | Coach B panel in sidebar (blue CTA on orange-accent sidebar) |

**Verdict:** Dashboard home + sidebar wayfinding support a command-center mental model. Performance on video and messaging undermines “fast” perception.

### Module visual consistency

**Consistent:**

- `PortalStandardPage` frame on many routes.
- shadcn Card + CSS variable borders in content area.
- `PortalUnderlineTabs` in settings and similar surfaces.
- Shared `AppLoader` / `LoadingState` / pulse skeletons.

**Inconsistent:**

| Element | Issue |
|---------|-------|
| Sidebar vs mobile tabs | Orange active (sidebar) vs blue active (mobile tabs) |
| Team banner navy | `#17385F` custom gradient — not `braikBrand.navy` |
| Message badges | Amber `bg-amber-500` vs brand orange |
| Coach B CTA | Blue button inside orange-accent sidebar panel |
| Empty states | Text-only vs `AdEmptyState` (AD portal only) |

### Coach portal key files

- Shell: `components/portal/dashboard-team-shell-gate.tsx`, `dashboard-layout-client.tsx`
- Nav: `dashboard-nav.tsx`, `dashboard-sidebar.tsx`, `dashboard-mobile-tab-bar.tsx`
- Home: `components/portal/team-dashboard.tsx`
- Features: `roster-manager-enhanced.tsx`, `calendar-manager.tsx`, `messaging-manager.tsx`, `documents-manager.tsx`, `game-video-library.tsx`, `settings-layout.tsx`

---

## Player portal

### Distinct from coach while still branded?

**Yes — clearly differentiated.**

- Full-screen navy gradient shell with orange bloom (`braikPlayerTheme`, `braik-player-visual-tokens.ts`).
- Bottom navigation only — no sidebar, no Light Steel workspace.
- Orange active tab pills vs coach blue mobile tabs.
- Athletic header gradients (white → orange) vs coach sans content area.

**Brand link:** Shared logo, orange `#F85808`, navy family — reads as “Braik for athletes.”

### Simple and age/player-friendly?

**Mostly yes.**

- Five bottom tabs with icons + short labels.
- `min-h-[44px]` tap targets, `active:scale-[0.98]` feedback.
- Film hub secondary nav (Study | Film | Playbooks) uses segmented 3-column control with 2.75rem min height.
- Single main scroll column — familiar app pattern.

**Friction points:**

1. Bottom tab labeled **“Team”** opens Film hub (`playerFilmHubRoot`) — label doesn’t match Film/Study/Playbooks mental model.
2. Home feed always shows content via **mock posts** — reduces clarity of what’s real vs sample.
3. Study/playbook panels use darker `#0a1220` than shell — minor visual inconsistency.
4. At `lg` widths, layout widens slightly but keeps phone chrome — no desktop player experience (per workspace rules).

### Are actions clear?

| Action | Clarity |
|--------|---------|
| View feed / announcements | Clear — Home tab |
| Calendar | Clear |
| Message coach | Clear — Messages tab |
| Study / film / playbooks | **Unclear** — buried under “Team” tab + secondary segments |
| Profile / settings | Clear — Profile tab; orange settings icon in header |

### Player portal architecture

- Gate: `components/portal/player-portal-shell-gate.tsx`
- Chrome: `components/portal/player-portal/player-portal-chrome.tsx`
- Film hub: `app/(free-portal)/player/[accountId]/prep/film/layout.tsx` → `player-portal-prep-shell.tsx`
- Routes: `/player/[accountId]`, `/prep/film`, `/prep/film/study`, `/prep/film/playbooks`, `/messages`, `/calendar`, `/profile`

### Load profile (player)

Per `page-api-load-map.md`:

1. `GET /api/dashboard/shell`
2. `GET /api/roster/me?teamId=`
3. Bootstrap light → deferred-core
4. `GET .../highlight-posts`

**Impact:** Home feed not complete until multiple gates clear — medium-high perceived latency.

---

## Parent portal

### Trustworthy and simple?

**Intent is trustworthy:**

- Calmer navy variant (`braikParentTheme` — “Parent keeps calmer navy dominance”).
- Athlete profile snapshot on light card — high readability for jersey, position, eligibility.
- Fewer tabs than coach; no sidebar clutter.
- Desktop (`lg+`) light header/nav — resembles consumer family apps.

**Trust risks:**

1. **Static demo posts** on home feed (game result, travel packet, film note) mixed with live announcements — parents may treat demos as real communications.
2. **No payments/dues UI** in parent portal components — families often expect fee status; may reduce trust if promised elsewhere.
3. **MessagingManager** reuse — full coach messaging UI in dark container may overwhelm non-technical parents.

### Easy to find key areas?

| Need | Findability | Location |
|------|-------------|----------|
| Schedule | Good | Calendar tab |
| Messages | Good | Messages tab |
| Player info / documents | **Confusing** | “Player” tab (profile + documents) |
| Reminders / own profile | **Confusing** | “Profile” tab (actually reminders) |
| Payments | **Missing** | Not in parent portal UI |
| Announcements | Good | Feed tab |

### Copied from coach portal?

**No — structurally distinct.**

- No Light Steel workspace or sidebar.
- Bottom-nav-only mobile pattern matches player, not coach.
- Unique desktop light shift at `lg` (parent only).
- Reuses **data components** (MessagingManager, bootstrap) but wraps in parent chrome — appropriate reuse, different shell.

**Overlap concern:** Messaging UI density feels coach-grade, not parent-simplified.

### Parent portal architecture

- Gate: `components/portal/parent-portal-shell-gate.tsx` (via layout)
- Chrome: `components/portal/parent-portal/parent-portal-chrome.tsx`
- Context: `parent-portal-context.tsx` — **`portal-context` API blocks children until resolved**
- Home: `parent-portal-home.tsx`
- Subpages: `parent-portal-calendar.tsx`, `parent-portal-messages.tsx`, `parent-portal-profile.tsx`, `parent-portal-documents.tsx`

### Load profile (parent)

1. `GET /api/dashboard/shell`
2. `GET /api/parent/portal-context?linkCode=` — **hard gate**
3. Bootstrap for team-scoped data

**Impact:** Entry feels slower than player; duplicate team resolution (shell + portal-context).

---

## Portal comparison matrix

| Dimension | Coach | Player | Parent |
|-----------|-------|--------|--------|
| Background | Light Steel | Navy gradient | Navy (mobile) / slate-50 (lg) |
| Primary accent in nav | Orange sidebar / blue mobile | Orange tabs | Orange tabs (slate on lg) |
| Information density | High | Low–medium | Low–medium |
| Desktop layout | Sidebar + main | Phone column | Phone column → light chrome at lg |
| Empty state strategy | Inline text | Mock feed fallback | Mock + live mix |
| Payments | Coach billing routes | N/A | Not surfaced |
| Film / study | Full modules | Unified Film hub | N/A |
| Messaging UI | Full 3-column | Simplified path | Full manager wrapper |
| Target “feel” | Command center | Team app | Family app |

---

## Portal-specific recommendations (design pass)

### Coach

1. Unify active nav color (orange OR blue) across sidebar and mobile tabs.
2. Map team banner gradient to `braikBrand.navy` scale.
3. Introduce shared coach empty-state component (pattern exists in AD portal).
4. Prioritize game-video N+1 and messages load reduction for “fast” feel.

### Player

1. Rename “Team” bottom tab to “Film” (or “Prep”).
2. Replace mock feed with honest empty state + coach CTA when no posts.
3. Align study/playbook panel navy with shell tokens.

### Parent

1. Rename tabs: e.g. “Athlete” + “Account” (or “My reminders”) instead of Player/Profile collision.
2. Remove or clearly label demo feed items.
3. Add payments/dues entry point if product includes collections.
4. Consider simplified messaging UI variant for parents (read-focused, fewer columns).

---

## Authentication paths (for re-audit)

| Portal | Entry URL | Test account (seeded) |
|--------|-----------|------------------------|
| Coach | `/login` → `/dashboard` | `coach@example.com` / `password123` |
| Player | `/enter-player-code` or login | `player1@example.com` / `password123` |
| Parent | `/parent/join` or login | `parent1@example.com` / `password123` |

Requires Supabase env + seeded database (`scripts/seed-users.ts` or `npm run seed:users`).

---

## Related audit artifacts

- `audit/visual-ux-audit.md` — Desktop page checklist
- `audit/mobile-ux-audit.md` — Mobile-specific findings
- `audit/visual-fix-priority-plan.md` — Prioritized fix backlog
- `audit/screenshots/` — Error-state captures (pending env fix)
- `audit/capture-screenshots.js` — Re-runnable screenshot script
