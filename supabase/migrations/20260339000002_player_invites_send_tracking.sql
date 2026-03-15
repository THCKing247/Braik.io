-- Player invites: add code (human-readable), send tracking, and status values sent/expired.

alter table public.player_invites add column if not exists code text;
alter table public.player_invites add column if not exists sent_email_at timestamptz;
alter table public.player_invites add column if not exists sent_sms_at timestamptz;
alter table public.player_invites add column if not exists email_error text;
alter table public.player_invites add column if not exists sms_error text;

-- Allow status: pending, sent, claimed, expired, revoked
alter table public.player_invites drop constraint if exists player_invites_status_check;
alter table public.player_invites add constraint player_invites_status_check
  check (status in ('pending', 'sent', 'claimed', 'expired', 'revoked'));

create unique index if not exists idx_player_invites_code on public.player_invites(code) where code is not null;
comment on column public.player_invites.code is 'Short human-readable code for manual entry in app.';
comment on column public.player_invites.sent_email_at is 'When invite email was successfully sent (Postmark).';
comment on column public.player_invites.sent_sms_at is 'When invite SMS was successfully sent (Twilio).';
