# Beta Login Routing Plan

**Date:** 2026-06-22  
**Branch objective:** Harden `/login` as the single application entry point for Beta.

---

## Overview

`/login` is the reliable Beta entry route for all application users: coaches, players, and parents. After authentication, users route to the correct portal based on their role and account context. This document covers the intended behavior, a before/after comparison, the role destination map, files changed, and validation results.

---

## Role Destination Map

| Role | Primary Portal Path | Fallback Path |
|------|-------------------|---------------|
| `HEAD_COACH` / `ASSISTANT_COACH` | `/dashboard/org/:shortOrgId/team/:shortTeamId` | `/dashboard/coach` |
| `ATHLETIC_DIRECTOR` | `/org/:shortOrgId` | `/dashboard/ad` |
| `PLAYER` / `ATHLETE` | `/player/:accountId` | `/dashboard/player` |
| `PARENT` | `/parent/:linkSegment` | `/dashboard/parent` |
| `ADMIN` | `/admin/overview` | `/admin/overview` |

The `defaultAppPath` on the session user is resolved server-side via `resolvePortalEntryPath` / `resolvePortalEntryPathWithProfileRole` at login time. It performs one DB pass to find the user's org, team, or account segment and builds the canonical deep path. The role-based fallback in `getDefaultAppPathForRole` fires only when that server resolution fails (offline, test, cache miss).

---

## Before Behavior

### Cross-portal callbackUrl contamination

**Trigger path:**
1. User visits `/enter-player-code`
2. `app/(auth)/enter-player-code/page.tsx` calls `redirect("/parent/join")` (alias redirect)
3. Middleware intercepts unauthenticated access to `/parent/*` and sets `callbackUrl=/parent/join`
4. User lands at `/login?callbackUrl=/parent/join`
5. User logs in as **PLAYER**
6. `resolvePostAuthDestination({ callbackUrl: '/parent/join', defaultAppPath: '/player/abc123', role: 'PLAYER' })` returned `/parent/join` — **wrong portal**

**Root cause:** `resolvePostAuthDestination` treated any safe internal callbackUrl as valid regardless of whether it matched the authenticated user's portal.

### Authenticated users not redirected from /login

If a user navigated directly to `/login` while already authenticated (no `callbackUrl` set by middleware), the page showed the login form but never redirected them to their portal. The `verifyServerSession` effect only redirected when `hasAuthRedirectTarget` was true (i.e., a callbackUrl was present).

### No Beta context

The `/login` page had no indication that the product is in Beta, which could confuse invited users who expect a polished product.

---

## After Behavior

### Cross-portal callbackUrl guard

`isCallbackUrlCrossPortal(callbackUrl, role)` is now exported from `lib/auth/post-auth-entry-path.ts`. It checks:

- `/parent` or `/parent/*` paths → only safe for `PARENT` role
- `/dashboard/parent*` paths → only safe for `PARENT` role
- `/player` or `/player/*` paths → only safe for `PLAYER` / `ATHLETE` roles
- `/dashboard/player*` paths → only safe for `PLAYER` / `ATHLETE` roles
- `/dashboard/coach*`, `/dashboard/org/*`, `/dashboard/ad*` → NOT safe for `PLAYER` or `PARENT` roles
- All other paths → considered safe (generic `/dashboard`, public routes, etc.)

`resolvePostAuthDestination` now calls this guard before accepting any callbackUrl. If the callbackUrl is cross-portal for the authenticated role, it falls through to `redirectTo` → `defaultAppPath` → `getDefaultAppPathForRole(role)`.

**Fixed path for the known bug:**
1. User visits `/enter-player-code` → server redirects to `/parent/join`
2. Middleware: `/parent/join` unauthenticated → `/login?callbackUrl=/parent/join`
3. User logs in as PLAYER
4. `resolvePostAuthDestination({ callbackUrl: '/parent/join', defaultAppPath: '/player/abc123', role: 'PLAYER' })` → **skips `/parent/join` (cross-portal), returns `/player/abc123`** ✓

### Authenticated users redirected from /login

The `verifyServerSession` effect in `app/(auth)/login/page.tsx` now redirects authenticated users to their portal even when there is no `callbackUrl`. The callbackUrl is only passed when `hasAuthRedirectTarget` is true; otherwise `resolvePostAuthDestination` uses `defaultAppPath` and `role` to select the destination.

### Beta notice

Minimal Beta notice added to both login surfaces:

**Desktop (`app/(auth)/login/page.tsx`):** Subtle bordered notice block between the forgot-password link and the privacy/terms footer.

> **Braik Beta** — Access is for invited coaches, players, and parents. This version is being tested to improve program operations and collect feedback before final release.

