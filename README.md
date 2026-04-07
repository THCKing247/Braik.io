# Braik.io

## Football ownership, portal, invitation, and access (source of truth)

This section defines how **who owns the account** maps to **Athletic Director (AD) portal** vs **Head Coach (HC) portal** access. Implementation lives in `lib/enforcement/football-ad-access.ts`, with AD team visibility merged in `lib/ad-team-scope.ts`. **Legacy Supabase users** must keep working without account recreation; see also `README-legacy-users-access-transition.md`.

### Access states (Phase 1)

| State | Meaning |
| --- | --- |
| `full_owner_ad` | Full AD portal rights for the owning party: the athletic department license holder **or** a standalone varsity football head coach with no department owner. |
| `restricted_football_ad` | Varsity football head coach under a program linked to an organization whose athletic department has an AD owner: football-scoped AD portal only (same routes, scoped data). |
| `team_head_coach_only` | JV/Freshman head coach, or non-football varsity HC: **no** AD portal. |
| `assistant_only` | Assistant coach: **no** AD portal. |
| `no_ad_access` | Players, parents, and others: **no** AD portal. |

### Rules

1. **AD exists and owns the department** (`athletic_departments.athletic_director_user_id`): that user is `full_owner_ad` and has full AD portal access. The varsity football head coach for a program linked to that department’s organization is `restricted_football_ad`.
2. **No AD; varsity HC created / owns the program** (`programs.organization_id` is null and the user is program owner via `created_by_user_id` or `program_members` as `head_coach`): varsity football HC is `full_owner_ad` for portal purposes (standalone owner).
3. **Ownership later tied to an AD** (program gains `organization_id` whose org has `athletic_department_id` and an AD user): varsity HC becomes `restricted_football_ad` (loses full owner; keeps football-only AD visibility).
4. **JV/Freshman head coaches, assistants, players, parents** do not get AD portal access (`team_head_coach_only`, `assistant_only`, or `no_ad_access`).

### Data used (no separate “access” column)

- **AD existence:** `athletic_departments` row for the organization (`organizations.athletic_department_id` → `athletic_director_user_id`).
- **Program linkage:** `programs.organization_id`, `programs.sport`, `programs.created_by_user_id`, `program_members`.
- **Team level:** `teams.team_level` (`varsity` \| `jv` \| `freshman`); null legacy rows are treated as varsity after backfill migration.
- **User role:** `profiles.role`, `profiles.team_id`.

### Phase 1 scope (explicit non-goals)

- Do not assume greenfield signups only; migrations backfill nullable ownership fields and `program_members`.
- Later phases may adjust Teams/Coaches UI, invites, and player/parent flows; Phase 1 does not change those product behaviors beyond permission checks where listed below.

### Enforcement touchpoints (Phase 1)

- AD portal **route** access: `app/(portal)/dashboard/ad/layout.tsx` — allows `full_owner_ad` and `restricted_football_ad` (not role `ATHLETIC_DIRECTOR` only).
- AD-visible teams (overview, teams list, coaches, team detail): `fetchAdPortalVisibleTeams` / `resolveAdPortalTeamScope` in `lib/ad-team-scope.ts`.
- **Department-owner-only** APIs: `POST /api/ad/teams`, `athletic_director_link_invite` on `POST /api/invite-codes` — require `canPerformDepartmentOwnerActions` (licensed AD only).

### Phase 2 — Portal entry routing and shell separation

**Shell rule:** `/dashboard/ad/**` uses the Athletic Director layout only; `/dashboard` and other team portal routes use the Head Coach (team) shell only. No merged shells — dual-role varsity users use **separate URLs** (AD first on entry, then navigate to HC routes as needed).

**First destination** (sign-in API, session `defaultAppPath`, and “resume” when no `localStorage` last path):

