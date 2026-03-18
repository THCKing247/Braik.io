# Netlify launch checklist

Use this when deploying Braik to Netlify.

## Build

- **Build command:** `npm run build` (set in `netlify.toml`)
- **Node:** 20 (set in `netlify.toml` via `NODE_VERSION`)
- **Plugin:** `@netlify/plugin-nextjs` (handles Next.js build and publish)

## Required environment variables

Set these in **Site settings → Environment variables** (or in Netlify UI):

| Variable | Required | Notes |
|----------|----------|--------|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side only; never expose to client |
| `AUTH_SECRET` | Recommended | Strong random string for session signing (e.g. `openssl rand -base64 32`) |

Optional (for full functionality):

| Variable | Used for |
|----------|----------|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS (e.g. player invites) |
| Stripe / billing vars | If you use Stripe |

Prebuild runs `scripts/verify-env.ts`, which **blocks the build** on Netlify/CI if any of the three required Supabase vars are missing.

## Before first deploy

1. Run `npm install` and `npm run build` locally (with the required env vars or after temporarily relaxing verify-env) to confirm the build passes.
2. Add all required env vars in Netlify.
3. Trigger a deploy; the plugin will build Next.js and deploy serverless functions.

## After deploy

- Confirm the site loads and auth works (login/signup).
- If you use Next.js `<Image>` with Supabase storage, add your Supabase hostname (e.g. `xyz.supabase.co`) to `next.config.js` under `images.domains`.
