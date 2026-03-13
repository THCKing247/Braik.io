# Parent/Guardian Support Foundation

## Current state

- **players.parent_guardian_contact**: Plain text field for quick coach entry (name, phone, etc.). Shown on player profile Info tab.
- **guardians** table: Parent/guardian user accounts (`user_id`, name, phone, email, relationship).
- **guardian_links** table: Many-to-many between guardians and players (`guardian_id`, `player_id`, relationship, verified).

Relational parent–player linkage is in place in the schema; the app does not yet expose a parent portal or guardian-specific flows.

## Where to plug in parent/guardian features

1. **Resolve “current player” for a guardian**
   - Query `guardian_links` where `guardian_id` = (guardian user’s linked guardian row) to get `player_id`(s).
   - Use the same profile API: `GET /api/roster/[playerId]/profile?teamId=xxx`. Permission will need to allow guardian access when the requester is linked via `guardian_links` (in addition to coach or player self).

2. **Profile API**
   - In `app/api/roster/[playerId]/profile/route.ts`, extend access so that if the requester is not the player and not a coach, check `guardian_links` for a row linking the session user (via `guardians.user_id`) to this `player_id`; if found, allow read-only (or policy-based) access.

3. **Parent portal**
   - Add a “My Athlete(s)” or “Team” entry for role `PARENT` that lists linked players (via `guardian_links`) and links to each player’s profile (read-only or with allowed fields).

4. **Optional: sync parent_guardian_contact**
   - When displaying or editing guardian contact, you can optionally sync from the primary linked guardian’s `guardians` row into `players.parent_guardian_contact` for backward compatibility with the plain field.

## Data model (no migration required)

- Keep `players.parent_guardian_contact` as the simple, display-only field.
- Use `guardians` + `guardian_links` for any sign-in, permissions, and multi-parent or multi-athlete flows.
