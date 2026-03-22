-- Transactional SMS (A2P / compliance): store explicit opt-in and audit fields on profiles and players.

alter table public.profiles
  add column if not exists sms_opt_in boolean not null default false,
  add column if not exists sms_opt_in_at timestamptz,
  add column if not exists sms_opt_in_method text,
  add column if not exists sms_opt_in_ip text,
  add column if not exists sms_opt_in_source text;

comment on column public.profiles.sms_opt_in is 'User consented to transactional SMS to profile phone';
comment on column public.profiles.sms_opt_in_at is 'When SMS consent was recorded';
comment on column public.profiles.sms_opt_in_method is 'e.g. web_form';
comment on column public.profiles.sms_opt_in_ip is 'Client IP when consent was submitted (if available)';
comment on column public.profiles.sms_opt_in_source is 'e.g. signup, invite_acceptance, team_join, profile_update';

alter table public.players
  add column if not exists sms_opt_in boolean not null default false,
  add column if not exists sms_opt_in_at timestamptz,
  add column if not exists sms_opt_in_method text,
  add column if not exists sms_opt_in_ip text,
  add column if not exists sms_opt_in_source text;

comment on column public.players.sms_opt_in is 'Recipient consented to transactional SMS to player_phone';
comment on column public.players.sms_opt_in_at is 'When SMS consent was recorded';
comment on column public.players.sms_opt_in_method is 'e.g. web_form';
comment on column public.players.sms_opt_in_ip is 'Client IP when consent was submitted (if available)';
comment on column public.players.sms_opt_in_source is 'e.g. profile_update, roster_contact';

-- Preserve SMS capability for numbers already on file before this migration (consent not historically captured).
update public.profiles
set
  sms_opt_in = true,
  sms_opt_in_at = coalesce(sms_opt_in_at, now()),
  sms_opt_in_method = coalesce(sms_opt_in_method, 'data_migration'),
  sms_opt_in_source = coalesce(sms_opt_in_source, 'migration_backfill')
where phone is not null
  and trim(phone) <> ''
  and sms_opt_in is not true;

update public.players
set
  sms_opt_in = true,
  sms_opt_in_at = coalesce(sms_opt_in_at, now()),
  sms_opt_in_method = coalesce(sms_opt_in_method, 'data_migration'),
  sms_opt_in_source = coalesce(sms_opt_in_source, 'migration_backfill')
where player_phone is not null
  and trim(player_phone) <> ''
  and sms_opt_in is not true;
