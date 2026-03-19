-- Ensure teams has columns required by requireTeamOperationAccess (team-operation-guard).
-- Fixes "Team lookup failed" 500 when create event runs against DBs where 20260226 did not apply.
-- Safe to run multiple times.

alter table public.teams add column if not exists team_status text not null default 'active';
alter table public.teams add column if not exists subscription_status text not null default 'active';
alter table public.teams add column if not exists base_ai_credits integer not null default 0;

comment on column public.teams.team_status is 'Used by team-operation-guard for write/AI access. active = allowed.';
comment on column public.teams.subscription_status is 'Used by team-operation-guard for billing. active = allowed when BILLING_ENFORCED.';
