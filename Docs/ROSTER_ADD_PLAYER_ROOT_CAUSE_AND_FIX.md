# Roster Add-Player: Root Cause and Fix

## Part 1: Root Cause Report

### Why adding a player could fail

1. **403 Forbidden (most likely)**  
   - `requireTeamPermission(teamId, "edit_roster")` in `app/api/roster/route.ts` loads membership from `team_members` for the current user and team.  
   - If the coach has no row in `team_members` for that `teamId`, or their `role` is not normalized to `HEAD_COACH` or `ASSISTANT_COACH`, the check throws and the API returns 403.  
   - **Typical case:** Profile has `team_id` set (e.g. from signup) but `team_members` was never inserted (e.g. signup failed partway, or legacy data).  
   - **Files:** `lib/auth/rbac.ts` (`getUserMembership` → `requireTeamPermission`), `lib/auth/roles.ts` (`canEditRoster`). Role from DB is normalized with `rawRole.toUpperCase().replace(/[\s-]/g, "_")`, so `head_coach` → `HEAD_COACH`.

2. **400 Bad Request**  
   - Missing `teamId` in the request body, or missing `firstName` / `lastName`.  
   - **File:** `app/api/roster/route.ts` (POST body validation).

3. **500 Server Error**  
   - Supabase insert error: e.g. missing table `public.players`, missing columns, or FK violation (invalid `team_id`).  
   - **Schema:** `public.players` is created in `supabase/migrations/20260309000000_players_documents_inventory.sql`. Columns used by POST: `team_id`, `first_name`, `last_name`, `grade`, `jersey_number`, `position_group`, `notes`, `status`.  
   - The API uses `getSupabaseServer()` (service role), so RLS is bypassed; failure would be from schema/constraints, not RLS.

4. **Schema/flow mismatches (addressed in this fix)**  
   - `invites` table in migrations had `token` but no `code`, `uses`, or `max_uses`. Signup and team-join routes use `invites.code` and `invites.uses` / `max_uses`. If those columns were missing, invite-by-code flows would fail.  
   - **Fix:** Migration `20260309100000_players_onboarding_invites.sql` adds `invites.code`, `invites.uses`, `invites.max_uses`.  
   - `teams` table: some code paths insert `invite_code`; migration adds `teams.invite_code` if not present.

### Exact files involved

| Area              | File(s) |
|-------------------|--------|
| Roster API        | `app/api/roster/route.ts` |
| Roster UI         | `app/(portal)/dashboard/roster/page.tsx`, `components/portal/roster-manager-enhanced.tsx` |
| RBAC              | `lib/auth/rbac.ts`, `lib/auth/roles.ts` |
| Session           | `lib/auth/server-auth.ts` (session from Supabase Auth; `teamId` from `profiles.team_id`) |
| Players schema    | `supabase/migrations/20260309000000_players_documents_inventory.sql` |
| Invites/teams     | `supabase/migrations/20260303000000_profiles_and_auth_sync.sql`, `20260308100000_ad_teams_and_invites.sql` |

### Required fixes applied

- **Roster POST:**  
  - Use `created_by` (session user id), optional `email`, and `invite_status: 'not_invited'`.  
  - Duplicate check: same team + (same first+last name + same jersey, or same first+last with no jersey, or same email).  
  - Clearer 403/409/500 responses with messages.
- **Schema:**  
  - New migration adds `players.email`, `players.invite_code`, `players.invite_status`, `players.claimed_at`, `players.created_by`; and `invites.code`, `invites.uses`, `invites.max_uses`; and `teams.invite_code` if missing.
- **Invite/join:**  
  - Signup and team-join first look up by `players.invite_code`; if an unclaimed player is found, link `user_id` and set `claimed_at` / `invite_status = 'joined'` instead of creating a new player.

---

## Part 2: Files Changed

- `app/api/roster/route.ts` – GET returns `email`, `inviteCode`, `inviteStatus`, `claimedAt`; POST adds coach-created flow, `created_by`, optional `email`, duplicate check, better errors.
- `app/api/roster/[playerId]/route.ts` – **new** – PATCH to update player (e.g. `invite_code`, `invite_status`, `email`).
- `app/api/roster/[playerId]/invite/route.ts` – **new** – POST to generate/set invite code for a player and set `invite_status = 'invited'`.
- `app/api/auth/signup-secure/route.ts` – When `programCode` is provided, first look up `players.invite_code`; if unclaimed player found, link user to that player and use `team_id`; else use `invites.code` as before.
- `app/api/team/join/route.ts` – Same: prefer linking by `players.invite_code`, then fall back to `invites.code`.
- `components/portal/roster-manager-enhanced.tsx` – Billing warning constant (configurable via `NEXT_PUBLIC_ROSTER_BILLING_WARNING`), confirmation modal before adding player, `submitAddPlayer` and API error handling.
- `supabase/migrations/20260309100000_players_onboarding_invites.sql` – **new** – Players: `email`, `invite_code`, `invite_status`, `claimed_at`, `created_by`. Invites: `code`, `uses`, `max_uses`. Teams: `invite_code` if missing.

---

## Part 3: Migrations Added

- **`20260309100000_players_onboarding_invites.sql`**  
  - Run this migration (e.g. `supabase db push` or run the file in the SQL editor).  
  - Adds columns and indexes as above; no separate manual steps required beyond applying the migration.

---

## Part 4: Manual Supabase Steps

1. **Apply migrations**  
   Run the new migration so `players` and `invites` (and optionally `teams`) have the new columns.  
   If you use the Supabase dashboard, paste and run the contents of `supabase/migrations/20260309100000_players_onboarding_invites.sql`.

2. **Optional: billing warning text**  
   Set `NEXT_PUBLIC_ROSTER_BILLING_WARNING` in your env to override the default billing warning message shown when a coach adds a player.

3. **If 403 persists for a coach**  
   Ensure that coach has a `team_members` row for the team with role `head_coach` or `assistant_coach` (or the equivalent that normalizes to `HEAD_COACH` / `ASSISTANT_COACH`). If they only have `profiles.team_id`, add the corresponding `team_members` row.

---

## Part 5: Testing Checklist

- [ ] **Coach adds player**  
  - As head or assistant coach, open Roster, click Add Player, fill first/last name (and optionally grade, jersey, position, email, notes).  
  - Confirm the billing warning modal appears, then confirm and add.  
  - Player appears in the roster with no linked account (no email in “user” until they join).

- [ ] **Coach sees billing warning**  
  - Click “Add Player” and submit the form; the modal with the configurable billing message appears before the request is sent.  
  - Cancel closes the modal; Confirm sends the request.

- [ ] **Player signs up using invite/team code**  
  - Generate an invite for a coach-created player (POST `/api/roster/[playerId]/invite`), or use an existing team invite code.  
  - Sign up (or use team join) with that code.  
  - User is linked to the team (and to the existing player record when using a player invite code).

- [ ] **Existing player row gets linked (no duplicate)**  
  - Coach creates a player (no account).  
  - Coach generates invite (POST `/api/roster/[playerId]/invite`).  
  - New user signs up with that player’s invite code.  
  - That `players` row has `user_id` and `claimed_at` set and `invite_status = 'joined'`; no second player row is created.

- [ ] **Billing impact**  
  - Billing logic can count “claimed” roster slots by counting `players` rows where `user_id IS NOT NULL` (and optionally `invite_status = 'joined'`).  
  - Coach-created, unclaimed players (`user_id IS NULL`) can be excluded from billable count if that is the business rule; the warning in the UI explains that when the player later joins, it will count as a billable slot.
