-- Phase 6: at most one parent account linked per player (parent uses child's player code to sign up).

create unique index if not exists idx_parent_player_links_one_parent_per_player
  on public.parent_player_links (player_id);

comment on index public.idx_parent_player_links_one_parent_per_player is
  'Enforces one parent Braik account per player for Phase 6 parent signup (see README Phase 6).';
