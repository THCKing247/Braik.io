-- ============================================================
-- Braik: Announcement Engagement (Reactions · Comments · Views)
-- ============================================================

-- ── 1. Reactions ─────────────────────────────────────────────

create table if not exists public.team_announcement_reactions (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null
    references public.team_announcements(id) on delete cascade,
  user_id         uuid not null
    references public.profiles(id) on delete cascade,
  user_role       text not null default 'player',
  emoji           text not null
    check (emoji in ('🔥', '💪', '❤️', '👍', '👀')),
  created_at      timestamptz not null default now(),
  constraint team_announcement_reactions_unique unique (announcement_id, user_id, emoji)
);

create index if not exists idx_tar_announcement_id
  on public.team_announcement_reactions (announcement_id);
create index if not exists idx_tar_user_id
  on public.team_announcement_reactions (user_id);

alter table public.team_announcement_reactions enable row level security;

create policy "team_members_read_reactions"
  on public.team_announcement_reactions for select to authenticated
  using (
    exists (
      select 1 from public.team_announcements ta
      where ta.id = team_announcement_reactions.announcement_id
        and public.team_announcement_visible_to_reader(ta.team_id, ta.audience)
    )
  );

create policy "own_reaction_insert"
  on public.team_announcement_reactions for insert to authenticated
  with check (user_id = auth.uid());

create policy "own_reaction_delete"
  on public.team_announcement_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Aggregate view: counts per announcement per emoji
create or replace view public.team_announcement_reaction_counts as
  select
    announcement_id,
    emoji,
    count(*)::int                                                          as total_count,
    count(*) filter (where lower(user_role) = 'player')::int              as player_count,
    count(*) filter (where lower(user_role) = 'parent')::int              as parent_count,
    count(*) filter (where lower(user_role) not in ('player','parent'))::int as staff_count,
    max(created_at)                                                        as last_reacted_at
  from public.team_announcement_reactions
  group by announcement_id, emoji;

grant select on public.team_announcement_reaction_counts to authenticated;

-- ── 2. Comments ──────────────────────────────────────────────

create table if not exists public.team_announcement_comments (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null
    references public.team_announcements(id) on delete cascade,
  -- null = top-level comment; non-null = reply to that parent
  parent_id       uuid references public.team_announcement_comments(id) on delete cascade,
  user_id         uuid not null
    references public.profiles(id) on delete cascade,
  author_name     text,
  author_role     text not null default 'player',
  body            text not null check (char_length(body) >= 1 and char_length(body) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_tac_announcement_id
  on public.team_announcement_comments (announcement_id);
create index if not exists idx_tac_parent_id
  on public.team_announcement_comments (parent_id);

alter table public.team_announcement_comments enable row level security;

-- Team members can read comments on announcements visible to them
create policy "team_members_read_comments"
  on public.team_announcement_comments for select to authenticated
  using (
    exists (
      select 1 from public.team_announcements ta
      where ta.id = team_announcement_comments.announcement_id
        and public.team_announcement_visible_to_reader(ta.team_id, ta.audience)
    )
  );

-- Any team member can post a comment (role enforcement happens in the API)
create policy "team_members_insert_comments"
  on public.team_announcement_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.team_announcements ta
      where ta.id = team_announcement_comments.announcement_id
        and public.team_announcement_visible_to_reader(ta.team_id, ta.audience)
    )
  );

-- Users can delete their own comments; coaches can delete any in their team
create policy "own_comment_delete"
  on public.team_announcement_comments for delete to authenticated
  using (user_id = auth.uid());

-- ── 3. Views (read receipts) ──────────────────────────────────

create table if not exists public.team_announcement_views (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null
    references public.team_announcements(id) on delete cascade,
  user_id         uuid not null
    references public.profiles(id) on delete cascade,
  viewed_at       timestamptz not null default now(),
  constraint team_announcement_views_unique unique (announcement_id, user_id)
);

create index if not exists idx_tav_announcement_id
  on public.team_announcement_views (announcement_id);
create index if not exists idx_tav_user_id
  on public.team_announcement_views (user_id);

alter table public.team_announcement_views enable row level security;

create policy "team_members_read_views"
  on public.team_announcement_views for select to authenticated
  using (
    exists (
      select 1 from public.team_announcements ta
      where ta.id = team_announcement_views.announcement_id
        and public.team_announcement_visible_to_reader(ta.team_id, ta.audience)
    )
  );

create policy "own_view_insert"
  on public.team_announcement_views for insert to authenticated
  with check (user_id = auth.uid());

-- Aggregate view: view counts per announcement
create or replace view public.team_announcement_view_counts as
  select
    announcement_id,
    count(*)::int as total_views,
    max(viewed_at) as last_viewed_at
  from public.team_announcement_views
  group by announcement_id;

grant select on public.team_announcement_view_counts to authenticated;

-- ── Enable Realtime (run separately after table creation) ─────
-- alter publication supabase_realtime add table public.team_announcement_reactions;
-- alter publication supabase_realtime add table public.team_announcement_comments;
-- alter publication supabase_realtime add table public.team_announcement_views;
