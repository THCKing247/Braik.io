# Player Profile – Production Readiness Pass

## Summary of Changes

### 1. API & permissions

- **GET /api/roster/[playerId]/profile**
  - Returns `canEdit: true` when the requester is a coach **or** the profile owner (`user_id === session.user.id`), so players can edit their own profile (self-edit fields only).
- **PATCH /api/roster/[playerId]/profile**
  - When the requester is **not** a coach, the body is filtered to only the five self-edit keys (`preferredName`, `playerEmail`, `playerPhone`, `address`, `emergencyContact`) via `filterBodyForPlayerSelfEdit`. Coach-only fields in the body are ignored for players.
  - `date_of_birth` is validated with `validateDateOfBirth` (YYYY-MM-DD); invalid values are stored as null.
  - `profile_tags` is normalized to a string array before saving.

### 2. Shared profile transform

- **New: `lib/player-profile-api.ts`**
  - `mapRowToProfile()` – maps DB row + team name + assigned inventory items to `PlayerProfile` (single place for transform logic).
  - `validateDateOfBirth()` – validates and normalizes date strings.
  - `normalizeProfileTags()` – ensures tags are `string[]`.
  - `filterBodyForPlayerSelfEdit()` – restricts PATCH body to allowed self-edit keys for players.
  - Types: `DbPlayerRow`, `AssignedEquipmentItemRow`.
- **`app/api/roster/[playerId]/profile/route.ts`**
  - Uses the shared transform and validation; removed duplicate mapping.

### 3. UI/UX

- **Header**
  - Profile header is a card with clearer hierarchy, spacing, and mobile-friendly layout.
  - Success/error message appears after save (inline, auto-dismiss after 4s).
- **Unsaved changes**
  - `beforeunload` is used when there are local edits to reduce accidental navigation.
- **Overview**
  - Summary copy and read-only fields use a consistent muted background (`bg-[#F8FAFC]`) so they’re visually distinct from editable inputs.
- **Empty states**
  - Stats: “No stats recorded yet” with short helper text.
  - Equipment: “No equipment assigned from team inventory” and “Assign gear in the Inventory section.”
  - Notes: “No notes yet” when empty.
- **Stats**
  - Season stats shown as a key-value list instead of raw JSON.
  - Game stats shown as a table when each item is an object; otherwise fallback to formatted JSON.
- **Equipment**
  - “From team inventory” lists items from `inventory_items` with a note that assignment is managed in Inventory.
  - “Other / manual equipment notes” shows `assigned_equipment` JSON as key-value pairs so inventory-driven vs manual tracking is clear.
- **Notes / long content**
  - Notes and coach notes use `break-words` and consistent padding so long text doesn’t break layout.

### 4. Roster integration

- **PlayerCard**
  - Optional `profileHref` prop: when set and card is not draggable, clicking the card navigates to the profile. Image upload and Forms button use `stopPropagation` so they don’t trigger navigation.
  - Keyboard: Enter/Space on the card triggers navigation when `profileHref` is set.
- **Roster grid**
  - Passes `profileHref={getProfileHref?.(player)}` to `PlayerCard` so the card is clickable when a profile link exists (e.g. for players; coaches use the Profile button and draggable is on).
- **List view**
  - Profile icon button has `aria-label` for accessibility.

### 5. My Profile flow (/dashboard/profile)

- Handles 403 from `/api/roster/me` by treating it as “not_found” and showing the same empty state.
- Uses a ref to avoid double `router.replace` when redirecting to the profile.
- Empty state copy is clearer and includes an icon and “View Roster” / “Back to Dashboard” actions.
- Loading state shows “Opening your profile...” when redirecting.

### 6. Files touched

| File | Change |
|------|--------|
| `lib/player-profile-api.ts` | **New.** Shared transform, validation, and body filter. |
| `app/api/roster/[playerId]/profile/route.ts` | Uses shared lib; `canEdit` includes own profile; PATCH filters body for players; date/tags validation. |
| `components/portal/player-profile-view.tsx` | Header card, save feedback, beforeunload, Overview/Stats/Equipment/Notes empty states and layout. |
| `components/portal/player-card.tsx` | Optional `profileHref`; card click (and keyboard) to open profile; stopPropagation on image/forms. |
| `components/portal/roster-grid-view.tsx` | Passes `profileHref` to `PlayerCard`. |
| `components/portal/roster-list-view.tsx` | `aria-label` on profile link. |
| `app/(portal)/dashboard/profile/page.tsx` | 403 handling, ref to prevent double redirect, clearer empty/error UI. |
| `Docs/PLAYER_PROFILE_PRODUCTION_READINESS.md` | **New.** This summary. |

---

## Important fixes

1. **Players can edit their own profile**  
   API now returns `canEdit: true` when the profile is the player’s own, so self-edit fields are editable in the UI.

2. **PATCH locked down for players**  
   Non-coach users’ PATCH body is restricted to the five self-edit keys; coach-only fields are ignored.

3. **Date and tags**  
   `date_of_birth` is validated (YYYY-MM-DD); invalid values become null. `profile_tags` is stored as a string array.

4. **Single transform**  
   All profile shaping lives in `lib/player-profile-api.ts`, so DB → API response is consistent and maintainable.

---

## Schema / migrations

- No new migrations.
- Existing `public.players` columns and `20260324000000_player_profile_fields.sql` are unchanged and match the API/UI.

---

## Known limitations

1. **Stats entry**  
   Season/game stats are still free-form JSON. There is no dedicated stats form; coaches can add structured stats via a future form that writes to `season_stats` / `game_stats`.

2. **Equipment assignment in profile**  
   Assigned equipment is shown from `inventory_items` (assigned to player). Changing assignment is done in Inventory, not on the profile page. `assigned_equipment` JSON is for manual notes only.

3. **Player photo**  
   Profile shows image from `players.image_url` but there is no in-profile upload; upload remains in the roster flow.

4. **Documents**  
   `document_refs` exists on the type and in the DB but there is no UI to attach or view documents yet.

5. **Multiple teams**  
   My Profile uses the current team from session/query. If a user is on multiple teams, they see the profile for that single team only.

---

## Recommended next steps

1. **Player photo upload**  
   Add “Upload photo” on the profile (Overview or header) that calls the existing roster image upload API and refreshes profile.

2. **Document attachments**  
   Add a “Documents” area on the profile that reads/writes `document_refs` and/or links to team documents assigned to the player.

3. **Stats entry forms**  
   Add coach-only forms for season stats (e.g. key-value or sport-specific fields) and game stats (e.g. per-game table) that write to `season_stats` / `game_stats`.

4. **Equipment assignment from profile**  
   Optional “Assign from inventory” on the Equipment tab that opens a modal to assign team inventory items to the player (still updating `inventory_items.assigned_to_player_id`).

5. **Parent/guardian portal**  
   When parent/guardian roles are supported, allow view (and optionally limited edit) of their linked player’s profile using the same profile API and permission rules.
