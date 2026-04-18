-- Many-to-many: attach roster players to Braik clips and full game videos for recruiting + player portal.

create table if not exists public.video_clip_players (
  video_clip_id uuid not null references public.video_clips(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_clip_id, player_id)
);

create index if not exists idx_video_clip_players_player on public.video_clip_players(player_id);
create index if not exists idx_video_clip_players_clip on public.video_clip_players(video_clip_id);

comment on table public.video_clip_players is 'Roster players featured in a saved clip; drives recruiting + player portal surfacing.';

alter table public.video_clip_players enable row level security;

drop policy if exists video_clip_players_service_role on public.video_clip_players;
create policy video_clip_players_service_role on public.video_clip_players for all using (true) with check (true);

create table if not exists public.game_video_players (
  game_video_id uuid not null references public.game_videos(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_video_id, player_id)
);

create index if not exists idx_game_video_players_player on public.game_video_players(player_id);
create index if not exists idx_game_video_players_video on public.game_video_players(game_video_id);

comment on table public.game_video_players is 'Optional roster players linked to a full game/practice film.';

alter table public.game_video_players enable row level security;

drop policy if exists game_video_players_service_role on public.game_video_players;
create policy game_video_players_service_role on public.game_video_players for all using (true) with check (true);
