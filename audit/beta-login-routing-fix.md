# Beta Login Routing Fix

**Date:** 2026-06-22  
**Branch:** main  
**Commit message:** fix: route existing coaches to dashboard after login

---

## Bug Summary

An existing HEAD_COACH user logs in successfully but is routed to the new-user onboarding wizard (`/onboarding`) instead of their coach dashboard.

---

## Root Cause

Two separate code paths converge on the same wrong outcome.

### Path 1 — callbackUrl bypasses role-based routing (primary)

1. Coach visits `/onboarding` while logged out.
2. `components/portal/onboarding-page-client.tsx` pushes them to `/login?callbackUrl=/onboarding`.
3. Coach logs in via `HeroLoginForm` or the session-recovery effect in `LoginPage`.
4. `resolvePostAuthDestination` is called. It evaluates the callbackUrl first and, because `/onboarding` is not blocked in `isCallbackUrlCrossPortal`, returns `"/onboarding"` — overriding the server-resolved `/dashboard/coach`.

**Condition that failed:**
```ts
// isCallbackUrlCrossPortal did NOT block /onboarding
isCallbackUrlCrossPortal("/onboarding", "HEAD_COACH") === false  // wrong
```

The function only blocked portal-role mismatch paths (`/parent/…`, `/player/…`, `/dashboard/coach` for players/parents). It had no rule to block auth/setup flow paths for coaches.

### Path 2 — DashboardTeamShellGate redirects coaches with no resolved teams (secondary)

Even if the coach lands on `/dashboard/coach`, the shell gate can redirect them:

```ts
// components/portal/dashboard-team-shell-gate.tsx
if (
  payload.teams.length === 0 &&
  layoutUserRole === "HEAD_COACH" &&
  !payload.user.isPlatformOwner &&
  payload.portalKind !== "recruiter"
) {
  router.replace("/onboarding")
}
```

