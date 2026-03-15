-- Recruiter Search Portal: recruiting profiles, video links, recruiter accounts, saved players, interest tracking

-- 1. player_recruiting_profiles: one per player, optional; created lazily
create table if not exists public.player_recruiting_profiles (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  graduation_year integer,
  height_feet integer,
  height_inches integer,
  weight_lbs integer,
  forty_time numeric(4,2),
  shuttle_time numeric(4,2),
  vertical_jump numeric(5,2),
  gpa numeric(3,2),
  slug text unique,
  recruiting_visibility boolean not null default false,
  stats_visible boolean not null default true,
  coach_notes_visible boolean not null default false,
  playbook_mastery_visible boolean not null default true,
  development_visible boolean not null default true,
  bio text,
  x_handle text,
  instagram_handle text,
  hudl_url text,
  youtube_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_recruiting_profiles_player on public.player_recruiting_profiles(player_id);
create index if not exists idx_player_recruiting_profiles_program on public.player_recruiting_profiles(program_id) where program_id is not null;
create index if not exists idx_player_recruiting_profiles_visibility on public.player_recruiting_profiles(recruiting_visibility) where recruiting_visibility = true;
create index if not exists idx_player_recruiting_profiles_graduation on public.player_recruiting_profiles(graduation_year) where graduation_year is not null;
create unique index if not exists idx_player_recruiting_profiles_slug on public.player_recruiting_profiles(slug) where slug is not null;
alter table public.player_recruiting_profiles enable row level security;

drop policy if exists player_recruiting_profiles_service_role on public.player_recruiting_profiles;
create policy player_recruiting_profiles_service_role on public.player_recruiting_profiles for all using (true) with check (true);

comment on table public.player_recruiting_profiles is 'Recruiting profile per player; visibility and section toggles control what recruiters see.';

-- 2. player_video_links: external video URLs (Hudl, YouTube, etc.)
create table if not exists public.player_video_links (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  video_type text not null check (video_type in ('highlight_film', 'full_game', 'practice_film', 'training_clip', 'other')),
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_video_links_player on public.player_video_links(player_id);
alter table public.player_video_links enable row level security;

drop policy if exists player_video_links_service_role on public.player_video_links;
create policy player_video_links_service_role on public.player_video_links for all using (true) with check (true);

comment on table public.player_video_links is 'External video links (Hudl, YouTube, Drive) per player for recruiting.';

-- 3. recruiter_accounts: users who can use the recruiter portal
create table if not exists public.recruiter_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  organization_name text,
  role_title text,
  focus_regions text,
  created_at timestamptz not null default now()
);

create index if not exists idx_recruiter_accounts_user on public.recruiter_accounts(user_id);
alter table public.recruiter_accounts enable row level security;

drop policy if exists recruiter_accounts_service_role on public.recruiter_accounts;
create policy recruiter_accounts_service_role on public.recruiter_accounts for all using (true) with check (true);

comment on table public.recruiter_accounts is 'Recruiter profile; links Braik user to recruiter portal access.';

-- 4. recruiter_saved_players: recruiter bookmarks
create table if not exists public.recruiter_saved_players (
  id uuid primary key default gen_random_uuid(),
  recruiter_user_id uuid not null references public.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique(recruiter_user_id, player_id)
);

create index if not exists idx_recruiter_saved_players_recruiter on public.recruiter_saved_players(recruiter_user_id);
create index if not exists idx_recruiter_saved_players_player on public.recruiter_saved_players(player_id);
alter table public.recruiter_saved_players enable row level security;

drop policy if exists recruiter_saved_players_service_role on public.recruiter_saved_players;
create policy recruiter_saved_players_service_role on public.recruiter_saved_players for all using (true) with check (true);

comment on table public.recruiter_saved_players is 'Players saved by a recruiter for quick access.';

-- 5. player_recruiter_interest: coach-logged interest from schools/recruiters
create table if not exists public.player_recruiter_interest (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  recruiter_user_id uuid references public.users(id) on delete set null,
  school_name text not null,
  coach_name text,
  position_interest text,
  status text not null check (status in ('watching', 'contacted', 'requested_film', 'camp_invite', 'offer', 'closed')),
  notes text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_recruiter_interest_player on public.player_recruiter_interest(player_id);
create index if not exists idx_player_recruiter_interest_recruiter on public.player_recruiter_interest(recruiter_user_id) where recruiter_user_id is not null;
create index if not exists idx_player_recruiter_interest_status on public.player_recruiter_interest(status);
alter table public.player_recruiter_interest enable row level security;

drop policy if exists player_recruiter_interest_service_role on public.player_recruiter_interest;
create policy player_recruiter_interest_service_role on public.player_recruiter_interest for all using (true) with check (true);

comment on table public.player_recruiter_interest is 'Recruiter/school interest logged by coaches per player.';
