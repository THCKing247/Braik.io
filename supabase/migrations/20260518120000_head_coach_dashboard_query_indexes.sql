-- Head coach dashboard: confirm hot-path indexes (non-destructive, IF NOT EXISTS only).

create index if not exists idx_formations_team_playbook_name
  on public.formations (team_id, playbook_id, name);

create index if not exists idx_sub_formations_team_formation
  on public.sub_formations (team_id, formation_id);

create index if not exists idx_depth_chart_entries_team_unit_pos
  on public.depth_chart_entries (team_id, unit, position, string);

create index if not exists idx_depth_chart_position_labels_team_unit
  on public.depth_chart_position_labels (team_id, unit, position);

create index if not exists idx_inventory_items_team_bucket_status
  on public.inventory_items (team_id, inventory_bucket, status);

create index if not exists idx_study_packs_team_created
  on public.study_packs (team_id, created_at desc);

create index if not exists idx_game_videos_team_created
  on public.game_videos (team_id, created_at desc);

create index if not exists idx_message_thread_participants_user
  on public.message_thread_participants (user_id, thread_id);
