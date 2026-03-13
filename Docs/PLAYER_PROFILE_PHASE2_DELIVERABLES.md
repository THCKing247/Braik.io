# Player Profile Phase 2 – Deliverables

## Summary of changes

### 1. Player photo upload

- **API** (`app/api/roster/[playerId]/image/route.ts`)
  - **POST**: Coaches can upload for any player; players can upload only for their own profile (`user_id === session.user.id`). Reuses existing flow: file written to `uploads/players/`, URL stored in `players.image_url`, returned as `/api/uploads/players/{filename}`.
  - **DELETE**: Same permission rule (coach any, player own only).
- **UI** (`components/portal/player-profile-view.tsx`)
  - In the profile header card: “Change photo” (file input) and “Remove” when a photo exists. Success/error feedback via `saveMessage` and `photoError`. Photo state updates locally after upload/remove.

**Permissions**: Coach = any player; player = own profile only. Enforced server-side.

---

### 2. Structured stats entry

- **Component** (`components/portal/player-profile-stats-form.tsx`)
  - **Season stats**: Predefined keys (games_played, passing_yards, rushing_yards, receptions, receiving_yards, touchdowns, tackles, interceptions) plus “Add custom stat” (key-value). Stored in `players.season_stats` (JSONB).
  - **Game stats**: “Add game” with Date, Opponent, Notes/stats line. Stored in `players.game_stats` (JSONB array).
  - **Practice metrics**: Dynamic key-value list; stored in `players.practice_metrics` (JSONB).
- **Profile view**
  - Stats tab: When `canEdit` (coach), shows `PlayerProfileStatsForm` plus coach notes. Save sends `seasonStats`, `gameStats`, `practiceMetrics` in PATCH body (already supported by profile API).
- **Read-only**: Existing read-only display (season key-value list, game table, empty states) unchanged for players.

**Permissions**: Coach-only edit; players see read-only. No new API; PATCH profile already accepts these fields.

---

### 3. Document attachments

- **Schema** (`supabase/migrations/20260325000000_player_documents.sql`)
  - New table `player_documents`: `id`, `player_id`, `team_id`, `title`, `file_name`, `file_url`, `file_size`, `mime_type`, `category`, `created_by`, `created_at`, `updated_at`.
- **API**
  - **GET** `app/api/roster/[playerId]/documents/route.ts` – List documents for player. Coach: any player on team; player: own profile only.
  - **POST** `app/api/roster/[playerId]/documents/route.ts` – Upload file (FormData: file, title, category). Coach only. Files under `uploads/player-documents/`; URL `/api/uploads/player-documents/{filename}`. Allowed types: PDF, images, Word, text; max 15MB.
  - **DELETE** `app/api/roster/[playerId]/documents/[docId]/route.ts` – Delete document and file. Coach only.
- **UI**
  - New **Documents** tab in profile: list of documents (title, file name, category) with link to open file. Coach: upload form (file + title + category) and delete per document. Player: list and open only.

**Permissions**: Coach = upload/delete; player = view own. Enforced in API.

---

### 4. Equipment assignment from profile

- **UI** (`components/portal/player-profile-view.tsx`, Equipment tab)
  - When `canEdit`: Fetches `GET /api/teams/[teamId]/inventory`. “Assign from team inventory”: dropdown of items with `assignedToPlayerId === null`, “Assign” calls `PATCH /api/teams/[teamId]/inventory/[itemId]` with `{ assignedToPlayerId: playerId }`. For items assigned to this player, “Unassign” sends `{ assignedToPlayerId: null }`. After assign/unassign, `onProfileRefetch()` refreshes profile so `assignedItems` stays in sync.
  - Still shows “From team inventory” (assigned items) and “Other / manual equipment notes” (`assigned_equipment` JSON). No change to `inventory_items` schema or team inventory API.

**Permissions**: Uses existing inventory PATCH (team access). Coach-only in UI (only coaches have `canEdit` on others’ profiles).

---

### 5. Parent/guardian foundation

