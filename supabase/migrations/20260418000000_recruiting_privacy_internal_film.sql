-- Privacy flags for coach-controlled recruiter visibility; internal film surfaces on recruiting when not private.

alter table public.game_videos
  add column if not exists is_private boolean not null default false;

alter table public.video_clips
  add column if not exists is_private boolean not null default false;

comment on column public.game_videos.is_private is 'When true, hide this team film from public/recruiter recruiting surfaces.';
comment on column public.video_clips.is_private is 'When true, hide this clip from public/recruiter recruiting surfaces.';

create index if not exists idx_game_videos_team_recruiting_public
  on public.game_videos (team_id)
  where is_private = false and upload_status = 'ready';

create index if not exists idx_video_clips_team_private
  on public.video_clips (team_id, is_private);

-- New programs default to AI video features enabled (team overrides remain nullable).
alter table public.program_video_settings
  alter column ai_video_features_enabled set default true;
