-- Roster suspension: optional expected end date for coach workflow (Head Coach portal).
alter table public.players add column if not exists suspension_end_date date;

comment on column public.players.suspension_end_date is 'When status is suspended, optional date suspension is expected to lift; UI shows orange until cleared or status changes.';
