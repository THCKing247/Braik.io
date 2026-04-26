-- Player-submitted highlight posts on the team feed (player portal home).

create table if not exists public.team_highlight_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_team_highlight_posts_team_created
  on public.team_highlight_posts (team_id, created_at desc);

comment on table public.team_highlight_posts is 'Athlete-submitted highlight notes for the team feed; writes via Next.js API only.';

alter table public.team_highlight_posts enable row level security;

drop policy if exists team_highlight_posts_select_team_members on public.team_highlight_posts;
create policy team_highlight_posts_select_team_members on public.team_highlight_posts
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_highlight_posts.team_id
        and tm.user_id = auth.uid()
        and coalesce(tm.active, true)
    )
  );

grant select on public.team_highlight_posts to authenticated;
