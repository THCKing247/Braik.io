-- Sparse film preview strip metadata (optional WebP/JPEG tiles in R2); never full-frame archives.

alter table public.game_videos
  add column if not exists film_preview_manifest jsonb;

comment on column public.game_videos.film_preview_manifest is
  'Optional lightweight thumbnail strip: { version, intervalSec, status, tiles: [{ tMs, key }] } — sparse samples only.';
