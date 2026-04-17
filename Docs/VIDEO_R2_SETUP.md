# Game video storage (Cloudflare R2)

Braik stores game film and derived thumbnails (future) in **Cloudflare R2** using the S3-compatible API. Metadata lives in Postgres (`game_videos`, `video_clips`, rollups, entitlements).

## Environment variables

Set these on the Next.js server (never expose secret keys to the browser):

| Variable | Required | Description |
|----------|----------|-------------|
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID used in the R2 S3 endpoint. |
| `R2_ACCESS_KEY_ID` | Yes | R2 API token access key. |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 API token secret. |
| `R2_BUCKET_NAME` | Yes | Private bucket name for master files and thumbnails. |
| `R2_ENDPOINT` | No | Overrides the default `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` if you need an explicit URL. |
| `R2_REGION` | No | Defaults to `auto` (Cloudflare R2). |
| `R2_PUBLIC_BASE_URL` | No | Reserved for optional public CDN base; playback uses signed GET URLs today. |

Optional AI clip assist reuses existing `OPENAI_API_KEY` (same as Coach B). Without it, uploads and clips still work; AI suggestion returns a clear error.

## Development: enable Game Video without DB toggles

When `NODE_ENV=development`, set:

| Variable | Purpose |
|----------|---------|
| `BRAIK_VIDEO_DEV_DEFAULTS` | If `true`, team / organization / athletic department video flags are treated as enabled for bootstrap and API gates so you can test uploads without editing rows. |

Production must leave this unset or `false`.

## Operational notes

- Playback uses **presigned GET URLs** (≈1 hour TTL). Increase TTL in `lib/video/constants.ts` if needed.
- Large uploads (>100 MiB default) use **multipart** uploads with per-part presigned PUT URLs.
- Apply the migration `20260417000000_video_r2_production.sql` so new columns and entitlement tables exist.
