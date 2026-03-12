-- Sub-formations hold the actual formation diagram (template); formations are name-only.
-- Add template_data to sub_formations so the formation editor edits sub-formations.

alter table public.sub_formations
  add column if not exists template_data jsonb not null default '{"fieldView":"HALF","shapes":[],"paths":[]}'::jsonb;

comment on column public.sub_formations.template_data is 'Formation alignment diagram (player positions only, no routes).';
