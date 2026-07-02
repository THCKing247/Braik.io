# Braik.io — Coach Testing Guide

**Last updated:** 2026-07-02  
**Status:** Beta testing prep

---

## Quick Start

1. Visit `https://braik.io` → redirected to `/login` automatically.
2. Sign in with your invited coach, player, or parent credentials.
3. You are routed to your role's portal automatically.

---

## Route Map

| URL | Behaviour |
|---|---|
| `/` | **Redirects to `/login`** (beta entry point) |
| `/landing` | Marketing homepage (preserved for reference) |
| `/login` | Login page. Authenticated users are routed by role. |
| `/login?callbackUrl=<path>` | Login then return to the requested path. |
| `/dashboard` | Coach / staff dashboard home |
| `/dashboard/org/:shortOrgId/team/:shortTeamId/...` | Canonical team-scoped coach routes |
| `/dashboard/ad` | Athletic director portal |
| `/org/:shortOrgId` | Org portal (AD / HC with org access) |
| `/player/:accountId` | Player portal home (feed) |
| `/parent/:linkCode` | Parent portal home (feed) |
| `/admin/overview` | Platform admin (internal only) |
| `/onboarding` | New HEAD_COACH setup (no team yet) |

---

## Auth Flow Rules

### Login routing decision chain

```
POST /api/auth/login
  → buildPasswordSessionSuccessPayload()
    → resolvePortalEntryPathWithProfileRole()   [async DB check, role + AD probe]
    → sets user.defaultAppPath

GET /login (or redirect to /login)
  → LoginPage verifies server session via GET /api/auth/session
  → resolvePostAuthDestination({ callbackUrl, defaultAppPath, role })
    → if callbackUrl is safe and not cross-portal → use it
    → else use defaultAppPath
    → else use getDefaultAppPathForRole(role)
```

### Cross-portal protection

`isCallbackUrlCrossPortal` blocks these callbackUrls:

| callbackUrl | Blocked for |
|---|---|
| `/onboarding`, `/onboarding/*` | All known roles |
| `/signup`, `/signup/*` | All known roles |
| `/login`, `/login/*` | All known roles |
| `/player/*` | Any non-player role |
| `/parent/*` | Any non-parent role |
| `/dashboard/coach/*`, `/dashboard/ad` | Players and parents |

### Role → destination table

| Role | Default destination |
|---|---|
| `head_coach` (with org/program) | `/org/:shortOrgId` or `/dashboard/ad` |
| `head_coach` (team only) | `/dashboard` (or canonical team URL) |
| `head_coach` (new, no team, no `team_id`) | `/onboarding` |
| `assistant_coach` | `/dashboard` |
| `athletic_director` | `/dashboard/ad` or org portal |
| `player` / `athlete` | `/player/:accountId` |
| `parent` | `/parent/:linkCode` |
| `admin` | `/admin/overview` |
| unknown role | `/dashboard` (safe fallback) |

### Infinite-redirect protection

| Scenario | Guard |
|---|---|
| Unauthenticated → `/dashboard` | Middleware → `/login?callbackUrl=/dashboard` |
| Authenticated → `/login` | Login page detects server session → redirects to `defaultAppPath` |
| `/onboarding` callbackUrl after login | `isCallbackUrlCrossPortal` blocks it → routes by role |
| Player lands in `/parent/*` | `isCallbackUrlCrossPortal` blocks it |
| Coach with stale `team_members` but valid `profiles.team_id` | `DashboardTeamShellGate` skips onboarding redirect when `user.teamId` is set |

---

## Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
NEXTAUTH_SECRET=        # (if applicable)
STRIPE_SECRET_KEY=      # optional — payments
OPENAI_API_KEY=         # optional — AI assistant
AWS_ACCESS_KEY_ID=      # optional — S3 file uploads
AWS_SECRET_ACCESS_KEY=  # optional — S3 file uploads
```

---

## Login Test Cases

- [ ] **Direct login, coach** — Visit `/login`, sign in as a HEAD_COACH → lands at `/dashboard` or canonical team URL. No loops.
- [ ] **Direct login, player** — Sign in as PLAYER → lands at `/player/:accountId`.
- [ ] **Direct login, parent** — Sign in as PARENT → lands at `/parent/:linkCode`.
- [ ] **Already authenticated visits `/`** — Visits root, immediately redirected to `/login`, then to their portal. No loop.
- [ ] **Already authenticated visits `/login`** — Already signed in, visits `/login` → immediately redirected by role, no re-render loop.
- [ ] **Protected route before login** — Visit `/dashboard/roster` while logged out → `/login?callbackUrl=/dashboard/roster` → after login → `/dashboard/roster`.
- [ ] **`callbackUrl=/onboarding` after login** — Existing coach at `/login?callbackUrl=/onboarding` → routed to coach dashboard, not onboarding.
- [ ] **Cross-portal callbackUrl** — Player arriving at `/login?callbackUrl=/parent/xxx` → player lands at `/player/:accountId`, not parent portal.
- [ ] **Invalid/external callbackUrl** — `/login?callbackUrl=//evil.com` → sanitized, routed by role.
- [ ] **Role lookup failure** — If `defaultAppPath` is missing from server response → `getDefaultAppPathForRole(role)` provides a safe fallback, user reaches their portal.
- [ ] **New HEAD_COACH (no team)** — No `profiles.team_id`, no `team_members` → `/onboarding`.
- [ ] **Logout** — Sign out → lands at `/login`. Visiting `/dashboard` redirects back to `/login`.