A coach whose `team_members.active` rows are missing (e.g., membership rows are stale or inactive) but who has a valid `profiles.team_id` would return `teams = []` from the shell and be incorrectly sent to onboarding. The original condition had no way to distinguish a truly new coach (no team history) from an existing one (has `profiles.team_id` but teams couldn't be resolved).

---

## Files Changed

| File | What changed |
|---|---|
| `lib/auth/post-auth-entry-path.ts` | `isCallbackUrlCrossPortal` now blocks `/onboarding`, `/onboarding/*`, `/signup`, `/signup/*`, `/login`, `/login/*` for any authenticated role |
| `components/portal/dashboard-team-shell-gate.tsx` | `/onboarding` redirect now requires BOTH `teams.length === 0` AND `!user.teamId`; same guard added to the render-time skeleton fallback |

---

## Before Behavior

| Scenario | Route |
|---|---|
| Existing HEAD_COACH logs in (direct `/login`) | ✅ `/dashboard/coach` |
| Existing HEAD_COACH at `/login?callbackUrl=/onboarding` | ❌ `/onboarding` (BUG) |
| Existing HEAD_COACH with stale team_members (has `profiles.team_id`) | ❌ `/onboarding` (BUG) |
| New HEAD_COACH (no team_id, no memberships) | ✅ `/onboarding` |
| PLAYER logs in | ✅ `/player/:accountId` |
| PARENT logs in | ✅ `/parent/:linkSegment` |

---

## After Behavior

| Scenario | Route |
|---|---|
| Existing HEAD_COACH logs in (direct `/login`) | ✅ `/dashboard/coach` |
| Existing HEAD_COACH at `/login?callbackUrl=/onboarding` | ✅ `/dashboard/coach` (fixed) |
| Existing HEAD_COACH with stale team_members (has `profiles.team_id`) | ✅ Coach dashboard empty state (fixed) |
| New HEAD_COACH (no team_id, no memberships) | ✅ `/onboarding` |
| PLAYER logs in | ✅ `/player/:accountId` |
| PARENT logs in | ✅ `/parent/:linkSegment` |

---

## Role Routing Table (post-fix)

| Role | Post-login destination |
|---|---|
| `HEAD_COACH` (with org/program) | `/org/:shortOrgId` or `/dashboard/ad` |
| `HEAD_COACH` (team only, no org) | `/dashboard/coach` |
| `HEAD_COACH` (new, no team) | `/onboarding` |
| `ASSISTANT_COACH` | `/dashboard/coach` |
| `ATHLETIC_DIRECTOR` | `/dashboard/ad` or org portal |
| `PLAYER` | `/player/:accountId` |
| `PARENT` | `/parent/:linkSegment` |
| `admin` | `/admin/overview` |

---

## Fix Details

### `lib/auth/post-auth-entry-path.ts`

Added to `isCallbackUrlCrossPortal` (before portal-role checks):

```ts
// Auth/setup flow pages (e.g. /onboarding, /signup/*) redirect unauthenticated visitors to
// /login?callbackUrl=<themselves>. Honoring that callbackUrl after login would send an
// existing HEAD_COACH into the new-user setup wizard. Block these for any known role.
if (
  cb === "/onboarding" ||
  cb.startsWith("/onboarding/") ||
  cb === "/signup" ||
  cb.startsWith("/signup/") ||
  cb === "/login" ||
  cb.startsWith("/login/")
) {
  return true
}
```

This runs only when `role` is non-null (the function already early-returns `false` when role is absent, preserving backward-compat for legacy callers).

### `components/portal/dashboard-team-shell-gate.tsx`

Added `!payload.user.teamId` (and `!user.teamId`) guard to both the `useEffect` redirect and the render-time skeleton gate:

```ts
// Only redirect a HEAD_COACH to onboarding when they have no teams AND no profile team_id.
// A non-null teamId means they have a historical team association (even if the shell
// couldn't resolve it), so they are an existing coach — not a brand-new user.
if (
  payload.teams.length === 0 &&
  !payload.user.teamId &&          // ← added
  layoutUserRole === "HEAD_COACH" &&
  !payload.user.isPlatformOwner &&
  payload.portalKind !== "recruiter"
) {
  router.replace("/onboarding")
}
```

`payload.user.teamId` comes from `profiles.team_id` (loaded by `getRequestUserLite` → `buildSessionUserLite`). A truly new coach who has never been assigned to a team will have `teamId = undefined`, so the onboarding redirect still fires for them. An existing coach with a valid profile team ID (even if the shell can't resolve the team list) is not sent to onboarding.

---

## Validation

- `npm run typecheck` → passed, no errors
- No lint errors in modified files
- No RLS/schema/migration changes
- No visual UI changes

---

## Manual Test Checklist

- [ ] Existing HEAD_COACH logs in at `/login` (no callbackUrl) → lands at coach dashboard
- [ ] Existing HEAD_COACH navigates to `/onboarding` while logged out, then logs in → lands at coach dashboard (not `/onboarding`)
- [ ] Existing HEAD_COACH with `profiles.team_id` set but no active `team_members` rows → lands at coach dashboard (empty teams state), not `/onboarding`
- [ ] New HEAD_COACH (just signed up, `profiles.team_id = null`, no team_members) → lands at `/onboarding`
- [ ] PLAYER logs in → `/player/:accountId`
- [ ] PARENT logs in → `/parent/:linkSegment`
- [ ] Admin logs in → `/admin/overview`
- [ ] Unauthenticated visit to `/dashboard/coach` → redirected to `/login?callbackUrl=/dashboard/coach` → after login → `/dashboard/coach`
- [ ] Invalid callbackUrl (e.g. `//evil.com`) → sanitized, routes by role

---

## Remaining Risks

- **Coaches with no `profiles.team_id` AND no `team_members`**: If an existing coach somehow has `profiles.team_id = null` and no active team memberships AND their team is not findable via `head_coach_user_id` or `created_by`, they will still be redirected to `/onboarding`. This is a DB data integrity issue, not a routing bug, and would need to be fixed by correcting the profile data.
- **`/signup/player` for coaches**: Coaches cannot access the player signup flow; this was already blocked (callbackUrl `/signup/*` now rejected for all roles including players who happen to be coaches).
- **Session timing race**: The `DashboardTeamShellGate` fires on initial shell load. If the shell query is slow, the user may briefly see a loading skeleton before the correct dashboard renders.
