# Recruiter Search Portal & Football Program Intelligence — Implementation Summary

This document summarizes the implementation of **Feature 2 (Recruiter Search Portal)** and **Feature 3 (Football Program Intelligence AI)** for the Braik platform.

---

## 1. SQL Migrations

| File | Description |
|------|-------------|
| `supabase/migrations/20260338000001_recruiting_portal.sql` | Creates all recruiting tables and RLS |

### Tables created

- **player_recruiting_profiles** — One per player; `player_id` unique. Fields: program_id, team_id, graduation_year, height/weight, forty_time, shuttle_time, vertical_jump, gpa, visibility toggles (recruiting_visibility, stats_visible, coach_notes_visible, playbook_mastery_visible, development_visible), bio, x_handle, instagram_handle, hudl_url, youtube_url, slug (unique, for pretty URLs).
- **player_video_links** — External video URLs per player. `video_type`: highlight_film, full_game, practice_film, training_clip, other.
- **recruiter_accounts** — One per user who uses the recruiter portal; `user_id` unique. organization_name, role_title, focus_regions.
- **recruiter_saved_players** — (recruiter_user_id, player_id) unique; saved_at.
- **player_recruiter_interest** — Coach-logged interest: player_id, recruiter_user_id (nullable), school_name, coach_name, position_interest, status (watching, contacted, requested_film, camp_invite, offer, closed), notes, created_by_user_id.

### Indexes

- player_recruiting_profiles: player_id, program_id, recruiting_visibility, graduation_year, slug (unique where not null).
- player_video_links: player_id.
- recruiter_accounts: user_id.
- recruiter_saved_players: recruiter_user_id, player_id.
- player_recruiter_interest: player_id, recruiter_user_id, status.

### RLS

- All new tables use a single **service_role** policy (`using (true) with check (true)`). Access control is enforced in the application layer (API routes) via `requireProgramCoach`, `getServerSession`, and recruiter account checks.

---

## 2. New API Routes

### Recruiting (public / recruiter)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/recruiting/profile?playerId=` or `?slug=` | None | Public profile (only when recruiting_visibility = true). |
| GET | `/api/recruiting/search` | Session + recruiter account | Search recruiting-visible players. Query: position, graduationYear, state, teamLevel, heightFeetMin, weightLbsMin, fortyTimeMax, gpaMin, playbookMasteryMin, limit, offset. |
| POST | `/api/recruiting/save-player` | Session + recruiter account | Body: `{ playerId }`. Adds player to recruiter’s saved list. |
| GET | `/api/recruiting/saved-players` | Session + recruiter account | List saved players for current user. |

### Recruiting (coach)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/recruiting/profile/coach` | Program coach | Body: playerId, programId, and profile fields. Upserts player_recruiting_profiles. |
| POST | `/api/recruiting/video-links` | Program coach | Body: playerId, programId, links[]. Replaces video links for player. |
| POST | `/api/recruiting/interest` | Program coach | Body: playerId, programId, schoolName, status, etc. Logs or updates player_recruiter_interest. |
| GET | `/api/recruiting/report?playerId=` | Program coach | Full recruiting report (player, team, profile, promotion history, stats, development, playbook mastery, evaluations, video links, recruiter interest). |

### Program intelligence

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/program-intelligence/overview?programId=` | Program coach or AD | Program snapshot (roster by level, coaches, avg playbook mastery, development logs, recruiting counts). |
| GET | `/api/program-intelligence/breakout?programId=` | Program coach or AD | Breakout candidates (ranked by evaluations, development, playbook, promotion). |
| GET | `/api/program-intelligence/promotions?programId=` | Program coach or AD | Promotion candidates (JV/Freshman ranked by readiness). |
| GET | `/api/program-intelligence/playbook-readiness?programId=` | Program coach or AD | Offense/defense/special teams readiness %, lowest groups, players behind. |
| GET | `/api/program-intelligence/recruiting-ready?programId=` | Program coach or AD | Recruiting-ready players (visibility, video, evaluations). |
| GET | `/api/program-intelligence/risks?programId=` | Program coach or AD | Program risks (shallow depth, low playbook completion, no recruiting profiles, single-player positions). |
| GET | `/api/program-intelligence/dashboard?programId=` | Program coach or AD | Single aggregate of all of the above. |

### Programs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/programs/list` | Session | Programs the current user is a member of (program_members). Used for program selector. |

---

## 3. New Pages / Components

| Path | Description |
|------|-------------|
| `app/recruiting/[slugOrId]/page.tsx` | **Public** recruiting profile page. Resolves by slug or player UUID; only rendered when recruiting_visibility = true. Shows measurables, bio, video links, stats/playbook/development/coach notes only if allowed by visibility flags. |
| `app/(portal)/dashboard/recruiting/page.tsx` | **Recruiter portal**: saved players list, search form (position, graduation year, limit), results with Save and Profile links. Uses `DashboardPageShell` with `requireTeam={false}`. |
| `app/(portal)/dashboard/program-intelligence/page.tsx` | **Program intelligence dashboard**: program selector (from /api/programs/current or /api/programs/list), then snapshot, breakout players, promotion watchlist, playbook readiness, recruiting pipeline, risks. Uses `DashboardPageShell` with `requireTeam={false}`. |
| `app/(portal)/dashboard/roster/[playerId]/recruiting/page.tsx` | **Coach recruiting for one player**: link to public profile, “Generate report” and “Download JSON”, and note on coach APIs for profile/video/interest. Shown for coaches (canEdit). |

