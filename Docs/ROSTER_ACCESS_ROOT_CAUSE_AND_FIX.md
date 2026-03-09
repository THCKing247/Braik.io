# Roster access root cause and fix

## Part 1: Root cause analysis

### Symptom

- Roster API returns: `"Access denied: Not a member of this team"` (403).
- Request `teamId` and session user are valid; dashboard still loads because it falls back to `session.user.teamId` / `profiles.team_id`.
- Result: **inconsistent state** — profile/session say the user has a team, but `team_members` has no active row, so RBAC denies roster access.

### How `profiles.team_id` gets set

| Flow | Where | How `profiles.team_id` is set |
|------|--------|--------------------------------|
| **Onboarding** | `app/api/onboarding/route.ts` | After creating team and inserting `team_members`, profile is updated with `team_id: team.id`. |
| **Team join** | `app/api/team/join/route.ts` | Profile is updated with `team_id: teamId` before/alongside `team_members` upsert. |
| **Signup (secure)** | `app/api/auth/signup-secure/route.ts` | Profile upsert includes `team_id: teamId` when user signed up with a team/code. |
| **Signup (legacy)** | `app/api/auth/signup/route.ts` | Profile upsert includes `team_id: teamId` when invite/program code was used. |
| **Login** | `app/api/auth/login/route.ts` | Profile can be upserted from metadata with `team_id: metadata.teamId ?? profile?.team_id`. |

### How `team_members` gets inserted

| Flow | Where | How `team_members` is written |
|------|--------|-------------------------------|
| **Onboarding** | `app/api/onboarding/route.ts` | Insert after team create; 500 on error. **Correct.** |
| **Team join** | `app/api/team/join/route.ts` | Upsert after profile update; **previously** only logged on error, did not return 500. |
| **Signup (secure)** | `app/api/auth/signup-secure/route.ts` | Insert **after** profile upsert but **before** `public.users` upsert. **Bug:** `team_members.user_id` FK references `public.users(id)`; insert could fail and was treated as non-fatal. |
| **Signup (legacy)** | `app/api/auth/signup/route.ts` | **No** `team_members` insert at all. |

### Where the insert can fail or be skipped

1. **Signup-secure**  
   - `team_members` insert ran before `public.users` upsert.  
   - If the user was not yet in `public.users`, the insert failed with FK violation.  
   - Failure was only logged (`console.error("Warning: team_members insert failed")`), so signup still returned success and profile had `team_id` set.

2. **Signup (legacy)**  
   - No `team_members` insert; only profile was written with `team_id`.  
   - Any user who signed up via this route and had a team ended up with `profiles.team_id` set and no `team_members` row.

3. **Team join**  
   - On `team_members` upsert failure, the handler only logged and did not return 500.  
   - Client received success while profile was updated and membership might be missing.

### Where the dashboard hides the problem

- **`app/(portal)/dashboard/layout.tsx`**  
  - Loads teams from `team_members` first.  
  - If no rows: fallback to `session.user.teamId`, then to `profiles.team_id`.  
  - So the dashboard can show a team and render even when there is no active `team_members` row.  
  - Roster (and any API using `requireTeamAccess`) still checks `team_members`, so the user gets 403 there.

### RBAC and repair

- **`lib/auth/rbac.ts`**  
  - `getUserMembership(teamId)` reads `team_members` (active).  
  - If none, it has a **repair path**: reactivate inactive row, or if no row, insert when `profile.team_id === teamId` or user is team creator.  
  - Repair insert could still fail if `public.users` had no row for the user (same FK).  
  - So repair was not guaranteed to fix the state when `public.users` was missing.

---

## Part 2: Fixes implemented

### 1. Onboarding / signup / join always create or upsert `team_members`

- **Onboarding:** Already inserted `team_members` and returned 500 on error; added explicit error handling for profile update and rollback on profile update failure.  
- **Signup-secure:**  
  - Moved `public.users` upsert **before** `team_members` insert.  
  - Treat `team_members` insert failure as **fatal**: return 500 with a clear message instead of logging and continuing.  
- **Signup (legacy):**  
  - When `teamId` is set, ensure `public.users` exists, then **insert** `team_members`.  
  - Return 500 on insert failure (no auth user deletion; user can retry or contact support).  
- **Team join:**  
  - Ensure `public.users` exists before `team_members` upsert.  
  - On `team_members` upsert failure, **return 500** instead of only logging.

### 2. No silent ignore of required membership insert/upsert

- Signup-secure: throw/return 500 with message when `team_members` insert fails.  
- Team join: return 500 when `team_members` upsert fails.  
- Legacy signup: return 500 when `team_members` insert fails (when `teamId` is set).  
- Onboarding: return 500 and roll back team + membership when profile update fails.

### 3. Membership-repair safeguard

- **RBAC (`lib/auth/rbac.ts`):**  
  - In the repair path (when there is no active `team_members` row but profile or team creator indicates membership), **ensure the user exists in `public.users`** (upsert) before inserting into `team_members`.  
  - So when an API (e.g. roster) calls `requireTeamAccess` → `getUserMembership`, the repair can succeed even for users who were left in a broken state earlier.  
- **Dashboard layout:**  
  - When the layout used the **profile fallback** (no `team_members` rows, so it used `session.user.teamId` or `profiles.team_id`), it now calls `getUserMembership(teamIds[0])` to trigger the same repair.  
  - That creates or reactivates the `team_members` row so subsequent roster (and other) API calls succeed.

### 4. Keeping profile, session, and `team_members` in sync