**Mobile (`components/auth/mobile-app-login-screen.tsx`):** Short one-liner in the footer above the Privacy/Terms/FAQ links.

> **Braik Beta** — For invited coaches, players, and parents. This version is being tested before final release.

No layout, color, font, or structural changes were made to either login surface.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/auth/post-auth-entry-path.ts` | Added `isCallbackUrlCrossPortal()` guard; updated `resolvePostAuthDestination` to skip cross-portal callbackUrls when role is known |
| `app/(auth)/login/page.tsx` | Fixed `verifyServerSession` to redirect authenticated users even when no callbackUrl; added Beta notice block |
| `components/auth/mobile-app-login-screen.tsx` | Added Beta notice paragraph in footer |

### Files NOT changed

- `middleware.ts` — no changes needed; middleware correctly guards portals and sets callbackUrl
- `lib/auth/server-auth.ts` — server session and `defaultAppPath` resolution unchanged
- `lib/auth/portal-entry-path.ts` — portal entry resolution unchanged
- `lib/portal/resolve-default-app-path-for-user.ts` — unchanged
- `lib/portal/dashboard-path.ts` — unchanged
- `app/api/auth/session/route.ts` — unchanged
- All RLS policies, DB schema, migrations — untouched

---

## Middleware Auth Flow (Unchanged)

Protected route prefixes: `/dashboard`, `/admin`, `/org`, `/player`, `/parent`

```
Unauthenticated → /login?callbackUrl=<original-path>
Authenticated   → pass through to requested route
```

Cookie used: `sb-access-token` (presence check at edge; JWT validation in Node routes).

---

## Performance Considerations

- No new blocking API calls added to `/login`
- No new Supabase client created
- No new DB queries — `isCallbackUrlCrossPortal` is a pure string check with no network
- The `/api/auth/session` call in `verifyServerSession` was already present; it now triggers a redirect for previously-authed users rather than doing nothing (a net improvement)
- `resolvePostAuthDestination` remains synchronous

---

## Validation Results

### TypeScript
```
npm run typecheck → exit 0 (no errors)
```

### Route behavior matrix

| Scenario | Before | After |
|----------|--------|-------|
| Player visits `/enter-player-code` → lands at `/login?callbackUrl=/parent/join`, logs in | Sent to `/parent/join` (wrong) | Sent to `/player/:accountId` (correct) |
| Player logs in with no callbackUrl | Stays on `/login` | Redirected to `/player/:accountId` |
| Parent logs in with `callbackUrl=/parent/join` | Sent to `/parent/join` | Sent to `/parent/join` (correct, unchanged) |
| Coach logs in with `callbackUrl=/dashboard/org/foo/team/bar` | Sent to `/dashboard/org/foo/team/bar` | Sent to `/dashboard/org/foo/team/bar` (correct, unchanged) |
| Player logs in with `callbackUrl=/dashboard/coach` | Sent to `/dashboard/coach` (wrong) | Sent to `/player/:accountId` (correct) |
| Parent logs in with `callbackUrl=/player/abc` | Sent to `/player/abc` (wrong) | Sent to `/parent/:linkSegment` (correct) |
| Authenticated user visits `/login` directly | Stays on `/login` | Redirected to their portal |
| Unauthenticated user visits `/login` | Shows login form | Shows login form (unchanged) |
| Invalid callbackUrl (`//evil.com/…`) | Rejected by `normalizeCallbackUrl` | Rejected by `normalizeCallbackUrl` (unchanged) |

---

## Remaining Portal Risks

1. **`/enter-player-code` alias** — still redirects to `/parent/join`. This is intentional (parent join-code flow). The cross-portal guard in `resolvePostAuthDestination` now prevents players from being routed there accidentally. However, consider whether `/enter-player-code` should instead redirect to `/signup/player` to be fully unambiguous.

2. **Player/parent accounts without roster linkage** — `resolvePortalHomeForUser` falls back to `/dashboard/player` and `/dashboard/parent` when no `playerAccountSegment` / `parentPortalSegment` exists. This is the correct legacy dashboard fallback and is expected for incomplete onboarding.

3. **callbackUrl sanitization depth** — `normalizeCallbackUrl` rejects non-internal paths but does not exhaustively block every privileged sub-route (e.g., `/admin/overview` for a non-admin user). The admin portal has its own session check; this is an accepted risk for Beta.

4. **Stale client session cleanup** — The existing cleanup path (`supabaseClient.auth.signOut()` + `POST /api/auth/logout`) in the login page effect fires when the client thinks it's authenticated but the server says the session is invalid. This behavior is unchanged and correct.