---

## 4. Shared Service / Helper Files

| Path | Description |
|------|-------------|
| `lib/recruiting/slug.ts` | `generatePlayerSlug()`, `isUuid()` for profile URLs. |
| `lib/recruiting/profile-resolver.ts` | `getRecruitingProfileByPlayerIdOrSlug()`, `getPublicRecruitingPageData()` — resolve profile by id or slug; full public page data with visibility-respected sections. |
| `lib/recruiting/recruiter-account.ts` | `ensureRecruiterAccount()`, `getRecruiterAccount()` — create/lookup recruiter_accounts by user_id. |
| `lib/recruiting/search.ts` | `searchRecruitingProfiles()` — filters (position, graduation, state, team level, height/weight/40/gpa, playbook mastery), returns result cards and total. |
| `lib/recruiting/report.ts` | `getRecruitingReport()` — full report for a player (profile, promotion history, stats, development, playbook mastery, evaluations, video links, recruiter interest). |
| `lib/program-intelligence/insights.ts` | `getProgramOverview()`, `getPlayerBreakoutCandidates()`, `getPromotionCandidates()`, `getPlaybookReadiness()`, `getRecruitingReadyPlayers()`, `getProgramRisks()` — deterministic scoring; no external AI. |

---

## 5. Indexes Added

See migration file; indexes are created on the new tables as listed in section 1.

---

## 6. RLS Considerations

- **Recruiting tables**: All use service-role-only policy. Authorization is enforced in API routes:
  - **Public profile**: No auth; visibility enforced by only returning data when `recruiting_visibility = true` and by section flags.
  - **Recruiter search/save/saved-players**: Session required; recruiter account created on first use (`ensureRecruiterAccount`).
  - **Coach profile/video-links/interest/report**: `requireProgramCoach(programId)` after resolving the player’s program from team.
- **Program intelligence**: All routes use `requireProgramCoach(programId)`, which allows head_coach, assistant_coach, and athletic_director from `program_members`.

---

## 7. Manual Setup

- **Recruiter access**: Any logged-in user can use the recruiter portal; the first search or saved-players call creates a `recruiter_accounts` row. No separate “recruiter role” in auth; access is gated by having a recruiter account.
- **Program membership**: Coaches and ADs must be in `program_members` for the program to use program intelligence and coach recruiting APIs. Ensure program_members is populated for teams that use programs.
- **State filter**: Search supports a `state` filter derived from organization → school (schools.state). Organizations must have school_id set and schools must have state for state filter to work.

---

## 8. Design Compromises / Notes

- **Playbook readiness**: Offense/defense/special teams percentages are not split by unit in the schema (play_assignments has program_id and team_level, not unit). The implementation reports a single program-level average for all three; true unit-level readiness would require unit on play_assignments or mapping from depth_chart_entries.
- **Program intelligence for AD**: AD may have no `profile.team_id`. The dashboard uses `/api/programs/current` (team-based) first, then `/api/programs/list` (program_members). ADs should be in `program_members` with role `athletic_director` for each program they oversee.
- **Recruiting profile creation**: Profiles are created by coaches via POST `/api/recruiting/profile/coach`. Players without a profile do not appear in recruiter search; the public profile page returns 404. No automatic creation of profiles for existing players.
- **Count in search**: When filters (e.g. position, state, teamLevel, playbookMasteryMin) are applied in memory after the DB query, the returned `total` is the total from the DB query (recruiting_visible only with DB filters), not the count after in-memory filters. So “total” may be larger than the number of results when using those filters.
- **Coach recruiting UI**: Full forms for editing recruiting profile, video links, and recruiter interest are not implemented in the UI; the coach recruiting page under roster/[playerId]/recruiting links to the report and documents the APIs. Integrations (e.g. existing roster or settings flows) can call the coach APIs to add full forms later.
- **PDF export**: Recruiting report is returned as JSON and can be downloaded as a file; PDF export is not implemented. If the codebase has an existing PDF utility, it can be wired to the report payload later.

---

## 9. Backward Compatibility

- Players without a `player_recruiting_profiles` row are ignored in recruiter search and public profile; no migration backfills profiles.
- Programs and teams continue to work without any recruiting or intelligence usage.
- Intelligence functions handle missing data (e.g. no evaluations, no play_assignments) with nulls or empty arrays and do not throw.

---

## 10. Permissions Summary

| Actor | Recruiting (public) | Recruiting (portal) | Recruiting (coach APIs) | Program intelligence |
|-------|----------------------|---------------------|-------------------------|------------------------|
| Unauthenticated | View public profile (if visible) | — | — | — |
| Recruiter (has recruiter_accounts) | — | Search, save, saved list | — | — |
| Head / assistant coach | — | — | Full (profile, video, interest, report) | Full for their program(s) |
| Athletic director | — | — | — | Full for programs in program_members |
| Player / parent | — | — | — | No access |

Public routes never expose coach notes or hidden sections; visibility is enforced in `getPublicRecruitingPageData` and in the public profile API.
