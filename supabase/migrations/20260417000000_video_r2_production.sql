-- Game video (R2) production: metadata, entitlements, storage rollups, AI job log, clip sharing.

-- ---------------------------------------------------------------------------
-- game_videos: full metadata (R2 keys, status, optional AI transcript fields)
-- ---------------------------------------------------------------------------
alter table public.game_videos
  add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.game_videos
  add column if not exists program_id uuid references public.programs(id) on delete set null;
alter table public.game_videos
  add column if not exists original_filename text;
alter table public.game_videos
  add column if not exists mime_type text;
alter table public.game_videos
  add column if not exists file_size_bytes bigint;
alter table public.game_videos
  add column if not exists storage_key text;
alter table public.game_videos
  add column if not exists upload_status text not null default 'pending';
alter table public.game_videos
  add column if not exists processing_status text not null default 'none';
alter table public.game_videos
  add column if not exists thumbnail_key text;
alter table public.game_videos
  add column if not exists transcript_text text;
alter table public.game_videos
  add column if not exists transcript_status text;
alter table public.game_videos
  add column if not exists error_message text;

-- Backfill storage_key from legacy storage_path
update public.game_videos
set storage_key = coalesce(storage_key, storage_path)
where storage_key is null and storage_path is not null;

comment on column public.game_videos.storage_key is 'R2 object key (S3 path) for the master file; storage_path kept for legacy reads.';
comment on column public.game_videos.upload_status is 'pending | uploading | ready | failed';
comment on column public.game_videos.processing_status is 'none | pending | processing | ready | failed (thumbs, transcode, etc.)';
comment on column public.game_videos.transcript_status is 'null | pending | ready | failed — for future ASR/AI text.';

create index if not exists idx_game_videos_program on public.game_videos(program_id) where program_id is not null;
create index if not exists idx_game_videos_org on public.game_videos(org_id) where org_id is not null;
create index if not exists idx_game_videos_upload_status on public.game_videos(team_id, upload_status);

-- ---------------------------------------------------------------------------
-- video_clips: titles, sharing, tags (tier-gated usage in app layer)
-- ---------------------------------------------------------------------------
alter table public.video_clips
  add column if not exists title text;
alter table public.video_clips
  add column if not exists description text;
alter table public.video_clips
  add column if not exists duration_ms integer;
alter table public.video_clips
  add column if not exists share_token uuid unique default gen_random_uuid();
alter table public.video_clips
  add column if not exists tags text[] not null default '{}'::text[];
alter table public.video_clips
  add column if not exists updated_at timestamptz not null default now();

update public.video_clips set title = coalesce(title, label) where title is null;

comment on column public.video_clips.share_token is 'Unguessable token for deep links; access still requires auth + team permission in API layer.';

create index if not exists idx_video_clips_share_token on public.video_clips(share_token) where share_token is not null;

-- ---------------------------------------------------------------------------
-- Program-level video defaults (teams inherit unless overridden)
-- ---------------------------------------------------------------------------
create table if not exists public.program_video_settings (
  program_id uuid primary key references public.programs(id) on delete cascade,
  capability_tier text not null default 'starter'
    check (capability_tier in ('starter', 'pro', 'elite', 'enterprise')),
  storage_cap_bytes bigint,
  shared_storage_scope text not null default 'team'
    check (shared_storage_scope in ('team', 'program')),
  ai_video_features_enabled boolean not null default false,
  tagging_enabled boolean not null default false,
  cross_team_library_enabled boolean not null default false,
  bulk_management_enabled boolean not null default false,
  advanced_clip_tools_enabled boolean not null default false,
  priority_processing_enabled boolean not null default false,
  max_clips integer,
  updated_at timestamptz not null default now()
);

alter table public.program_video_settings enable row level security;
drop policy if exists program_video_settings_service_role on public.program_video_settings;
create policy program_video_settings_service_role on public.program_video_settings for all using (true) with check (true);

comment on table public.program_video_settings is 'Program defaults for video capability tier and limits; teams may override via team_video_settings.';
comment on column public.program_video_settings.shared_storage_scope is 'team: per-team quota; program: pooled quota across teams in program (enterprise-style).';

-- ---------------------------------------------------------------------------
-- Team-level overrides (nullable columns = inherit from program defaults)
-- ---------------------------------------------------------------------------
create table if not exists public.team_video_settings (
  team_id uuid primary key references public.teams(id) on delete cascade,
  capability_tier text
    check (capability_tier is null or capability_tier in ('starter', 'pro', 'elite', 'enterprise')),
  storage_cap_bytes bigint,
  shared_storage_scope text
    check (shared_storage_scope is null or shared_storage_scope in ('team', 'program')),
  ai_video_features_enabled boolean,
  tagging_enabled boolean,
  cross_team_library_enabled boolean,
  bulk_management_enabled boolean,
  advanced_clip_tools_enabled boolean,
  priority_processing_enabled boolean,
  max_clips integer,
  updated_at timestamptz not null default now()
);

alter table public.team_video_settings enable row level security;
drop policy if exists team_video_settings_service_role on public.team_video_settings;
create policy team_video_settings_service_role on public.team_video_settings for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Usage rollups (maintained in application code on upload/delete)
-- ---------------------------------------------------------------------------
create table if not exists public.video_storage_rollups (
  team_id uuid primary key references public.teams(id) on delete cascade,
  bytes_used bigint not null default 0,
  video_count integer not null default 0,
  clip_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.video_storage_rollups enable row level security;
drop policy if exists video_storage_rollups_service_role on public.video_storage_rollups;
create policy video_storage_rollups_service_role on public.video_storage_rollups for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- AI jobs / suggestions (extensible pipeline; no fake video-understanding claims)
-- ---------------------------------------------------------------------------
create table if not exists public.video_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  game_video_id uuid references public.game_videos(id) on delete set null,
  video_clip_id uuid references public.video_clips(id) on delete set null,
  job_type text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  provider text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_video_ai_jobs_team on public.video_ai_jobs(team_id, created_at desc);
create index if not exists idx_video_ai_jobs_clip on public.video_ai_jobs(video_clip_id) where video_clip_id is not null;

alter table public.video_ai_jobs enable row level security;
drop policy if exists video_ai_jobs_service_role on public.video_ai_jobs;
create policy video_ai_jobs_service_role on public.video_ai_jobs for all using (true) with check (true);

comment on table public.video_ai_jobs is 'AI assist and future video intelligence jobs; orchestration separate from upload UI.';
