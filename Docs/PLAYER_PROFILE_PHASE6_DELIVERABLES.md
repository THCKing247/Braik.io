# Player Profile Phase 6 – Deliverables

## Summary

Phase 6 adds a **lightweight follow-up / intervention tracking** system, ties it to readiness exceptions, improves **coach workflow** from the Readiness tab, strengthens **team-level compliance** visibility, improves **guardian/contact** visibility in exception views, **enhanced exports**, and a **dashboard widget** powered by the team readiness API. All reuse existing readiness logic, activity logging, and roster flows.

---

## 1. Follow-up / intervention tracking

**Schema**
- **New table** `public.player_follow_ups` (migration `20260327000000_player_follow_ups.sql`):
  - `id`, `player_id`, `team_id`, `category` (e.g. physical_follow_up, waiver_reminder, eligibility_review, guardian_contact_follow_up, equipment_follow_up, other), `status` ('open' | 'resolved'), `note` (text, optional), `created_by`, `created_at`, `updated_at`, `resolved_at`.
  - RLS: team members can select/insert/update (read/write via app; coach-only enforced in API).

**APIs**
- **GET** `app/api/roster/[playerId]/follow-ups?teamId=xxx&status=open`  
  List follow-ups for a player. Coach: any player; player: own profile only. Returns array of `{ id, playerId, teamId, category, status, note, createdBy, createdAt, updatedAt, resolvedAt }` with creator name resolved.
- **POST** `app/api/roster/[playerId]/follow-ups`  
  Create follow-up. Coach only. Body: `{ category, note? }`. Category must be one of the allowed list. Logs `follow_up_created` to `player_profile_activity`.
- **PATCH** `app/api/roster/[playerId]/follow-ups/[followUpId]`  
  Update follow-up (set `status: "resolved"` and/or `note`). Coach only. On resolve, sets `resolved_at` and logs `follow_up_resolved` to `player_profile_activity`.
- **GET** `app/api/teams/[teamId]/follow-ups?status=open&limit=100`  
  List follow-ups across the team (for readiness view / dashboard). Coach only. Returns items with `playerName`, `createdBy`, etc.

**Activity**
- `lib/player-profile-activity.ts`: New action types `FOLLOW_UP_CREATED`, `FOLLOW_UP_RESOLVED`. Logged with `target_type: "follow_up"`, `target_id: followUpId`, `metadata: { category }`. Follow-up create/resolve appears in profile Activity tab and in team activity.

**UI**
- **Profile Overview**: **Follow-ups** section (below Readiness, above Contact). Lists open follow-ups (type, note, created by, date) with "Mark resolved" (coach). Shows last 5 resolved. Coach can "Add follow-up" with type dropdown and optional note.
- **Readiness tab**: Needs attention table includes **Follow-ups** column: open count per player + "Add follow-up" link to profile. **Open follow-ups** summary card in the grid. Team open follow-ups fetched when tab is active.

**Integration with readiness**
- Follow-ups are not derived from readiness; coaches create them from exception context. Open follow-ups are surfaced on the profile and in the Readiness "Needs attention" table so coaches can see "who needs attention, what is missing, and what we've already done."

---

## 2. Coach workflow actions from readiness exceptions

- From **Readiness → Needs attention** table: each row links to the player profile; **Add follow-up** links to the same profile so the coach can add a follow-up from the Overview tab.
- **Mark resolved** on the profile Overview for each open follow-up.
- Existing readiness filters (Incomplete, Missing physical, Missing waiver, etc.) unchanged; table remains the main exception view.
- No separate workflow engine; actions are create follow-up (on profile or from table link) and mark resolved (on profile).

---

## 3. Team-level compliance and document management

- **Filtering by missing document type**: Existing readiness filter dropdown already supports "Missing physical", "Missing waiver"; no new filter added. Required-doc logic remains in `lib/readiness.ts` and `REQUIRED_DOC_CATEGORIES`.
- **Required documents visibility**: Readiness summary cards show "Missing physical", "Missing waiver" counts; Needs attention table lists missing items per player. Document compliance badges on the profile Documents tab (Physical/Waiver as "Required for compliance") unchanged.
- No duplicate rules; all compliance logic stays in shared readiness and document categories.

---

## 4. Guardian/contact operations groundwork

- **Exception handling**: In the Readiness **Needs attention** table, a **"No guardians"** badge appears next to the player name when `!p.hasGuardians`, so coaches can see at a glance who has no guardians linked.
- **Add follow-up** and **Guardian/contact follow-up** category let coaches track follow-up for missing contact/guardians. No new admin UI to link/unlink guardians; copy still points to "Team settings when available."
- Forward-compatible: guardian linkage data and APIs unchanged; UI only surfaces state and follow-up type.

