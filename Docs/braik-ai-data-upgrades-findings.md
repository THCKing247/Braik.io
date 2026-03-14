# Coach B Data Upgrades — Phase 1 Inspection Findings

## 1. Existing player stats storage

| Source | Location | Used by Coach B |
|--------|----------|------------------|
| **season_stats** | `players.season_stats` (JSONB) | Yes — `player-context.ts` normalizes via `buildStatsFromFlat()` into nested passing/rushing/receiving/defense/kicking/specialTeams. |
| **game_stats** | `players.game_stats` (JSONB default `[]`) | No — profile API and player-profile-view read/write it; `player-context` only selects `season_stats`. |
| **practice_metrics** | `players.practice_metrics` (JSONB) | No — profile API exposes it; no Coach B consumption. |

- Migration `20260324000000_player_profile_fields.sql` adds all three columns.
- `game_stats` is an array of per-game objects (form adds entries; structure is team-defined, often date/opponent + stat fields). Not linked to `games.id`.

**Reuse:** Expose `game_stats` in player-context for recent games + trend. Optional: add `player_game_stats` table for explicit team/player/game linkage and aggregation.

---

## 2. Existing playbook/play data storage

| Source | Location | Used by Coach B |
|--------|----------|------------------|
| **playbooks** | `playbooks` (id, team_id, name, nodes, root_by_side) | Yes — playbook-context. |
| **formations** | `formations` (id, name, side, playbook_id) | Yes. |
| **plays** | `plays` (id, team_id, playbook_id, formation_id, sub_formation_id, formation, subcategory, name, side, tags, play_type, order_index) | Yes — tags drive `situation`; no usage/success. |
| **sub_formations** | `sub_formations` | Yes — name resolution. |

- No table stores play outcomes, call history, success, or yards. **Play success analytics need a new table** (e.g. `play_call_results`).

---

## 3. Existing game/schedule/opponent storage

| Source | Location | Used by Coach B |
|--------|----------|------------------|
| **seasons** | `seasons` (team_id, year, name, division, conference) | No directly. |
| **games** | `games` (id, season_id, team_id, opponent, game_date, location, game_type, result, team_score, opponent_score) | Yes — schedule-context maps to ScheduleContext (upcoming games with opponent). |
| **events** | `events` (team_id, event_type, title, start, end, location) | Yes — schedule-context; event_type PRACTICE → practice. |

- No structured opponent tendency store. Reports/documents have `extracted_text` (scouting content) but no parsed tendency rows. **Opponent tendency structure needs a new table** (e.g. `opponent_tendencies`) or we rely only on report excerpts.

---

## 4. Existing injury/availability/practice-related storage

| Source | Location | Used by Coach B |
|--------|----------|------------------|
| **player_injuries** | `player_injuries` (player_id, team_id, injury_reason, injury_date, expected_return_date, status, notes) | Yes — injury-context → InjuryContext (no practiceStatus/participation). |
| **players.health_status** | `players.health_status` (active/injured/unavailable) | Yes — player-context uses for availability. |
| **players.practice_metrics** | JSONB blob | No — unstructured. |

- No table for per-practice participation (limited/full/DNP, injury_related, notes). **Practice participation needs a new table** (e.g. `practice_participation`) linked to player/team/event.

---

## 5. Existing upload/report/scouting storage

| Source | Location | Used by Coach B |
|--------|----------|------------------|
| **documents** | `documents` (team_id, title, category, file_name, extracted_text) | Yes — report-context; excerpt from extracted_text or metadata. |
| **player_documents** | `player_documents` (player_id, team_id, title, category, extracted_text) | Yes — same. |

- Scouting/tendency keywords in report-context boost relevance; no structured tendency rows. **Structured tendencies:** new table or continue using report excerpts only.

---

## Decisions

| Upgrade | Reuse | New schema | Where it lives |
|--------|--------|------------|----------------|
| **Game-by-game player stats** | `players.game_stats` array (parse in context); optionally `games` for dates/opponents | Optional `player_game_stats` (team_id, player_id, game_id, stats JSONB) for explicit linkage | player-context.ts: recentGames, trendSummary; coordinator-tools: analyzePlayerDecision, comparePlayers |
| **Play success analytics** | `plays` (id, team_id, etc.) | `play_call_results` (play_id, team_id, game_id, yards_gained, success, touchdown, turnover, first_down, down, distance, red_zone_result, etc.) | playbook-context.ts: aggregate per play → usageCount, successRate, avgYards, recentResults; coordinator-tools: recommendPlaysForSituation |
| **Opponent tendency structure** | `games.opponent`, `schedule`; report excerpt for scouting | `opponent_tendencies` (team_id, opponent_name, source_type, source_id, tendency_category, down_distance, coverage, pressure, run_pass, red_zone, notes) | schedule-context or report-context; types + BraikContext.opponentTendencies or schedule enrichment; coordinator-tools: recommendPlaysForSituation |
| **Practice participation** | `player_injuries`, `events` | `practice_participation` (team_id, player_id, event_id, participation_status, injury_related, notes, occurred_at) | injury-context.ts + player-context; coordinator-tools: summarizeInjuries, analyzePlayerDecision |

---

## File ownership (summary)

- **player-context.ts:** season_stats (existing), game_stats array + player_game_stats if present → recentGames, trendSummary; practice participation when loaded.
- **playbook-context.ts:** plays + play_call_results aggregates → PlayContext.usageCount, successRate, avgYards, recentResults.
- **schedule-context.ts:** events + games (existing); optionally opponent_tendencies for next opponent → ScheduleContext or separate OpponentTendencyContext.
- **injury-context.ts:** player_injuries (existing); practice_participation → InjuryContext.practiceStatus / participation summary.
- **report-context.ts:** documents + player_documents (existing); can pass tendency excerpts; structured tendencies from DB can be merged in schedule or report.
- **types.ts:** PlayerContext.recentGames, trendSummary; PlayContext.usageCount, successRate, avgYards, recentResults; OpponentTendencyContext; BraikContext.opponentTendencies; InjuryContext practice fields.
- **coordinator-tools.ts:** Reasoning only; use new context fields for confidence and copy.