| User | First route |
| --- | --- |
| Profile `admin` | `/admin/dashboard` |
| Anyone with Phase 1 `full_owner_ad` or `restricted_football_ad` (licensed AD **or** varsity football HC with AD portal access) | `/dashboard/ad` |
| JV/Freshman HC, non-football varsity HC, assistants, players, parents | `/dashboard` |

**Not in Phase 2:** Changing Teams/Coaches tables, invites, or player/parent feature flows.

**Implementation:** `lib/auth/portal-entry-path.ts` (`resolvePortalEntryPath`), `session.user.defaultAppPath` from `buildSessionUser`, `POST /api/auth/login` redirect, and `getResumeOrDefaultAppPath(role, session.defaultAppPath)` for login / native / mobile root resume.

**Note:** Visiting `/dashboard` directly after entry does **not** auto-bounce varsity HC back to AD (so the HC shell stays reachable by URL and nav). Only **default** entry paths prefer AD first for eligible users.

### Phase 3 — AD portal tab visibility (governance)

Inside `/dashboard/ad/**`, **top nav tabs** depend on Phase 1 access state. Layout and styling are unchanged; only which links render (plus route guards for direct URLs).

| Access | Overview | Teams | Coaches | Settings |
| --- | --- | --- | --- | --- |
| `full_owner_ad` | yes | yes | yes | yes |
| `restricted_football_ad` | no | yes | yes | no |

- **Restricted** users: default AD entry is `/dashboard/ad/teams` (not Overview). Direct visits to `/dashboard/ad` or `/dashboard/ad/settings` redirect to `/dashboard/ad/teams`.
- **Implementation:** `getAdPortalTabVisibility` in `lib/enforcement/football-ad-access.ts`, `AdNav` filters links, `resolvePortalEntryPath` sends restricted users to teams first.

### Phase 4 — AD Teams tab (governance & actions)

- **Table columns (order):** Gender, Team, Level, Head coach, Roster size, **Creator** (person), **Date created** (separate date column), Actions.
- **Actions:** **Portal access** → `/dashboard?teamId={id}` (HC shell; `braik_dashboard_team_hint` cookie + layout load AD-visible teams for athletic director role). **Edit** → `/dashboard/ad/teams/[id]` with form (name, sport, roster size, level, gender, head coach email) via `PATCH /api/ad/teams/[teamId]`.
- **Create team:** Removed from AD UI; `/dashboard/ad/teams/new` redirects to Teams list. Teams come from signup/provisioning.
- **Data:** `teams.gender`, `teams.team_level`, `teams.created_by`, `teams.created_at` (migration `20260360200000_teams_gender.sql`).

### Phase 5 — AD Coaches tab (team-level assignments & invites)

- **Two tables:** **Head coach assignments** (one row per AD-visible team; vacant allowed) and **Assistant coach assignments** (one row per `team_members` assistant on those teams). Data comes from `team_members` and profiles only — **not** `program_members` for this page’s display or control.
- **Row actions:** **Edit only** (no links into team HC portals from Coaches). Edit opens a **modal** to change coach display name, assigned team, and role type (`head_coach` | `assistant_coach`). Vacant head slots use the same Edit action to **assign by existing account email** (`POST /api/ad/coach-assignments`).
- **Invite:** **Invite coach** on Coaches opens a modal: pick **team**, **role type**, then `POST /api/ad/coach-invites` (returns an invite code). Assistant invites require the team’s `program_id`.
- **Enforcement (API):** At most **one active head coach per team**; moving or promoting a head is blocked if the target team already has a head. `PATCH /api/ad/coach-assignments` and `POST` vacant-head assign use `setPrimaryHeadCoach` / membership updates on `team_members`.
- **Implementation:** `lib/ad-portal-coach-assignments.ts` (`fetchAdCoachAssignmentsPageData`), `app/(portal)/dashboard/ad/coaches/page.tsx`, `components/portal/ad/ad-coaches-page-client.tsx`, `app/api/ad/coach-invites/route.ts`, `app/api/ad/coach-assignments/route.ts`.

