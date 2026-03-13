# Player Profile Phase 4 – Deliverables

## Summary

Phase 4 turns the player profile into a clearer operations and communication hub: readiness/compliance summary, contact actions, guardian linkage MVP, equipment history from activity, roster/profile navigation memory, and notification/event integration readiness.

---

## 1. Readiness / compliance status

**API**
- **GET** `app/api/roster/[playerId]/readiness/route.ts`: Returns a derived readiness summary. Coach: any player; player: own only.

**Readiness logic (derived from existing data)**
- **profileComplete**: `first_name` and `last_name` non-empty and at least one of `player_phone`, `email`, `parent_guardian_contact` non-empty.
- **physicalOnFile**: At least one `player_documents` row with `category = 'physical'`.
- **waiverOnFile**: At least one with `category = 'waiver'`.
- **eligibilityOnFile**: At least one with `category = 'eligibility'`.
- **eligibilityStatus**: From `players.eligibility_status` (display only).
- **requiredDocsComplete**: Both physical and waiver on file (configurable via `REQUIRED_DOC_CATEGORIES`).
- **equipmentAssigned**: At least one `inventory_items` row with `assigned_to_player_id = playerId`.
- **missingItems**: List of human-readable missing items (e.g. "Profile incomplete (name + contact)", "Physical on file", "Waiver on file", "Required documents", "Eligibility status").
- **ready**: `profileComplete && requiredDocsComplete`.

**UI (Overview tab)**
- Readiness card at top: "Ready" (green) or "Incomplete" (amber); badges for Profile complete, Physical on file, Waiver on file, Required documents, Equipment; eligibility status when set; "Missing: ..." when not ready.
- Coaches and players see the same readiness; copy is neutral.

**Permissions**
- Same as profile GET: coach any player, player own only.

---

## 2. Contact + communication actions

**UI (Overview tab)**
- **Contact** card below Readiness: mailto link for `playerEmail`, tel link for `playerPhone`, and "Parent/guardian: {parentGuardianContact}" (plain text). Empty state when no contact info.
- No new APIs; uses existing profile fields. Structure allows adding a future "Message" or communication panel that could target player/guardian.

**Permissions**
- No change; contact is part of profile visibility.

---

## 3. Guardian linkage MVP groundwork

**API**
- **GET** `app/api/roster/[playerId]/guardians/route.ts`: Returns guardians linked to this player via `guardian_links` joined to `guardians` and optionally `users`. Response: `{ linkId, guardianId, relationship, verified, name, email, phone }[]`. Coach: any player; player: own only.

**Model**
- One guardian (user) can link to many players; one player can have many guardians. Access for a guardian: later, allow profile read when `guardian_links` has a row for (guardian_id for this user, player_id). No schema changes; `guardians` and `guardian_links` already exist.

**UI (Info tab)**
- **Linked guardians** section: fetches `/api/roster/[playerId]/guardians`. When data exists, shows list with name, relationship, verified badge, mailto/tel for email and phone. When empty, shows "No guardians linked yet" and short copy. Replaces the previous placeholder.

**Permissions**
- Coach and player (own profile) can view linked guardians. No coach-only UI to add/remove links in this phase.

---

## 4. Equipment history

**Source**
- Reuses existing activity log: `equipment_assigned` and `equipment_unassigned` with `metadata.itemName`.

**UI (Equipment tab)**
- **Assignment history**: Fetches `/api/roster/[playerId]/activity`, filters client-side to `equipment_assigned` and `equipment_unassigned`, shows last 15 with "Assigned {itemName}" / "Returned {itemName}" and relative time. Placed above "Issue / Return notes". Currently assigned list and manual notes unchanged; inventory-backed vs manual remain clearly separated.

**Permissions**
- Same as profile/activity: coach any player, player own only.

---

## 5. Roster / profile navigation memory

**Roster page**
- Reads `view`, `q`, `position` from URL (`useSearchParams`). Passes `initialView`, `initialSearch`, `initialPosition` into `RosterManagerEnhanced`.

**RosterManagerEnhanced**
- New props: `initialView`, `initialSearch`, `initialPosition` (optional). State initialized from these; `useEffect` keeps state in sync when props change (e.g. when returning from profile with URL params).
- Syncs view and position to URL on change (`useRouter.replace` with `teamId`, `view`, `position`). Search is not synced on every keystroke; it is included when building the profile link so it is restored when coming back.
- **getProfileHref**: Builds profile URL with `teamId`, `view`, `q`, `position` so opening a profile carries roster context.

**Profile page**
- Builds `backHref` from `teamId` plus `view`, `q`, `position` from current search params so "Back to Roster" returns to the same view, search, and position.

**Permissions**
- No change.

---

## 6. Notification / event integration readiness

