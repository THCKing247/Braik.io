# Player Profile Phase 3 – Deliverables

## Summary

Phase 3 adds activity/history tracking, stronger documents UX, better stats presentation, guardian linkage groundwork, roster/profile workflow clarity, and audit/notification readiness without rebuilding the profile system.

---

## 1. Activity / history tracking

**Schema**
- **New table** `player_profile_activity` (migration `20260326000000_player_profile_activity.sql`): `id`, `player_id`, `team_id`, `actor_id`, `action_type`, `target_type`, `target_id`, `metadata_json`, `created_at`. Indexed on `(player_id, created_at desc)` and `(team_id, created_at desc)`.

**Logger**
- **New** `lib/player-profile-activity.ts`: `logPlayerProfileActivity()`, `PLAYER_PROFILE_ACTION_TYPES` (photo_changed, photo_removed, profile_updated, equipment_assigned, equipment_unassigned, document_uploaded, document_deleted, stats_updated). Includes NOTIFICATION_HOOK comment for future notifications.

**Wiring**
- **Profile PATCH** (`app/api/roster/[playerId]/profile/route.ts`): After successful update, logs `profile_updated` or `stats_updated` (if season/game/practice stats changed).
- **Image POST/DELETE** (`app/api/roster/[playerId]/image/route.ts`): Logs `photo_changed` / `photo_removed`.
- **Documents POST** (`app/api/roster/[playerId]/documents/route.ts`): Logs `document_uploaded` with metadata title.
- **Documents DELETE** (`app/api/roster/[playerId]/documents/[docId]/route.ts`): Logs `document_deleted` before delete.
- **Inventory PATCH** (`app/api/teams/[teamId]/inventory/[itemId]/route.ts`): When `assigned_to_player_id` changes, logs `equipment_assigned` for the new player and/or `equipment_unassigned` for the previous player.

**API**
- **GET** `app/api/roster/[playerId]/activity/route.ts`: `?teamId=xxx&limit=50`. Returns recent activity with actor name. Coach: any player; player: own profile only.

**UI**
- **New Activity tab** in profile: read-only list with human-readable action labels, metadata (e.g. document title, item name), actor name, relative time. Empty state when no activity.

**Permissions**
- Coaches see full activity for any player. Players see activity only for their own profile (same as profile GET).

---

## 2. Documents UX improvements

**Schema**
- **Migration** `20260326100000_player_documents_visible.sql`: Adds `visible_to_player` (boolean, default true) to `player_documents`.

**API**
- **GET documents**: Returns `visibleToPlayer`, `createdBy` (uploader name). For non-coach viewers, filters to `visible_to_player = true`.
- **POST documents**: Accepts `visibleToPlayer` (formData); stored as `visible_to_player`.
- **PATCH** `app/api/roster/[playerId]/documents/[docId]/route.ts`: New. Body `{ visibleToPlayer: boolean }`. Coach only.

**UI (Documents tab)**
- **Category filter**: Dropdown (All, Waiver, Physical, Eligibility, Form, Other); filters list client-side.
- **Upload**: “Visible to player” checkbox; clearer loading state (“Uploading...” with spinner).
- **File type badges**: PDF, Word, Image, or extension; category badge.
- **Created at / uploaded by**: Formatted date and “Uploaded by {name}” in list.
- **Empty state**: Different copy when no docs vs. no docs in selected category.
- **Visibility toggle**: Coach-only Eye/EyeOff icon button per row; PATCH toggles `visible_to_player`.
- **Layout**: Actions (visibility + delete) in a row; metadata on separate line.

**Permissions**
- Unchanged: coach upload/delete/toggle visibility; player view (only docs with `visible_to_player` true).

---

## 3. Stats presentation improvements

**UI (Stats tab, read-only)**
- **Season summary**: Grouped into Offense (passing_yards, rushing_yards, receptions, receiving_yards, touchdowns), Defense (tackles, interceptions), Games (games_played). Each group in a summary card. “All stats” card for any custom keys.
- **Game log**: Each game as a card with date, opponent, notes, and remaining key-value stats. Last 20 games; “Showing last 20 games” when more. Most recent first.
- Coach editing unchanged (structured form + coach notes).

**Permissions**
- No change: coach edit; player read-only.

---

## 4. Guardian linkage groundwork

**Types**
- **`types/player-profile.ts`**: New `GuardianLinkSummary` and comment that guardian access should check `guardian_links` (guardian_id → player_id). `GuardianLinkSummary`: guardianId, playerId, relationship, verified, guardianName.

**UI**
- **Info tab**: “Linked guardians” placeholder section: “Parent/guardian linkage is supported in the data model. Linked guardians will appear here in a future update.”

**Code**
- No new APIs or DB changes. Existing `guardians` and `guardian_links` tables remain the extension point.