### Phase 6 — Player invite and parent-link foundation

- **Player (team portal):** Coaches create invites via the existing roster flow (`POST /api/roster/[playerId]/invite`). That flow sets a **unique `players.invite_code`**, stores `player_invites` (token + code), and inserts an active typed **`invite_codes`** row with `invite_type = player_claim_invite` and `target_player_id` (same alphanumeric code as the roster).
- **Player (account linking):** `POST /api/player-invites/redeem` resolves **token or code** via `player_invites`, or falls back to **`players.invite_code`** when no invite row exists (`lib/player-invite-claim.ts`). Linked players are bound to the roster row and team (`team_members` as `player`).
- **Player signup:** Public signup requires a **coach invite** — either `joinToken` in session (from `/join?token=…`, sent on `POST /api/auth/signup-secure` from the complete step) **or** a **program/player code** (`teamId` / `programCode`) that matches typed invites or `players.invite_code`. No HC/AD portal layout changes.
- **Parent (separate path):** **`/parent/join`** collects the child’s **personal player code** first, validates with **`POST /api/parent/validate-player-code`**, then continues into the normal signup steps with `role = parent` and the code in `signupData.teamId`. Parents are not created through the athletic director or head-coach provisioning UIs.
- **Parent linking:** On signup, `POST /api/auth/signup-secure` resolves the code to a `players` row (same rules as before: rejects `teams.player_code` / team-wide join codes), inserts **`parent_player_links`**, and sets profile/team membership. **At most one parent account per player** is enforced in API logic and by **`idx_parent_player_links_one_parent_per_player`** on `parent_player_links(player_id)` (migration `20260362400000_phase6_one_parent_per_player.sql`).
- **Not in Phase 6:** Player reassignment UX/API (unchanged unless already present elsewhere).

### Phase 7 — Player team reassignment (football) and legacy cleanup

- **Reassignment:** `POST /api/players/promote` moves a **football** player between teams in the **same program** when both sides have `team_level` in `varsity` \| `jv` \| `freshman`. The **`players` row (same `id`, `user_id`)** is preserved; **`parent_player_links`** are unchanged (keyed by `player_id`).
- **Who may move:** Head coach via `program_members`, **or** primary head coach on any program team (`team_members` `head_coach` with `is_primary !== false`). **`athletic_director` in `program_members` does not** grant this action (AD uses the AD portal, not roster promotion). Legacy coaches with only **`team_members`** (no `program_members`) are covered for listing teams and for moves when they hold a head seat.
- **Side effects:** Updates `profiles.team_id` for linked players; moves `team_members` from old to new team; repoints pending `player_invites.team_id`; deactivates typed `player_claim_invite` codes so coaches can re-issue; moves **`inventory_items`** assigned to the player to the new `team_id`; records **`player_team_history`**. Active players must fit **target team/program roster limits** (`assertCanAddActivePlayers`).
- **UI:** “Move player” on the roster appears only for **football** teams and **head coach** session role (`components/portal/roster-manager-enhanced.tsx`); modal copy clarifies scope (`player-promote-modal.tsx`).
- **Program team list API:** `GET /api/programs/[programId]/teams` uses **`requireProgramTeamsListAccess`** (coaches on program or team level; not `athletic_director` program role) instead of `requireProgramCoach`, so assistants and team-only coaches can load the destination dropdown without treating AD as a roster coach.
- **Cleanup:** Removed reliance on **`requireProgramHeadCoach` + `program_members` only** for promotion (which blocked team-level head coaches). No portal shell or nav changes.

## Performance guidelines (portal & marketing)

See **[PERFORMANCE_GUIDELINES.md](./PERFORMANCE_GUIDELINES.md)** for first-render, bootstrap, fetching, Suspense, images, and dynamic-import rules. New dashboard widgets or portal surfaces should note impact on first paint and network waterfalls before merge.
