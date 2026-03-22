# Stats bulk import – developer note

Internal reference for the bulk player stats import flow (template download, preview, import).  
Netlify-hosted; team-scoped; no cross-tenant access.

**Architecture:** See [STATS_WEEKLY_SOURCE_OF_TRUTH.md](./STATS_WEEKLY_SOURCE_OF_TRUTH.md) — weekly/game rows are the only supported import path for standard stat keys.

## Request flow

1. **Template**  
   `GET /api/stats/template?teamId=...` or `?teamId=...&withRoster=1`  
   Returns **weekly/game** CSV: `STATS_WEEKLY_IMPORT_HEADERS` (identity + season_year, week_number, game_id, opponent, game_date + stat columns).  
   Auth: session + `requireTeamAccess(teamId)`.

2. **Preview**  
   `POST /api/stats/import` with FormData: `file`, `teamId`, `importMode=weekly_entries` (or omit; default is weekly), `preview=1`.  
   Server parses and validates weekly rows, matches to players (no DB writes).  
   Response: `mode: "preview"`, summary, `rowErrors`, `matchedPlayers`.

3. **Import**  
   Same endpoint without `preview`.  
   Inserts into `player_weekly_stat_entries`, audit rows, then `recalculateSeasonStatsFromWeeklyForPlayers` for affected players.  
   `importMode=season_totals` → **400** (no longer supported).

## Preview vs import

- **Preview**: Same parsing and matching as import; no DB writes.
- **Import**: Creates weekly rows; season totals on `players.season_stats` for `SEASON_STAT_KEYS` are updated only via the recalculation helper.

## Core helpers and constants

| Location | Purpose |
|----------|--------|
| `lib/stats-import-fields.ts` | `STATS_WEEKLY_IMPORT_HEADERS`, `STAT_IMPORT_FIELDS`, `CSV_HEADER_TO_DB_KEY`; `STATS_IMPORT_HEADERS` for tests/legacy parsers only |
| `lib/stats-weekly-import.ts` | Weekly CSV parse/validate used by import route |
| `lib/stats-weekly-season-sync.ts` | `recalculateSeasonStatsFromWeeklyForPlayers`, `SEASON_STAT_KEYS` |
| `lib/stats-import.ts` | `rowErrorsToCsv`; legacy `parseAndValidateStatsCsv` / `mergeStatsIntoSeasonStats` for tests only |
| `app/api/stats/template/route.ts` | Weekly template CSV |
| `app/api/stats/import/route.ts` | FormData handling, weekly import pipeline |

## How to add a new stat field

1. Add an entry to `STAT_IMPORT_FIELDS` in `lib/stats-import-fields.ts` (csvHeader, dbKey, label).
2. Ensure `SEASON_STAT_KEYS` in `lib/stats-weekly-season-sync.ts` includes the new `dbKey` if it should be synced from weekly rows.
3. Weekly import and recalculation pick up the field via shared field metadata; extend tests in `tests/stats-import.test.ts` or add weekly-specific tests as needed.

## Tests

- **Legacy season CSV** (lib): `npx tsx tests/stats-import.test.ts` — still covers `parseAndValidateStatsCsv`, merge helpers, `rowErrorsToCsv`, etc.
- **Route-level**: manual checks for preview → confirm, file change invalidates preview, `season_totals` → 400.

## Manual verification (support / regression)

- **Missing file**: POST without `file` → clear error.
- **Missing teamId**: POST without `teamId` → "Team is required."
- **season_totals**: POST with `importMode=season_totals` → 400 with deprecation message.
- **No preview → Confirm disabled**: Choose file; Confirm import disabled until preview.
- **File change → preview invalidated**: Preview file A; switch to file B; Confirm disabled until preview again.
