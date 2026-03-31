-- Admin provisioning: platform invites, account statuses, org/team video flags,
-- user video permissions, game videos + clips scaffold, optional feature JSON.

-- ---------------------------------------------------------------------------
-- Organizations: feature JSON + video flag
-- ---------------------------------------------------------------------------
alter table public.organizations add column if not exists video_clips_enabled boolean not null default false;
alter table public.organizations add column if not exists feature_flags jsonb not null default '{}'::jsonb;

comment on column public.organizations.video_clips_enabled is 'When true, teams in this org may enable Game Video / Clips (also requires team.video_clips_enabled).';
comment on column public.organizations.feature_flags is 'Org-level feature toggles (extensible JSON).';

-- ---------------------------------------------------------------------------
-- Teams: video flag (effective with org when program_id links to org)
-- ---------------------------------------------------------------------------
alter table public.teams add column if not exists video_clips_enabled boolean not null default false;

comment on column public.teams.video_clips_enabled is 'Team toggle for Game Video / Clips; requires org.video_clips_enabled when linked via program.';

-- ---------------------------------------------------------------------------
-- User video permissions (overrides / entitlements for Game Video / Clips)
-- ---------------------------------------------------------------------------
create table if not exists public.user_video_permissions (
  user_id uuid primary key references public.users(id) on delete cascade,
  can_view_video boolean not null default false,
  can_upload_video boolean not null default false,
  can_create_clips boolean not null default false,
  can_share_clips boolean not null default false,
  can_delete_video boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_video_permissions_view on public.user_video_permissions(user_id) where can_view_video = true;

alter table public.user_video_permissions enable row level security;

drop policy if exists user_video_permissions_service_role on public.user_video_permissions;
create policy user_video_permissions_service_role on public.user_video_permissions for all using (true) with check (true);

comment on table public.user_video_permissions is 'Per-user Game Video / Clips entitlements; evaluated with org/team video_clips_enabled.';

-- ---------------------------------------------------------------------------
-- Optional: non-video feature overrides (JSON) — future flags without new columns
-- ---------------------------------------------------------------------------
create table if not exists public.user_feature_overrides (
  user_id uuid primary key references public.users(id) on delete cascade,
  flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_feature_overrides enable row level security;

drop policy if exists user_feature_overrides_service_role on public.user_feature_overrides;
create policy user_feature_overrides_service_role on public.user_feature_overrides for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Platform user invites (admin-created; tracks invite email flow — no secrets stored)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_user_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_role text not null,
  team_id uuid references public.teams(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  account_status text not null default 'invited',
  auth_user_id uuid references auth.users(id) on delete set null,
  invited_by_user_id uuid references public.users(id) on delete set null,
  invite_status text not null default 'pending'
    check (invite_status in ('pending', 'sent', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_user_invites_email on public.platform_user_invites(lower(email));
create index if not exists idx_platform_user_invites_auth_user on public.platform_user_invites(auth_user_id) where auth_user_id is not null;

alter table public.platform_user_invites enable row level security;

drop policy if exists platform_user_invites_service_role on public.platform_user_invites;
create policy platform_user_invites_service_role on public.platform_user_invites for all using (true) with check (true);

comment on table public.platform_user_invites is 'Admin-issued account invites; auth is handled by Supabase invite / magic link (no plaintext passwords).';

-- ---------------------------------------------------------------------------
-- Game videos + clips (scaffold — storage/player/editor wired later)
-- ---------------------------------------------------------------------------
create table if not exists public.game_videos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  title text,
  storage_path text,
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_videos_team_created on public.game_videos(team_id, created_at desc);

alter table public.game_videos enable row level security;

drop policy if exists game_videos_service_role on public.game_videos;
create policy game_videos_service_role on public.game_videos for all using (true) with check (true);

comment on table public.game_videos is 'TODO: wire Supabase Storage upload, transcoding, and playback.';
comment on column public.game_videos.storage_path is 'TODO: bucket path for master video file.';

create table if not exists public.video_clips (
  id uuid primary key default gen_random_uuid(),
  game_video_id uuid not null references public.game_videos(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  start_ms integer not null,
  end_ms integer not null,
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_video_clips_game_video on public.video_clips(game_video_id);
create index if not exists idx_video_clips_team on public.video_clips(team_id);

alter table public.video_clips enable row level security;

drop policy if exists video_clips_service_role on public.video_clips;
create policy video_clips_service_role on public.video_clips for all using (true) with check (true);

comment on table public.video_clips is 'TODO: clip editor UI, share links, and permissions enforcement.';