- All flows that set `profiles.team_id` now ensure a corresponding `team_members` row (insert/upsert) and treat failures as fatal where membership is required.  
- Onboarding now fails and rolls back if profile update fails, so we don’t leave `team_members` without `profiles.team_id`.

### 5. Better error handling for the UI

- Roster GET/POST 403 responses now return a structured body, e.g.:  
  - `error`: Short user-facing message.  
  - `code`: `"TEAM_ACCESS_DENIED"`.  
  - `hint`: Suggests refreshing, re-sign-in, or asking the coach to re-send the invite.  
- This allows the UI to show an actionable message instead of a generic 403.

---

## Part 3: Roster-specific behavior

- **Enforcement:** Roster still uses `requireTeamAccess(teamId)` (GET) and `requireTeamPermission(teamId, "edit_roster")` (POST). Membership is still enforced via `team_members`.  
- **Coach flows:**  
  - **Onboarding:** Already created `team_members` with HEAD_COACH; now profile update is required and rollback on failure.  
  - **Team join:** Upsert failure now returns 500; `public.users` is ensured before upsert so FK is satisfied.  
- **Repair:** For users who already had `profiles.team_id` but no `team_members` row, the next roster call (or dashboard load with fallback) runs `getUserMembership`, which ensures `public.users` and then inserts or reactivates `team_members`, so head/assistant coaches can GET and POST `/api/roster` after repair.

---

## Part 4: Deliverables

### Root cause summary

- **Primary:** Signup-secure inserted `team_members` before upserting `public.users`, so the insert often failed (FK) and was treated as non-fatal; profile still had `team_id`.  
- **Secondary:** Legacy signup never inserted `team_members`. Team join did not return 500 on upsert failure.  
- **Visibility:** Dashboard fallback to `session.user.teamId` / `profiles.team_id` let the app look normal while APIs that check `team_members` (e.g. roster) returned 403.

### Files changed

| File | Changes |
|------|--------|
| `lib/auth/rbac.ts` | In repair path, upsert `public.users` before inserting `team_members`; import `profileRoleToUserRole`. |
| `app/api/auth/signup-secure/route.ts` | Move `public.users` upsert before `team_members` insert; treat `team_members` insert failure as fatal (return 500). |
| `app/api/auth/signup/route.ts` | When `teamId` is set: ensure `public.users`, insert `team_members`, return 500 on insert failure. |
| `app/api/team/join/route.ts` | Ensure `public.users` before `team_members` upsert; return 500 on upsert failure; use `profileRoleToUserRole` for users.role. |
| `app/api/onboarding/route.ts` | Require profile update to succeed; on failure, delete membership and team and return 500. |
| `app/(portal)/dashboard/layout.tsx` | When using profile fallback for `teamIds`, call `getUserMembership(teamIds[0])` to trigger repair. |
| `app/api/roster/route.ts` | Return 403 body with `error`, `code: "TEAM_ACCESS_DENIED"`, and `hint` for GET and POST. |

### SQL / migration

- **New migration:** `supabase/migrations/20260309120000_repair_team_members_from_profiles.sql`  
  - One-time repair: for users with `profiles.team_id` set and a matching `teams` row and an existing `public.users` row, insert missing active `team_members` rows (or set existing inactive row to active via `ON CONFLICT (team_id, user_id) DO UPDATE SET active = true, role = EXCLUDED.role`).  
  - Only affects profiles that have a corresponding `public.users` row (FK). Users without `public.users` are repaired on next request by app code (RBAC repair path).

### Manual data repair for existing broken users

1. **Apply migration:** Run the new migration so all users with `profiles.team_id` and a `public.users` row get an active `team_members` row.  
2. **Users not in `public.users`:** They will be repaired on next dashboard load or next API call that uses `getUserMembership` (e.g. roster), which now upserts `public.users` before inserting `team_members`.  
3. **Optional one-off backfill of `public.users`:** If you have many auth users without `public.users` rows, you can run a one-time insert from `auth.users` / `profiles` into `public.users` (with safe defaults for role/status). The migration only inserts `team_members` where `public.users.id` exists, so backfilling `public.users` first allows the migration to repair more users in one go.

### Test checklist

- [ ] **New head coach onboarding**  
  - Complete onboarding with a new head coach account.  
  - Confirm `profiles.team_id` and an active `team_members` row with HEAD_COACH.  
  - Open dashboard, then roster; GET and POST roster succeed.

- [ ] **Joining a team by code**  
  - As a new user (or user without a team), join via team invite code (or player invite code).  
  - Confirm profile and `team_members` both updated; no 403 on roster for that team (if role allows).

- [ ] **Dashboard load**  
  - As a user with a team, load dashboard; teams come from `team_members`.  
  - As a user with only `profiles.team_id` (simulated broken state before migration), load dashboard; fallback runs and repair creates `team_members`; next roster call succeeds.

- [ ] **Roster GET**  
  - As head/assistant coach with valid membership, GET `/api/roster?teamId=...` returns 200.  
  - As user without membership, GET returns 403 with body containing `code: "TEAM_ACCESS_DENIED"` and `hint`.

- [ ] **Roster POST**  
  - As head/assistant coach, POST to add a player returns 200.  
  - Without permission or membership, POST returns 403 with actionable body.

- [ ] **Broken existing user (profile.team_id, no team_members)**  
  - Create or use a user with `profiles.team_id` set and no active `team_members` row (and in `public.users` if testing migration).  
  - Run migration; confirm active `team_members` row exists.  
  - Or skip migration: load dashboard (fallback + repair) or call roster; confirm repair creates row and roster then succeeds.
