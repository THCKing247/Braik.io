# Player Profile Phase 5 – Deliverables

## Summary

Phase 5 extends player profiles into broader team operations: a coach-facing **team-wide readiness dashboard**, **bulk roster filters** by readiness, **export readiness CSV**, **document compliance badges**, **guardian/contact UX improvements**, **activity filtering** (per-player and team-wide), and **recent team activity** on the Readiness tab. All reuse existing readiness logic, activity logging, and roster architecture.

---

## 1. Team-wide readiness dashboard

**Location**
- **Roster page** → **Readiness** tab (coach only). Chosen so coaches get one place for roster + depth chart + readiness; no new top-level route.

**API**
- **GET** `app/api/teams/[teamId]/readiness/route.ts`: Returns team-wide summary and per-player readiness. Coach only. Reuses the same rules as per-player readiness.

**Shared readiness logic**
- **New** `lib/readiness.ts`: Exports `REQUIRED_DOC_CATEGORIES`, `ReadinessInput`, `ReadinessResult`, and `computeReadiness()`. Single source of truth for:
  - profileComplete (name + contact)
  - physicalOnFile, waiverOnFile, eligibilityOnFile, requiredDocsComplete
  - equipmentAssigned, assignedEquipmentCount
  - missingItems, ready
- **Per-player API** `app/api/roster/[playerId]/readiness/route.ts`: Now uses `computeReadiness()` from `lib/readiness.ts` instead of inlined logic.
- **Team API** `app/api/teams/[teamId]/readiness/route.ts`: Fetches all players, documents by category, equipment counts, and guardian link counts; runs `computeReadiness()` per player; returns `summary` (counts) and `players` (per-player readiness).

**Response shape**
- `summary`: total, readyCount, incompleteCount, missingPhysicalCount, missingWaiverCount, incompleteProfileCount, noEquipmentCount, eligibilityMissingCount, noGuardiansCount.
- `players`: array of { playerId, firstName, lastName, ready, profileComplete, physicalOnFile, waiverOnFile, requiredDocsComplete, equipmentAssigned, assignedEquipmentCount, eligibilityStatus, hasGuardians, missingItems }.

**UI (Readiness tab)**
- Summary cards: Total, Ready (green), Incomplete (amber), Missing physical, Missing waiver, Incomplete profile, No equipment, No guardians, Eligibility not set.
- **Needs attention** table: players with issues; each row links to player profile. "Show incomplete in roster" / "Back to full roster" switch to Roster tab with or without filter.
- **Export readiness (CSV)** button: downloads CSV with columns First Name, Last Name, Ready, Profile Complete, Physical, Waiver, Equipment, Guardians, Eligibility, Missing Items.
- **Recent team activity** card: last 15 team-wide activities (player name → profile, action label, actor, time). Fetches `GET /api/teams/[teamId]/activity?limit=15`.

**Permissions**
- Team readiness and team activity: coach only (`canEditRoster`). Enforced in both APIs.

---

## 2. Bulk roster actions

**Filter by readiness**
- On **Roster** tab (when coach and team readiness loaded): **Readiness** dropdown next to position filter. Options: All readiness, Ready, Incomplete, Missing physical, Missing waiver, Incomplete profile, No equipment, No guardians linked, Eligibility not set. Filters the displayed roster client-side using `teamReadiness.players` (no extra API).

**Export**
- **Export readiness (CSV)** on Readiness tab (see above). Report-ready view is the Readiness tab itself (summary + needs attention table).

**Bulk reminders (prepared, not built)**
- Comment in code: "Future: bulk reminders — e.g. 'Remind incomplete' that triggers notifications for players missing docs." No new API or button; hook point for Phase 6.

---

## 3. Guardian / contact management improvements

**UI**
- **Linked guardians** (Info tab): Card-style layout per guardian; name + relationship + Verified badge; email (mailto) and phone (tel) on a second line; "No contact on file" when both missing. Footer: "To add or unlink guardians, use Team settings when available."
- Empty state: "No guardians linked yet." + "To link a parent/guardian, use Team settings or the guardian invite flow when available."
- No new coach linking workflow in this phase; architecture supports it later (e.g. team settings or invite flow).

**Permissions**
- Unchanged: coach and player (own profile) can view linked guardians. No add/remove link UI yet.

---

## 4. Document / compliance workflows

**Compliance-oriented categories**
- **Required for compliance**: Physical and waiver. Document categories unchanged; `lib/readiness.ts` uses `REQUIRED_DOC_CATEGORIES = ["physical", "waiver"]`.

**UI (Documents tab)**
- **Required for compliance** badge (emerald) next to category when document category is `physical` or `waiver`. Constant `REQUIRED_DOC_CATEGORIES` in `player-profile-view.tsx` for badges and dropdown labels.
- Upload form: category dropdown labels "Physical (required)" and "Waiver (required)" for those options.
- Readiness and documents stay connected: profile readiness uses document categories; Documents tab now surfaces which docs satisfy required compliance.

