-- Study Guides: program-linked assignments, quiz types, player progress, publish gate.
-- API uses service role; RLS remains for direct client access patterns.

-- ---------------------------------------------------------------------------
-- study_assignments: type, side targeting, publish, explicit player targets
-- ---------------------------------------------------------------------------
alter table public.study_assignments
  add column if not exists assignment_type text not null default 'review'
    check (assignment_type in ('review', 'quiz', 'mixed'));

alter table public.study_assignments
  add column if not exists assigned_side text
    check (assigned_side is null or assigned_side in ('offense', 'defense', 'special_teams'));

alter table public.study_assignments
  add column if not exists publish_status text not null default 'published'
    check (publish_status in ('draft', 'published'));

alter table public.study_assignments
  add column if not exists assigned_player_ids jsonb;

alter table public.study_assignments drop constraint if exists study_assignments_assigned_to_type_check;
alter table public.study_assignments
  add constraint study_assignments_assigned_to_type_check
  check (assigned_to_type in ('team', 'side', 'position_group', 'players'));

create index if not exists idx_study_assignments_team_publish on public.study_assignments (team_id, publish_status);

comment on column public.study_assignments.assignment_type is 'review = material only; quiz = questions only; mixed = both (no ordering lock).';
comment on column public.study_assignments.assigned_side is 'Used when assigned_to_type = side (offense/defense/special_teams).';
comment on column public.study_assignments.assigned_player_ids is 'When assigned_to_type = players, persisted UUID list for coach reporting.';

-- ---------------------------------------------------------------------------
-- study_assignment_items: link plays and formations
-- ---------------------------------------------------------------------------
alter table public.study_assignment_items drop constraint if exists study_assignment_items_item_type_check;
alter table public.study_assignment_items
  add constraint study_assignment_items_item_type_check
  check (item_type in ('playbook', 'install_script', 'study_pack', 'formation', 'play'));

-- ---------------------------------------------------------------------------
-- study_assignment_players: engagement + quiz metrics
-- ---------------------------------------------------------------------------
alter table public.study_assignment_players
  add column if not exists opened_at timestamptz;

alter table public.study_assignment_players
  add column if not exists review_started_at timestamptz;

alter table public.study_assignment_players
  add column if not exists review_material_opened_at timestamptz;

alter table public.study_assignment_players
  add column if not exists review_completed_at timestamptz;

alter table public.study_assignment_players
  add column if not exists quiz_started_at timestamptz;

alter table public.study_assignment_players
  add column if not exists quiz_submitted_at timestamptz;

alter table public.study_assignment_players
  add column if not exists score_percent numeric(5, 2);

alter table public.study_assignment_players
  add column if not exists correct_count smallint;

alter table public.study_assignment_players
  add column if not exists total_questions smallint;

create index if not exists idx_study_assignment_players_assignment on public.study_assignment_players (assignment_id);
create index if not exists idx_study_assignment_players_assignment_status on public.study_assignment_players (assignment_id, status);

-- ---------------------------------------------------------------------------
-- mastery_questions: objective formats (matching uses answer_key jsonb)
-- ---------------------------------------------------------------------------
alter table public.mastery_questions
  add column if not exists question_type text not null default 'multiple_choice'
    check (question_type in ('multiple_choice', 'true_false', 'matching'));

alter table public.mastery_questions
  add column if not exists answer_key jsonb;

alter table public.mastery_questions alter column correct_index drop not null;

comment on column public.mastery_questions.answer_key is 'For matching: {"pairs":[[leftIdx,rightIdx],...]}; MC/TF use correct_index.';
