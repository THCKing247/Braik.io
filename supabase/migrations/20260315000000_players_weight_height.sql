-- Add weight and height to players for official game rosters
-- weight: integer (lbs), height: text (e.g. "5'10\"", "6-2")

alter table public.players add column if not exists weight integer;
alter table public.players add column if not exists height text;

comment on column public.players.weight is 'Player weight in pounds (for official roster submission)';
comment on column public.players.height is 'Player height, e.g. 5''10" or 6-2 (for official roster submission)';
