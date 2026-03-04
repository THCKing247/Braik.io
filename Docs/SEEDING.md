# Supabase Dev Seeding

This project includes a secure seeding workflow for Supabase Auth + `public.profiles` + `public.teams`.

## Required environment variables

Server/admin seeding vars (required for API route + CLI):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Client app vars (required for browser Supabase usage):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional protection var:

- `SEED_KEY` (required to run `/api/dev/*` in production)

## Seed users endpoint

Route:

- `POST /api/dev/seed-users`

Behavior:

- Non-production: allowed by default
- Production: requires header `x-seed-key` matching `SEED_KEY`
- Uses Supabase Admin API (service role) only
- Idempotent: existing seed users are deleted and recreated

Example local call:

```bash
curl -X POST http://localhost:3000/api/dev/seed-users
```

Example production call (only if intentionally enabled):

```bash
curl -X POST https://YOUR_DOMAIN/api/dev/seed-users \
  -H "x-seed-key: YOUR_SEED_KEY"
```

## CLI seeding (preferred)

Run from project root:

```bash
npm run seed:users
```

Equivalent:

```bash
tsx scripts/seed-users.ts
```

Safety:

- Script refuses `NODE_ENV=production` unless `ALLOW_PROD_SEED=true`
- Script does not log passwords or secrets

## Verification checklist

After seeding, verify in Supabase:

1. **Auth -> Users**
   - Confirm demo/admin users exist and are email-confirmed
2. **Table Editor -> teams**
   - Confirm `Braik Demo Team` exists with invite code `DEMO123`
3. **Table Editor -> profiles**
   - Confirm users have expected roles and team mapping
   - Admin users are seeded with `team_id = null`

## Cleanup / disable after seeding

Recommended hardening after initial seed:

1. Remove or rename `app/api/dev/seed-users/route.ts`
2. Keep middleware protection for `/api/dev/*`
3. Rotate `SEED_KEY` (and optionally service role key if it was shared)
4. Avoid running seeding in production except controlled one-off maintenance

