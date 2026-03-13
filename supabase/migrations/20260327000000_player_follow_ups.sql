-- Player follow-ups: lightweight intervention tracking for coaches.
-- One row per follow-up; category aligns with readiness exceptions (physical, waiver, eligibility, guardian, equipment).

create table if not exists public.player_follow_ups (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  category text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_player_follow_ups_player_id on public.player_follow_ups(player_id);
create index if not exists idx_player_follow_ups_team_id on public.player_follow_ups(team_id);
create index if not exists idx_player_follow_ups_status on public.player_follow_ups(team_id, status);

alter table public.player_follow_ups enable row level security;

-- Coaches and team members can manage follow-ups via app (service role or auth checks in API).
create policy "Allow read for team members"
  on public.player_follow_ups for select
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = player_follow_ups.team_id
        and tm.user_id = auth.uid()
    )
  );

create policy "Allow insert for team members"
  on public.player_follow_ups for insert
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = player_follow_ups.team_id
        and tm.user_id = auth.uid()
    )
  );

create policy "Allow update for team members"
  on public.player_follow_ups for update
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = player_follow_ups.team_id
        and tm.user_id = auth.uid()
    )
  );

comment on column public.player_follow_ups.category is 'e.g. physical_follow_up, waiver_reminder, eligibility_review, guardian_contact_follow_up, equipment_follow_up';
comment on column public.player_follow_ups.status is 'open or resolved';
