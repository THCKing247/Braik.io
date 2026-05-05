-- Phase 6: advisor-driven index cleanup (FK coverage, study_assignments list shape, redundant btree drops).

-- ---------------------------------------------------------------------------
-- 1) Foreign-key covering indexes (unindexed FK linter)
-- ---------------------------------------------------------------------------

create index if not exists coach_b_action_proposals_team_id_idx
  on public.coach_b_action_proposals (team_id);

create index if not exists document_acknowledgements_user_id_idx
  on public.document_acknowledgements (user_id);

create index if not exists fundraising_due_collection_recipients_user_id_idx
  on public.fundraising_due_collection_recipients (user_id);

create index if not exists fundraising_due_collection_recipients_player_id_idx
  on public.fundraising_due_collection_recipients (player_id)
  where player_id is not null;

create index if not exists install_script_items_play_id_idx
  on public.install_script_items (play_id);

create index if not exists player_maxes_player_id_idx
  on public.player_maxes (player_id);

create index if not exists player_maxes_created_by_idx
  on public.player_maxes (created_by)
  where created_by is not null;

-- ---------------------------------------------------------------------------
-- 2) study_assignments — coach GET uses .eq("team_id") + .order("created_at",{ascending:false}) only
--    (app/api/teams/[teamId]/study/assignments/route.ts). Prefer single btree (team_id, created_at desc)
--    and drop overlapping indexes so the planner does not prefer idx_study_assignments_team + sort.
-- ---------------------------------------------------------------------------

create index if not exists study_assignments_team_created_at_desc_idx
  on public.study_assignments (team_id, created_at desc);

drop index if exists idx_study_assignments_team_created_at;
drop index if exists idx_study_assignments_team;

-- ---------------------------------------------------------------------------
-- 3) Redundant / duplicate btree indexes (safe subset)
-- games: single-column team_id redundant vs composite (team_id, game_date).
-- idx_games_team_kickoff duplicates idx_games_team_game_date (same columns).
-- idx_profiles_team_id: retained — partial idx_profiles_team_coordinator does not replace
-- general WHERE profiles.team_id = ? (invites, roster, notifications, etc.).
-- idx_team_members_team_id: not created in this repo; drop if exists (no-op on fresh installs).
-- ---------------------------------------------------------------------------

drop index if exists idx_games_team_id_game_date;
drop index if exists idx_games_team_id;
drop index if exists idx_games_team_kickoff;

drop index if exists idx_team_members_team_id;
