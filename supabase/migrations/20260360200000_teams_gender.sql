-- AD portal Teams governance: optional gender label (signup/provisioning can set later).
alter table public.teams add column if not exists gender text;

comment on column public.teams.gender is 'Optional display label e.g. boys, girls, coed — used in AD Teams table.';