---

## 5. Roster / profile workflow

**Back link**
- **Profile page** (`app/(portal)/dashboard/roster/[playerId]/page.tsx`): `backHref` built via `URLSearchParams` so additional roster query params can be appended later (e.g. view, sort) without changing the pattern.

**Discoverability**
- No change to roster grid/list “Profile” action or click-through; both already open profile. Back button remains “Back to Roster” with arrow.

---

## 6. Audit and notification readiness

**Activity logger**
- `lib/player-profile-activity.ts`: NOTIFICATION_HOOK comment lists which action types should trigger notifications (profile_updated, stats_updated, document_uploaded, equipment_assigned/unassigned, etc.) and notes resolving player and guardians for targeting.

**Mutations**
- All profile-related mutations that log activity go through `logPlayerProfileActivity()`. Future work: from that function (or a wrapper), call `createNotifications()` for the appropriate users (player’s user_id, guardian user_ids from `guardian_links`).

**Modularity**
- Activity is a single table and one logger; notifications can be added in one place without reworking each API.

---

## 7. UX polish

- **Profile loading**: Skeleton header (avatar + title placeholders) plus spinner instead of spinner-only.
- **Documents loading**: “Loading documents...” text under spinner.
- **Activity tab**: Empty state with History icon and short copy.
- **Info tab**: Guardian placeholder uses dashed border and muted text.
- **Stats**: Clear “Season summary” and “Game log” labels and short descriptions.

---

## Files changed / added

| Path | Change |
|------|--------|
| `supabase/migrations/20260326000000_player_profile_activity.sql` | **New** – player_profile_activity table. |
| `supabase/migrations/20260326100000_player_documents_visible.sql` | **New** – visible_to_player on player_documents. |
| `lib/player-profile-activity.ts` | **New** – activity logger + NOTIFICATION_HOOK. |
| `app/api/roster/[playerId]/activity/route.ts` | **New** – GET activity list. |
| `app/api/roster/[playerId]/profile/route.ts` | Log profile_updated / stats_updated after PATCH. |
| `app/api/roster/[playerId]/image/route.ts` | Log photo_changed / photo_removed. |
| `app/api/roster/[playerId]/documents/route.ts` | visible_to_player in GET/POST; creator lookup. |
| `app/api/roster/[playerId]/documents/[docId]/route.ts` | PATCH visibleToPlayer; log document_deleted. |
| `app/api/teams/[teamId]/inventory/[itemId]/route.ts` | Log equipment_assigned / equipment_unassigned. |
| `components/portal/player-profile-view.tsx` | Activity tab; Documents filters/badges/visibility; Stats summary cards + game log cards; Guardian placeholder; profile loading skeleton. |
| `types/player-profile.ts` | GuardianLinkSummary + guardian hook comment. |
| `app/(portal)/dashboard/roster/[playerId]/page.tsx` | backHref via URLSearchParams for future params. |
| `Docs/PLAYER_PROFILE_PHASE3_DELIVERABLES.md` | **New** – this file. |

---

## New routes / APIs

- **GET** `/api/roster/[playerId]/activity?teamId=xxx&limit=50` – List activity (coach any player; player own).
- **PATCH** `/api/roster/[playerId]/documents/[docId]` – Update document (e.g. visibleToPlayer). Coach only.

---

## Schema changes

- **player_profile_activity**: New table (see migration).
- **player_documents**: New column `visible_to_player` (boolean, default true).

---

## Permission model (new/updated)

| Capability | Coach | Player (own) |
|------------|--------|---------------|
| View activity | Any player | Own only |
| Document visible to player | Set on upload; toggle via PATCH | N/A (view only) |
| View document | All docs | Only visible_to_player = true |

---

## Known limitations

1. **Activity**: No pagination (limit cap 100). No filtering by action type in API.
2. **Documents**: Visibility toggle is per-document; no bulk “hide all” or category-based default.
3. **Stats**: Groupings are fixed (Offense/Defense/Games); no sport switcher. Game log shows last 20 only.
4. **Guardians**: Placeholder only; no API or UI to link/unlink guardians.
5. **Notifications**: Hooks are documented only; no calls to `createNotifications()` yet.

---

## Phase 4 recommendations

1. **Notifications**: Implement `createNotifications()` calls from `logPlayerProfileActivity()` (or a wrapper) for profile_updated, document_uploaded, equipment_assigned; target player and optionally guardians.
2. **Guardian API**: GET/POST/DELETE for guardian_links from coach context; resolve guardian name for placeholder section.
3. **Activity**: Pagination (cursor/offset) and optional filter by action_type.
4. **Roster URL state**: Persist view (card/list) and sort in URL so back from profile restores them.
5. **Stats**: Sport-specific templates (e.g. soccer, basketball) and configurable groupings.