- **Types** (`types/player-profile.ts`): Comment on `parentGuardianContact` that relational linkage uses `guardians` + `guardian_links`.
- **Doc** (`Docs/PLAYER_PROFILE_PARENT_GUARDIAN.md`): Describes current plain field vs. `guardians`/`guardian_links`, and where to add parent portal and profile API access for guardians. No schema or code changes beyond comments and doc.

---

### 6. UX polish

- **Overview**: “At a glance” summary card (jersey #, position, team, status) with clear hierarchy and status colors.
- **Tabs**: Slight padding and active-state background; `aria-label` for nav; horizontal scroll on small screens.
- **Photo**: Inline success/error and loading state.
- **Documents**: Upload success triggers list refetch; error text under form.
- **Equipment**: Error message at top of tab when assign/unassign fails.

---

## Files changed/added

| Path | Change |
|------|--------|
| `app/api/roster/[playerId]/image/route.ts` | Allow player to upload/delete own photo; use `requireTeamAccess` + membership + `canEditRoster` / `user_id` check. |
| `app/api/roster/[playerId]/documents/route.ts` | **New** – GET list, POST upload. |
| `app/api/roster/[playerId]/documents/[docId]/route.ts` | **New** – DELETE. |
| `supabase/migrations/20260325000000_player_documents.sql` | **New** – `player_documents` table. |
| `components/portal/player-profile-view.tsx` | Photo upload/remove in header; refetchProfile; Documents tab; Equipment assign/unassign; Overview “At a glance”; tab styling. |
| `components/portal/player-profile-stats-form.tsx` | **New** – Season/game/practice structured forms. |
| `types/player-profile.ts` | Comment on `parentGuardianContact`. |
| `Docs/PLAYER_PROFILE_PARENT_GUARDIAN.md` | **New** – Parent/guardian extension notes. |
| `Docs/PLAYER_PROFILE_PHASE2_DELIVERABLES.md` | **New** – This file. |

---

## New routes / APIs

- `GET /api/roster/[playerId]/documents?teamId=xxx` – List player documents.
- `POST /api/roster/[playerId]/documents` – Upload (coach only).
- `DELETE /api/roster/[playerId]/documents/[docId]` – Delete (coach only).

Existing roster image and team inventory APIs are reused; no new routes for photo or equipment.

---

## Schema / storage

- **New table**: `player_documents` (see migration). No change to `players` or `inventory_items`.
- **Storage**: Player images remain in `uploads/players/`; player documents in `uploads/player-documents/`. Served via existing `app/api/uploads/[...path]/route.ts`.

---

## Permission model

| Capability | Coach | Player (own profile) |
|------------|--------|----------------------|
| Photo upload/remove | Any player | Own only |
| Structured stats edit | Yes | No (read-only) |
| Documents: upload/delete | Yes | No |
| Documents: view | Any player | Own only |
| Equipment assign/unassign | Yes (via inventory API) | No |
| Profile PATCH (self-edit fields) | Any player | Own only |

---

## Known limitations

1. **Stats**: No sport-specific templates; custom keys are free-form. Game stats are one “notes” line per game; no structured per-game stat columns.
2. **Documents**: Stored on app server filesystem; no Supabase Storage yet. No per-document “visible to player” flag (all player docs visible to that player).
3. **Equipment**: Assignment uses existing inventory API; no assignment history or status log.
4. **Parent portal**: Not implemented; doc and types comment describe where to plug in.

---

## Recommended Phase 3

1. **Guardian profile access**: Allow profile GET (read-only) when requester is linked via `guardian_links`.
2. **Parent portal**: “My Athlete(s)” view for PARENT role with links to linked players’ profiles.
3. **Document visibility**: Optional `visible_to_player` (or category-based) so coaches can hide some docs from player view.
4. **Stats templates**: Sport-specific season/game stat templates and validation.
5. **Equipment history**: Optional `equipment_assignments` log (player_id, item_id, assigned_at, unassigned_at) for audit.
