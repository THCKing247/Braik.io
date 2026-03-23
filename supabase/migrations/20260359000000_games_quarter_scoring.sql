-- Optional per-quarter scoring (venue home/away). Totals remain on team_score / opponent_score.
alter table public.games add column if not exists q1_home integer;
alter table public.games add column if not exists q2_home integer;
alter table public.games add column if not exists q3_home integer;
alter table public.games add column if not exists q4_home integer;
alter table public.games add column if not exists q1_away integer;
alter table public.games add column if not exists q2_away integer;
alter table public.games add column if not exists q3_away integer;
alter table public.games add column if not exists q4_away integer;

comment on column public.games.q1_home is 'Home team points in Q1 (venue). Map to team via location home/away.';
comment on column public.games.q1_away is 'Away team points in Q1 (venue).';
