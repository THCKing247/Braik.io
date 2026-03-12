-- Add play_type to plays for classification: run, pass, rpo, screen.
-- Nullable for backward compatibility with existing plays.

alter table public.plays
  add column if not exists play_type text check (play_type is null or play_type in ('run', 'pass', 'rpo', 'screen'));

create index if not exists idx_plays_play_type on public.plays(play_type) where play_type is not null;

comment on column public.plays.play_type is 'Play classification: run, pass, rpo, screen. Null for legacy plays.';