---

## 5. Enhanced exports and reporting

- **Export readiness (CSV)**: Now includes **Open Follow-ups** column (count per player). Filename: `roster-readiness-{teamId}-{date}.csv`.
- **Export incomplete only (CSV)**: New button on Readiness tab. Exports only players with `!p.ready`. Same columns as full export (without "Ready" column). Filename: `roster-incomplete-{teamId}-{date}.csv`.
- Exports remain client-side from current tab data; fields aligned with coach needs (name, readiness flags, physical, waiver, equipment, guardians, eligibility, open follow-ups, missing items).

---

## 6. Dashboard/widget reuse of readiness insights

- **ReadinessSummaryCard** in `components/portal/team-dashboard.tsx`: Fetches `GET /api/teams/[teamId]/readiness`. Renders only for coaches (403 for non-coaches → card not shown). Shows total players, ready count, incomplete count, "View" and "Open Readiness tab" links to `/dashboard/roster?teamId=...`.
- Placed in the dashboard grid with Updates and Notifications (e.g. 3-column on large screens). Reuses existing team readiness API; no new endpoint.

---

## 7. UX polish

- Follow-ups section: open items in amber card style; resolved in muted list with check icon; empty state copy for when there are no follow-ups.
- Readiness table: "No guardians" badge; Follow-ups column with count and "Add follow-up" link; Open follow-ups card in summary grid.
- Dashboard readiness card: compact summary and clear link to roster; hidden for non-coaches.
- Styling kept consistent with Braik portal and existing readiness/roster UI.

---

## 8. Technical summary

**Files changed**
- `supabase/migrations/20260327000000_player_follow_ups.sql` — new table and RLS.
- `lib/player-profile-activity.ts` — added `FOLLOW_UP_CREATED`, `FOLLOW_UP_RESOLVED`.
- `app/api/roster/[playerId]/follow-ups/route.ts` — GET list, POST create.
- `app/api/roster/[playerId]/follow-ups/[followUpId]/route.ts` — PATCH update (resolve/note).
- `app/api/teams/[teamId]/follow-ups/route.ts` — GET team list (coach).
- `components/portal/player-profile-view.tsx` — FollowUpsSection on Overview; ACTIVITY_LABELS for follow-up actions.
- `components/portal/roster-manager-enhanced.tsx` — team open follow-ups fetch; Open follow-ups card; Follow-ups column and "No guardians" badge in table; export with open follow-ups and "Export incomplete only"; TEAM_ACTIVITY_LABELS for follow-up actions.
- `components/portal/team-dashboard.tsx` — ReadinessSummaryCard; grid includes readiness when hasTeam.

**Schema**
- New table: `player_follow_ups` (see above). No changes to `players`, `player_documents`, `player_profile_activity`, or readiness logic.

**Permissions**
- Per-player follow-ups GET: coach any, player own. Create/PATCH: coach only.
- Team follow-ups GET: coach only.
- Dashboard readiness card: same as team readiness API (coach only); 403 results in card not rendering.

**Activity**
- Follow-up create/resolve logged to `player_profile_activity` with `target_type: "follow_up"`. Activity tab and team activity feed show "Follow-up added" / "Follow-up resolved."

---

## 9. Known limitations

- Follow-up list on profile is not paginated (all follow-ups loaded). Acceptable for lightweight use.
- "Add follow-up" from Readiness table links to profile; coach must open profile and add there (no inline modal on roster).
- Dashboard readiness card does not refresh automatically (e.g. on interval); user refreshes or navigates.
- Guardian linking/unlinking still requires Team settings or future flow; no in-app coach UI for that.
- Export incomplete only uses current readiness data in memory; very large rosters not streamed.

---

## 10. Phase 7 recommendations

1. **Bulk reminders**: Use follow-up data and readiness to trigger notifications (e.g. "Remind incomplete" that sends reminders to players missing required docs).
2. **Guardian link workflow**: Coach UI to link/unlink guardians from team settings or player profile, with optional invite-by-email.
3. **Follow-up from Readiness row**: Optional modal on the Readiness tab to add a follow-up for a player without leaving the page (prefill category from missing items).
4. **URL persistence for Readiness tab**: e.g. `?tab=readiness` so direct link or back navigation opens Readiness tab.
5. **Dashboard card refresh**: Optionally refetch readiness on focus or on a timer so the dashboard card stays current.
6. **Follow-up due dates / priority**: If needed, extend `player_follow_ups` with optional `due_at` or priority and surface in list/filters.