---

## Coach Tool Smoke Checklist

Sign in as a coach with an active team. Verify each tool:

### Dashboard Home (`/dashboard`)
- [ ] Renders without crash
- [ ] Team name / sport visible in sidebar and header
- [ ] Quick stats or feed visible
- [ ] Empty state shown if no data

### Roster (`/dashboard/roster`)
- [ ] Player list loads
- [ ] Search / filter works
- [ ] Clicking a player → player profile page renders
- [ ] Empty state if no players

### Calendar (`/dashboard/calendar`)
- [ ] Events render (games, practices)
- [ ] Month navigation works
- [ ] Empty state if no events

### Schedule (`/dashboard/schedule`)
- [ ] Game list renders
- [ ] Score entry / status update works
- [ ] Empty state if no games

### Messages (`/dashboard/messages`)
- [ ] Contacts list loads
- [ ] Opening a thread renders messages
- [ ] Sending a message succeeds (or shows error)
- [ ] Empty state if no threads

### Announcements (`/dashboard/announcements`)
- [ ] Announcement list loads
- [ ] Creating an announcement works (HEAD_COACH)
- [ ] Empty state if none

### Film Room / Game Video (`/dashboard/game-video`)
- [ ] Video library renders
- [ ] Upload flow opens (if configured)
- [ ] Empty state if no videos

### Playbooks (`/dashboard/playbooks`)
- [ ] Playbook list renders
- [ ] Creating/editing a play works
- [ ] Formations, plays, scripts, call sheets accessible
- [ ] Game Day and present mode load

### Study Guides (`/dashboard/study-guides`)
- [ ] Study guide list renders
- [ ] Creating a guide works
- [ ] Empty state if none

### Weight Room (`/dashboard/weight-room`)
- [ ] Renders without crash
- [ ] Workout log accessible
- [ ] Empty state if no data

### Inventory (`/dashboard/inventory`)
- [ ] Inventory list renders
- [ ] Add/edit item works
- [ ] Empty state if no items

### Health / Injury Report (`/dashboard/health`)
- [ ] Report list renders
- [ ] Adding a report works
- [ ] Empty state if none

### Stats (`/dashboard/stats`)
- [ ] Stats page renders
- [ ] Data shown or empty state
- [ ] No crash on zero data

### Finances (`/dashboard/fundraising`)
- [ ] Page renders
- [ ] Payment/fundraising items load
- [ ] Empty state if none

### Documents (`/dashboard/documents`)
- [ ] File list renders
- [ ] Upload triggers correctly
- [ ] Empty state if none

### AI Assistant (`/dashboard/ai-assistant`)
- [ ] Chat UI renders
- [ ] Sending a prompt returns a response (requires `OPENAI_API_KEY`)
- [ ] Graceful error if API key missing

### Settings (`/dashboard/settings`) — HEAD_COACH only
- [ ] Settings page renders
- [ ] Save changes works
- [ ] Non-HEAD_COACH users cannot access (403 or redirect)

### Subscription (`/dashboard/subscription`)
- [ ] Status renders
- [ ] No crash if not subscribed

---

## Player Portal Checklist

**Login flow:** Sign in as a PLAYER → routed to `/player/:accountId`.

### Shell gate
- [ ] Player reaches portal without loop
- [ ] Non-player role visiting `/player/:accountId` → redirected to their own portal

### Feed (`/player/:accountId`)
- [ ] Team hero section renders with team name and sport
- [ ] Real announcements from the backend appear (if any)
- [ ] Highlight posts appear (if any)
- [ ] Sample/mock feed cards are visible as placeholders when no real data
- [ ] Highlight composer renders (player can submit a highlight)
- [ ] "No team linked" empty state shows if player has no team assignment

### Calendar (`/player/:accountId/calendar`)
- [ ] Calendar renders
- [ ] Team events visible (if any)
- [ ] Empty state if no events

### Messages (`/player/:accountId/messages`)
- [ ] Thread list renders
- [ ] Opening a thread works
- [ ] Sending a message works or shows error
- [ ] Empty state if no threads

### Team / Film Hub (`/player/:accountId/prep/film`)
- [ ] Film hub renders with Study / Film / Playbooks segmented nav
- [ ] Legacy redirects work: `/player/:id/film-room` → `/prep/film`, `/study-guides` → `/prep/film/study`, `/playbooks` → `/prep/film/playbooks`