**Sorting/filtering**
- Existing category filter (All, Waiver, Physical, Eligibility, Form, Other) unchanged. No new sort; list order remains by API.

---

## 5. Coach alerts and exception views

**Location**
- **Readiness** tab = main "needs attention" view. No separate dashboard widget in Phase 5.

**Needs attention**
- Table of players who are incomplete or have missing items; each row links to profile. Summary cards give at-a-glance counts (missing physical, missing waiver, no guardians, etc.). "Show incomplete in roster" jumps to Roster tab with readiness filter = Incomplete.

**Exception views**
- Same data: filter roster by Missing physical, Missing waiver, No equipment, No guardians, etc. Coaches can quickly list and open profiles for each exception type.

---

## 6. Activity filtering and admin utility

**Per-player activity**
- **GET** `app/api/roster/[playerId]/activity/route.ts`: New optional query **actionType**. When set, only rows with that `action_type` are returned (e.g. `actionType=equipment_assigned`).
- **Activity tab** (player profile): **Filter** dropdown — All activity, Profile updated, Stats updated, Photo changed/removed, Document uploaded/removed, Equipment assigned/unassigned. Refetches with `actionType` when filter changes.

**Team-wide activity**
- **GET** `app/api/teams/[teamId]/activity/route.ts`: New endpoint. Returns recent activity across all players on the team. Query params: **limit** (default 50, max 100), optional **actionType**. Response includes playerId, playerName, actionType, createdAt, actor (name, email). Coach only.
- **Readiness tab**: **Recent team activity** card shows last 15 items; each line: player name (link to profile), action label, "by {actor}", relative time. Uses existing `TEAM_ACTIVITY_LABELS` for human-readable labels.

**Labels**
- `ACTIVITY_LABELS` and `TEAM_ACTIVITY_LABELS` map action_type to short labels (e.g. "Profile updated", "Equipment assigned"). No new action types; existing activity architecture reused.

---

## 7. UX polish

- Readiness tab: summary cards responsive (grid 2–5 columns); needs attention table with clear headers; empty states for no players and no activity.
- Documents: required badge and (required) in category dropdown; consistent Braik colors (emerald for compliance).
- Guardians: card per guardian; Verified badge; footer copy for future linking.
- Activity: filter always visible (empty and filled states); consistent relative time formatting.
- Roster: readiness filter only when coach and team readiness loaded; no layout shift.

---

## 8. Technical summary

**Files changed**
- `lib/readiness.ts` — new shared readiness logic.
- `app/api/roster/[playerId]/readiness/route.ts` — uses `computeReadiness()`.
- `app/api/teams/[teamId]/readiness/route.ts` — new team readiness API.
- `app/api/teams/[teamId]/activity/route.ts` — new team activity API.
- `app/api/roster/[playerId]/activity/route.ts` — optional `actionType` filter.
- `components/portal/roster-manager-enhanced.tsx` — Readiness tab, readiness filter, export CSV, team activity card, types.
- `components/portal/player-profile-view.tsx` — document compliance badges, category (required) labels, LinkedGuardiansSection layout, Activity tab filter.

**New APIs**
- `GET /api/teams/[teamId]/readiness` — team summary + per-player readiness (coach).
- `GET /api/teams/[teamId]/activity?limit=&actionType=` — team-wide activity (coach).

**Schema**
- No new migrations. Uses existing `players`, `player_documents`, `inventory_items`, `guardian_links`, `player_profile_activity`.

**Reuse**
- Readiness: `lib/readiness.ts` used by per-player and team APIs; same rules everywhere.
- Activity: same `player_profile_activity` table and action types; team API just queries by team_id and optionally action_type.

**Permissions**
- Team readiness: coach only (requireTeamAccess + canEditRoster).
- Team activity: coach only.
- Per-player readiness/activity: unchanged (coach any, player own).
- Documents/guardians: unchanged.

---

## 9. Known limitations

- Readiness filter on roster is client-side only; not persisted in URL (so refresh loses filter).
- Bulk reminders not implemented; only a code comment/hook for future notifications.
- Guardian linking/unlinking still requires Team settings or future invite flow; no in-profile coach UI.
- Team activity card does not have its own action-type filter in the UI (uses limit=15 only).
- Export CSV is client-side from current tab data; very large rosters may be fine but not streamed.

---

## 10. Phase 6 recommendations

1. **Bulk reminders**: Add "Remind incomplete" (or per-exception) that calls notification API for players missing required docs; use existing notification payload hooks from `lib/player-profile-activity.ts`.
2. **Guardian link workflow**: Coach UI to link/unlink guardians (e.g. from team settings or player profile), with optional invite-by-email.
3. **Persist readiness filter**: Put readiness filter in URL (e.g. `?readiness=incomplete`) so it survives refresh and back navigation.
4. **Team activity filter**: Add action-type dropdown to Recent team activity card on Readiness tab.
5. **Dashboard widget**: Optional "Needs attention" count or list on main coach dashboard linking to roster/readiness.
6. **Streaming export**: For large rosters, consider server-side CSV export endpoint that streams rows.
