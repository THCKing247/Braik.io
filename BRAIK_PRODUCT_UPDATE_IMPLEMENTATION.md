# Braik Product Update – Implementation Summary

This document summarizes the unified product update: programs, plans, billing, invite codes, roles, and pricing/calculator alignment.

---

## 1. SQL Migrations Added

| Migration | Purpose |
|-----------|---------|
| `20260334000001_programs_and_organizations.sql` | Creates `organizations`, `programs`, `program_members`; adds to `teams`: `program_id`, `team_level`, `roster_creation_mode`, `plan_type`. |
| `20260334000002_backfill_programs_from_teams.sql` | One-time backfill: one program per existing team, `team_level = varsity`, `plan_type` from existing `plan_tier`; inserts `program_members` for creator as head_coach/athletic_director. |
| `20260334000003_coach_assignments.sql` | Creates `coach_assignments` (program_id, team_id, user_id, assignment_type: varsity_head, jv_head, freshman_head, offense_coordinator, defense_coordinator, special_teams_coordinator). |
| `20260334000004_invite_codes.sql` | Creates `invite_codes` with `invite_type` enum: head_coach_team_invite, assistant_coach_invite, team_player_join, player_claim_invite, parent_link_invite; code, program_id, team_id, target_player_id, uses, max_uses, expires_at, is_active, claimed_by_user_id, claimed_at. |
| `20260334000005_parent_player_links.sql` | Creates `parent_player_links` (parent_user_id → auth.users, player_id → players) for parent-code linking. |
| `20260335000001_athletic_director_link_invite.sql` | Adds enum value `athletic_director_link_invite` to `invite_code_type`; adds `metadata` jsonb to `invite_codes`. |

**Run order:** Apply migrations in the numeric order above (e.g. via `supabase db push` or your migration runner).

---

## 2. Files Changed (by area)

### Billing & pricing

- **`lib/billing.ts`** (new) – Head Coach and Athletic Director pricing constants and `computeHeadCoachBilling()` (varsity/JV/freshman bases, roster spots, free assistants 3 + 1 per JV + 1 per Freshman, overage $10).
- **`lib/pricing-sports.ts`** – Unchanged; still used for sport minimum roster.
- **`components/pricing/team-price-calculator.tsx`** – Reworked: plan choice (Head Coach vs Athletic Director), varsity + optional JV/Freshman roster spots, dynamic free assistants, full breakdown; removed “who pays” (players never pay in copy); AD shows flat $6,500.
- **`app/(marketing)/pricing/page.tsx`** – Head Coach Plan and Athletic Director Plan cards; copy states program/coach or AD pays; players do not pay for their own accounts.
- **`components/pricing/pricing-comparison.tsx`** – Head Coach vs Athletic Director comparison; messaging that plans are paid by program/AD.
- **`components/pricing/pricing-faq.tsx`** – FAQ answers updated: no player-paid or assistant-paid options; who pays, free assistants, roster growth, AD plan, upgrade path.

### Roles & permissions

- **`lib/auth/roles.ts`** – Added `ATHLETIC_DIRECTOR`; `canManageTeam` and `canManageBilling` include AD.
- **`lib/auth/rbac.ts`** – `profileRoleToNormalizedRole` maps `athletic_director` to `ATHLETIC_DIRECTOR`.

### Program / team / onboarding

- **`app/api/onboarding/route.ts`** – Creates a **program** (plan_type head_coach), then **teams** (varsity, optionally jv/freshman) with `program_id`, `team_level`, `roster_creation_mode`, `plan_type`; inserts **program_members** (head_coach); returns `programId` and `teamIds`.
- **`components/portal/onboarding-wizard.tsx`** – Step 1: team levels (Varsity, JV, Freshman) and roster creation mode (coach_precreated vs player_self_create); sends `teamLevels` and `rosterCreationMode` to API.

### Invite / codes

- **`lib/invites/invite-codes.ts`** (new) – `findInviteCode()`, `consumeInviteCode()`, `generateUniqueInviteCode()` for typed codes.
- **`app/api/team/join/route.ts`** – Priority 0: `invite_codes` for `team_player_join` and `player_claim_invite`; then existing: `players.invite_code`, `teams.team_id_code`, `invites.code`.
- **`app/api/invite-codes/route.ts`** (new) – POST creates an `invite_codes` row (inviteType, programId, teamId, targetPlayerId, maxUses, expiresInDays).

---

## 3. What Changed in Each File (concise)

| File | Change |
|------|--------|
| `lib/billing.ts` | New: HEAD_COACH_PRICING, ATHLETIC_DIRECTOR_PRICING, getFreeAssistantCoaches(), computeHeadCoachBilling(), getAthleticDirectorAnnual(). |
| `team-price-calculator.tsx` | Plan choice (Head Coach / AD); varsity + JV/Freshman toggles and roster spots; dynamic free assistants; breakdown; AD flat $6,500; copy: program/coach pays only. |
| `pricing/page.tsx` | Head Coach Plan and Athletic Director Plan cards; copy that program/AD pays and players don’t. |
| `pricing-comparison.tsx` | Head Coach vs AD comparison text; “program/AD pays” messaging. |
| `pricing-faq.tsx` | FAQ rewritten: no player-paid; who pays; free assistants; roster growth; AD plan; upgrade path. |
| `lib/auth/roles.ts` | ATHLETIC_DIRECTOR role; canManageTeam/canManageBilling true for AD. |
| `lib/auth/rbac.ts` | athletic_director → ATHLETIC_DIRECTOR in profileRoleToNormalizedRole. |
| `app/api/onboarding/route.ts` | Creates program then teams (varsity/jv/freshman), program_members; team_level, roster_creation_mode, plan_type. |
| `onboarding-wizard.tsx` | Team levels (Varsity/JV/Freshman) and roster creation mode in step 1; sends teamLevels, rosterCreationMode. |
| `lib/invites/invite-codes.ts` | New: findInviteCode, consumeInviteCode, generateUniqueInviteCode. |
| `app/api/team/join/route.ts` | First checks invite_codes (team_player_join, player_claim_invite); then legacy players.invite_code, team_id_code, invites.code. |
| `app/api/invite-codes/route.ts` | New: POST to create typed invite code. |

