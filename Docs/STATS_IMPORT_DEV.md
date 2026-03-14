# Stats bulk import – developer note

Internal reference for the bulk player stats import flow (template download, preview, import).  
Netlify-hosted; team-scoped; no cross-tenant access.

## Request flow

1. **Template**  
   `GET /api/stats/template?teamId=...` or `?teamId=...&withRoster=1`  
   Returns CSV (headers only, or headers + one row per team player with identity filled, stat columns empty).  
   Auth: session + `requireTeamAccess(teamId)`.

2. **Preview**  
   `POST /api/stats/import` with FormData: `file`, `teamId`, `preview=1`.  
   Server parses CSV, validates, matches rows to players (no DB writes).  
   Response: `mode: "preview"`, summary, `rowErrors`, `matchedPlayers`.

3. **Import**  
   Same endpoint without `preview`.  
   For each matched row with stat data: merge into `players.season_stats`, skip if merged === existing (same-value detection), then update DB.  
   Response: `mode: "import"`, summary, `rowErrors`, optional `noChange` / `noChangeReason`.

## Preview vs import

- **Preview**: Same parsing and matching as import; no updates. Used so coaches can confirm row count, matched players, and row errors before applying.
- **Import**: Runs the same match loop; for each row with stats, merges into `season_stats`, compares to existing (same-value check), then updates only if changed. Duplicate player rows (same player in CSV twice) are rejected after the first.

## Core helpers and constants

| Location | Purpose |
|----------|--------|
| `lib/stats-import-fields.ts` | `STATS_IMPORT_HEADERS`, `STAT_IMPORT_FIELDS`, `CSV_HEADER_TO_DB_KEY`, `STAT_DB_KEYS`, `STATS_IMPORT_MAX_FILE_BYTES`, `STATS_IMPORT_MAX_DATA_ROWS` |
| `lib/stats-import.ts` | `parseCsvToRows`, `parseAndValidateStatsCsv`, `mergeStatsIntoSeasonStats`, `seasonStatsEqualForImportKeys`, `rowErrorsToCsv` |
| `app/api/stats/template/route.ts` | Template CSV generation (headers + optional roster rows) |
| `app/api/stats/import/route.ts` | FormData handling, file/size/type checks, parse, match, update, logging |

## How to add a new stat field

1. **Define the field** in `lib/stats-import-fields.ts`:
   - Add one entry to `STAT_IMPORT_FIELDS`: `{ csvHeader: "new_stat", dbKey: "new_stat", label: "New stat" }`.
   - `CSV_HEADER_TO_DB_KEY` is derived from `STAT_IMPORT_FIELDS` (and the `int_thrown` alias); no change needed unless you need an extra alias.
   - `STAT_DB_KEYS` is derived; it will include the new `dbKey` for same-value comparison.

2. **Template**  
   `STATS_IMPORT_HEADERS` is built from `IDENTITY_COLUMNS` + `STAT_IMPORT_FIELDS.map(f => f.csvHeader)`, so the new column appears automatically in template downloads and in the parser’s expected headers.

3. **Validation**  
   `parseAndValidateStatsCsv` in `lib/stats-import.ts` iterates over `CSV_HEADER_TO_DB_KEY`; the new column is validated and written into each row’s `stats` object under `dbKey`.

4. **Merge and same-value**  
   `mergeStatsIntoSeasonStats` and `seasonStatsEqualForImportKeys` use the keys coming from the parsed row / `STAT_DB_KEYS`; no code change needed.

5. **UI**  
   If you show stat labels in the app (e.g. “How it works”), use `STAT_LABELS_BY_DB_KEY` from `stats-import-fields.ts` so the new field’s label is consistent.

## Tests

- **Unit tests** (lib only): `npx tsx tests/stats-import.test.ts` — parsing, validation, merge, rowErrorsToCsv, seasonStatsEqualForImportKeys, BOM, quotes, blank rows, etc.
- **Route-level** (missing file, malformed upload, no preview → confirm disabled, file change → preview invalidated): no automated route tests in this repo; use the manual verification steps below.

## Manual verification (support / regression)

- **Missing file**: POST without `file` → "Please choose a CSV file to upload."
- **Missing teamId**: POST without `teamId` → "Team is required."
- **Malformed upload**: Corrupt or non-multipart body → "Invalid upload. Please try again with a CSV file."
- **No preview → Confirm disabled**: Do not run preview; choose file; Confirm import button stays disabled.
- **File change → preview invalidated**: Run preview for file A; change selection to file B; Confirm import disabled until preview is run again for B.
