# Stats: weekly entries as source of truth

## Model

- **`player_weekly_stat_entries`** (plus audit rows) is the **source of truth** for standard synced stat keys (`SEASON_STAT_KEYS` in `lib/stats-weekly-season-sync.ts`).
- **`players.season_stats`** is a **derived cache** for those keys. It should be updated **only** by `recalculateSeasonStatsFromWeeklyForPlayers` (which merges computed sums with existing JSONB while preserving keys outside `SEASON_STAT_KEYS`).

## Production write paths

- Weekly/game **UI** and **CSV import** insert or update rows in `player_weekly_stat_entries`, write audit rows where applicable, then call `recalculateSeasonStatsFromWeeklyForPlayers` for affected players.
- **Coach profile PATCH** (`seasonStats`): client updates may apply only **non-`SEASON_STAT_KEYS`** fields; synced keys are refreshed by recalculation after save.
- **`DELETE /api/stats/season`**: does **not** clear `season_stats`; it **recalculates** synced keys from weekly rows for the given players (same as “re-sync totals” in the portal).

## Deprecated

- **`importMode=season_totals`** and direct CSV merge into `players.season_stats` are removed from `POST /api/stats/import` (returns 400).

## Transition (existing data)

- Existing **`players.season_stats`** values are **not** bulk-wiped by this architecture.
- Until a player gets a weekly create/update/delete, import, profile save that triggers recalc, or bulk re-sync, stored totals for that player may still reflect **pre-migration** data for synced keys. After any of those events, synced keys match the sum of non-deleted weekly rows.