---

## 4. Manual Setup / Data Steps

- **Run migrations** in order (see §1). No manual data backfill beyond the backfill migration (one program per existing team).
- **Existing teams:** After `20260334000001` and `20260334000002`, every team has a `program_id` and default `team_level = varsity`, `plan_type` from previous `plan_tier`.
- **New head coach onboarding:** Creates one program and one or more teams (varsity, optional JV/Freshman) and program_members; no extra manual steps.

---

## 5. Env Vars

No new env vars. Existing Supabase (e.g. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and app config are unchanged.

---

## 6. Design Compromises / Current Schema

- **organizations** – Table exists and is linked to schools/athletic_departments; AD signup does **not** create an organization yet. Organization can be created when AD first creates a program/team in the portal; programs can then set `organization_id`.
- **Legacy invites** – The existing `invites` table (email + token) is unchanged. New flows can use `invite_codes`; team join still supports `teams.team_id_code` and `players.invite_code` for backward compatibility.
- **Membership** – Production continues to use `profiles.team_id` + `profiles.role` for “primary” team and role. `program_members` is the source of truth for program-level head_coach/assistant_coach/athletic_director; RBAC still derives from profile + team.created_by; program_members can be used later for program-scoped permission checks.
- **Guardians** – `guardians` and `guardian_links` remain; `parent_player_links` is added for the new parent-code flow. You can migrate or mirror guardian links into parent_player_links if desired.
- **Coach assignments** – JV/Freshman “head” are still assistant_coach in system role; `coach_assignments` stores titles (jv_head, freshman_head, offense_coordinator, defense_coordinator). Access rules (e.g. JV head can manage only JV) can be enforced in app logic using `coach_assignments` + team_id.

---

## 7. Pricing Page & Calculator Copy (high level)

- **Pricing page:** Head Coach Plan = varsity $250, $10/roster spot, 3 free assistants (4 with JV, 5 with JV+Freshman), JV/Freshman $50 base + $10/roster, $10/assistant overage. Athletic Director Plan = $6,500 flat, unlimited teams/roster/coaches. All copy states the **program/coach or athletic department** pays; **players do not pay** for their own accounts.
- **Calculator:** Head Coach: varsity roster, JV/Freshman toggles and roster spots, assistant count, dynamic free assistants, full breakdown. Athletic Director: flat $6,500 and short explanation. No “players pay” option; copy emphasizes “program/coach pays” and “player accounts included.”
- **FAQ:** Removed athlete-paid and assistant-paid options; added who pays, free assistant math, roster growth, AD plan contents, and upgrade path.

---

## 8. Optional Next Steps (not in this PR)

- **AD flow:** Create an organization when AD first creates a program and link program to that organization.
- **Dashboard:** Use `POST /api/invite-codes` to generate team join, player-claim, parent, and assistant coach codes; show and manage them in program/team settings.
- **RLS / program access:** Add policies or helpers that consider `program_members` and `coach_assignments` so JV/Freshman heads are restricted to their team level.
- **Billing API:** Expose `computeHeadCoachBilling()` (and AD flat) from an API or server action for “billing preview” or usage display in the portal.

---

## 9. Head Coach → Athletic Director Link Flow (reverse linking)

Standalone head coach programs can be linked later to an Athletic Director organization without duplicating teams or data.

### Invite type

- **`athletic_director_link_invite`** – Code generated by an AD; when a head coach redeems it, their existing program is attached to the AD’s organization (`program.organization_id` set). No duplicate program/team; head coach remains owner.

### Head Coach flow

- **Settings → Athletic Department** – New section for head coaches. If the program is standalone (`program.organization_id` is null), shows “Join Athletic Department” with a code input. Head coach enters the AD link code and submits.
- **API:** `POST /api/programs/link-to-organization` with body `{ code }`. Validates: user is head coach of a program, program is standalone, code is `athletic_director_link_invite`, active and not expired; then sets `program.organization_id` and consumes the code.
- **API:** `GET /api/programs/current` – Returns the current user’s program (from primary team) and `canLinkToOrganization` (true only if head coach and program is standalone).

### Athletic Director flow

- **AD dashboard** – “Link existing head coach program” card: button “Generate link code” calls `POST /api/invite-codes` with `inviteType: "athletic_director_link_invite"`. Organization is resolved via `getOrCreateAdOrganization()` (creates an organization for the AD’s athletic department if none exists). Code is shown with copy button; default 14-day expiry, 1 use.
- **API:** `POST /api/invite-codes` – For `athletic_director_link_invite`, verifies caller is an AD (has `athletic_departments` row), gets or creates organization, inserts `invite_codes` with `organization_id`.

### Data and safety

- Linking only sets `program.organization_id`; no duplicate programs or teams. Head coach and program_members unchanged; AD gets org-level visibility by virtue of the program being under their organization.
- Checks: program not already linked (unless transfer is later supported); code active and unexpired; code has organization_id; user is head coach of the program; organization exists.
- Backward compatible: standalone programs remain standalone until a head coach explicitly links via code.
