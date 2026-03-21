-- Phase 1: roster entitlements (team/program), injury fields, message soft-delete, Stripe-ready program columns

-- Programs: org-level roster pool + Stripe linkage (webhook/TODO UI fills these)
alter table public.programs add column if not exists roster_slot_limit integer;
alter table public.programs add column if not exists stripe_customer_id text;
alter table public.programs add column if not exists stripe_subscription_id text;

comment on column public.programs.roster_slot_limit is 'When set, max active players summed across all teams with this program_id. Null = no program-level cap.';

-- Teams: per-team cap when program has no program-level limit
alter table public.teams add column if not exists roster_slot_limit integer;

comment on column public.teams.roster_slot_limit is 'Max active players on this team when program.roster_slot_limit is null. Null = unlimited (legacy).';

-- Injuries: severity + practice exemption (Coach B + UI)
alter table public.player_injuries add column if not exists severity text;
alter table public.player_injuries add column if not exists exempt_from_practice boolean not null default false;

comment on column public.player_injuries.severity is 'e.g. mild | moderate | severe | day_to_day — app validates loosely';
comment on column public.player_injuries.exempt_from_practice is 'When true, player is excused from practice for this injury';

-- Messages: soft delete / moderation
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists deleted_by uuid references public.users(id) on delete set null;
alter table public.messages add column if not exists removal_reason text;

create index if not exists idx_messages_thread_not_deleted on public.messages(thread_id, created_at desc) where deleted_at is null;

comment on column public.messages.deleted_at is 'Soft delete timestamp; null = visible';
comment on column public.messages.removal_reason is 'Optional moderator note (not shown to end users in full detail)';