**Types and helpers**
- **lib/player-profile-activity.ts**:
  - `PlayerProfileEventPayload`: `playerId`, `teamId`, `actionType`, `actorId`, `targetType`, `targetId`, `metadata`, optional `playerUserId`, `guardianUserIds` for notification targeting.
  - `buildProfileEventPayload(params)`: returns a payload from `LogPlayerProfileActivityParams` for use by activity log and future notification code.
  - Comment in `logPlayerProfileActivity()`: resolve `playerUserId` and `guardianUserIds` and call `createNotifications()` for relevant action types.

**Mutations**
- All profile-related mutations still go through `logPlayerProfileActivity()`. Notifications can be added in one place by resolving player and guardian user IDs and calling `createNotifications()` with the same payload shape.

---

## 7. UX polish

- Overview order: Readiness → Contact → At a glance → rest. Readiness and Contact use cards with clear headings.
- Empty states: Contact "No contact info on file"; Linked guardians "No guardians linked yet"; Equipment history only shown when there is activity.
- Success/error/loading: Existing save/upload/delete toasts and inline errors unchanged; readiness loads with a short delay (no blocking skeleton).

---

## Files changed / added

| Path | Change |
|------|--------|
| `app/api/roster/[playerId]/readiness/route.ts` | **New** – readiness summary. |
| `app/api/roster/[playerId]/guardians/route.ts` | **New** – list linked guardians. |
| `app/(portal)/dashboard/roster/page.tsx` | Read view/q/position from URL; pass initial* to roster. |
| `app/(portal)/dashboard/roster/[playerId]/page.tsx` | backHref includes view, q, position. |
| `components/portal/roster-manager-enhanced.tsx` | initialView/Search/Position; sync view/position to URL; getProfileHref includes params. |
| `components/portal/player-profile-view.tsx` | Readiness fetch + card; Contact card; LinkedGuardiansSection; Equipment assignment history; OverviewTab gets playerId/teamId. |
| `lib/player-profile-activity.ts` | PlayerProfileEventPayload, buildProfileEventPayload, NOTIFICATION_INTEGRATION comment. |
| `Docs/PLAYER_PROFILE_PHASE4_DELIVERABLES.md` | **New** – this file. |

---

## Schema changes

- None. Readiness uses `players` and `player_documents`; guardians use `guardian_links` and `guardians`.

---

## New APIs

- **GET** `/api/roster/[playerId]/readiness?teamId=xxx` – Readiness summary.
- **GET** `/api/roster/[playerId]/guardians?teamId=xxx` – Linked guardians list.

---

## Readiness logic (reference)

| Check | Source | Rule |
|-------|--------|------|
| profileComplete | players | first_name, last_name non-empty and at least one of player_phone, email, parent_guardian_contact non-empty |
| physicalOnFile | player_documents | exists row with category = 'physical' |
| waiverOnFile | player_documents | exists row with category = 'waiver' |
| eligibilityOnFile | player_documents | exists row with category = 'eligibility' |
| eligibilityStatus | players.eligibility_status | display only |
| requiredDocsComplete | player_documents | physical and waiver both on file |
| equipmentAssigned | inventory_items | count where assigned_to_player_id = playerId > 0 |
| ready | derived | profileComplete && requiredDocsComplete |

---

## Permission model updates

| Capability | Coach | Player (own) |
|------------|--------|---------------|
| View readiness | Any player | Own only |
| View linked guardians | Any player | Own only |
| View equipment history | Any player | Own only |
| Roster URL params | N/A | N/A (everyone) |

---

## Known limitations

1. **Readiness**: Required docs are fixed (physical + waiver). No team-level config for required categories. "Equipment" is only "has any assigned" vs "none".
2. **Guardians**: Read-only; no UI to add/remove links. Linking still requires other flows (e.g. team settings or future invite).
3. **Equipment history**: No "issued/returned" status on inventory items; history is inferred from activity (assign = issued, unassign = returned). No date range filter.
4. **Roster URL**: Search is restored when returning from profile but not written to URL on every keystroke (only view and position sync to URL on change).
5. **Notifications**: Payload types and comments only; no `createNotifications()` calls yet.

---

## Phase 5 recommendations

1. **Notifications**: In `logPlayerProfileActivity()`, resolve `playerUserId` and `guardianUserIds`, then call `createNotifications()` for profile_updated, document_uploaded, equipment_assigned/unassigned with link to profile.
2. **Guardian link management**: Coach UI to link/unlink guardians to a player (e.g. by email or existing guardian account).
3. **Readiness config**: Team-level or app-level config for which document categories are "required" and optional equipment rules.
4. **Equipment**: Optional "issued at / returned at" or status on `inventory_items` or a small assignment history table if more detail is needed beyond activity log.
5. **Contact**: Optional "Message" or "Send message" that hooks into existing messaging (if any) or prepares a mailto with pre-filled subject/body.