### Study (`/player/:accountId/prep/film/study`)
- [ ] Study guide list renders
- [ ] Opening a guide works
- [ ] Empty state if no guides assigned

### Playbooks (`/player/:accountId/prep/film/playbooks`)
- [ ] Playbook list renders
- [ ] Opening a playbook works
- [ ] Empty state if none

### Reminders (`/player/:accountId/reminders`)
- [ ] Reminders load from `/api/notifications`
- [ ] "All caught up" empty state when none

### Profile (`/player/:accountId/profile`)
- [ ] Athlete snapshot (name, jersey, position, grade) renders
- [ ] Loading spinner while fetching
- [ ] `—` placeholders when fields missing
- [ ] Documents section renders (empty state if none)

### Announcements (`/player/:accountId/announcements`)
- [ ] Announcement list renders
- [ ] Empty state if none
- [ ] Player cannot create announcements (`canCreate={false}`)

### Permission enforcement
- [ ] Player cannot access coach dashboard routes
- [ ] Player cannot access parent portal routes

---

## Parent Portal Checklist

**Login flow:** Sign in as a PARENT → routed to `/parent/:linkCode`.

### Shell gate
- [ ] Parent reaches portal without loop
- [ ] Non-parent role visiting `/parent/:linkCode` → redirected to their own portal

### Context loading
- [ ] `/api/parent/portal-context?linkCode=:code` returns linked player info
- [ ] Error state shown if link is invalid: "Family portal unavailable"
- [ ] "No team context for this link" shown if team resolution fails

### Feed (`/parent/:linkCode`)
- [ ] Team name and linked athlete name visible
- [ ] Real announcements from backend appear (if any)
- [ ] Static sample cards visible as placeholders
- [ ] "Next game" banner renders (placeholder data until real schedule integrated)
- [ ] Nav links (Details, React, Reply) render correctly

### Calendar (`/parent/:linkCode/calendar`)
- [ ] Calendar renders
- [ ] Team events visible (if any)
- [ ] Empty state if no events

### Messages (`/parent/:linkCode/messages`)
- [ ] Thread list renders
- [ ] Opening a thread works
- [ ] Sending a message works or shows error
- [ ] Empty state if no threads

### Reminders (`/parent/:linkCode/reminders`)
- [ ] Reminders render or empty state shown

### Profile (`/parent/:linkCode/profile`)
- [ ] Linked athlete roster info renders
- [ ] Empty state if no data

### Announcements (`/parent/:linkCode/announcements`)
- [ ] Announcement list renders
- [ ] Empty state if none

### Permission enforcement
- [ ] Parent cannot access coach dashboard
- [ ] Parent cannot access player portal of other players
- [ ] Coach-only tools not exposed

---

## Known Limitations & Blockers

| Area | Status | Notes |
|---|---|---|
| Root `/` | ✅ Fixed | Redirects to `/login` for beta |
| Login routing loop | ✅ Fixed | `isCallbackUrlCrossPortal` blocks `/onboarding`, cross-portal urls |
| Existing coach → onboarding bug | ✅ Fixed | `DashboardTeamShellGate` checks `user.teamId` in addition to `teams.length` |
| Player portal feed | ⚠️ Partial | Mix of real data (announcements, highlights) + mock sample cards |
| Parent portal feed | ⚠️ Partial | Mix of real announcements + static placeholder cards (game result, travel note) |
| Parent "Next game" card | ⚠️ Placeholder | Hardcoded "Friday · 7:00 PM · vs Central Eagles" — not from schedule API yet |
| Parent profile page | ⚠️ Check | Links to athlete roster profile; full build-out pending |
| Film Room | ⚠️ Check | Video upload requires S3 / AWS env vars |
| AI Assistant | ⚠️ Check | Requires `OPENAI_API_KEY` |
| Stripe payments | ⚠️ Check | Requires `STRIPE_SECRET_KEY` |
| Player `playerId` fetch | ℹ️ Note | `GET /api/roster/me?teamId=:id` — player must be on roster for docs/messages |
| Coaches with no `team_members` but valid `profiles.team_id` | ✅ Fixed | Shell gate sends to dashboard empty state, not onboarding |
| Unknown role fallback | ✅ Safe | Routes to `/dashboard` with no trap |

---

## Running Tests

```bash
# TypeScript check (required before deploy)
npm run typecheck

# ESLint
npm run lint

# Playbook logic tests
npm run test:playbook

# Braik AI domain tests
npm run test:braik-ai

# Messaging thread validation
npm run test:release-guards

# Games scoring
npm run test:games-scoring
```

---

## Restoring the Public Homepage

When beta testing is complete, revert `app/(marketing)/page.tsx` from:

```ts
import { redirect } from "next/navigation"
export default function Home() { redirect("/login") }
```

Back to the original marketing page content (currently preserved at `app/(marketing)/landing/page.tsx`). Then delete `app/(marketing)/landing/page.tsx`.
