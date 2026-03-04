# Prisma to Supabase Migration

This document describes the refactor from Prisma to Supabase-only auth and database.

## Completed

- **Removed Prisma**: Deleted `prisma/` folder, `lib/prisma` client module, and all Prisma scripts/deps from package.json.
- **Env**: `DATABASE_URL` removed from `scripts/verify-env.ts` and health check.
- **Auth**: `lib/server-auth.ts` uses only Supabase session (`sb-access-token` cookie + `supabase.auth.getUser()`). No `braik_session` or custom cookie signing.
- **Login**: `app/api/auth/login/route.ts` uses `supabase.auth.signInWithPassword()` and sets only Supabase cookies. Upserts `public.users` for the current auth user.
- **Logout**: `app/api/auth/logout/route.ts` calls `supabase.auth.signOut()` and clears Supabase cookies only.
- **Session**: `app/api/auth/session/route.ts` uses `getServerSession()` (Supabase-based).
- **Dashboard layout**: Uses `getServerSession()` and loads teams via `team_members` + `teams` from Supabase.
- **Admin access / audit**: `lib/admin-access.ts`, `lib/admin-audit.ts` use Supabase `users` and `audit_logs`.
- **RBAC**: `lib/rbac.ts` uses `team_members` from Supabase.
- **Billing**: `lib/billing-state.ts` uses Supabase `teams`; `requireBillingPermission` no longer takes `prisma`.
- **Notifications**: `lib/notifications.ts` uses Supabase `notifications` table (or no-op if missing).
- **Compliance**: `lib/compliance-log.ts` uses Supabase `compliance_log`.
- **System config**: `lib/system-config-store.ts` uses Supabase `system_config`.
- **Team guards**: `lib/team-service-status.ts`, `lib/team-operation-guard.ts` use Supabase; callers no longer pass `prisma`.
- **Program codes**: `lib/program-codes.ts` uses Supabase `teams`.
- **Invite page**: `app/invite/[token]/page.tsx` and `invite/[token]/page.tsx` use Supabase `invites` and `teams`.
- **Events API**: `app/api/events/route.ts` uses Supabase `events` and `audit_logs`.
- **Invites API**: `app/api/invites/route.ts` uses Supabase `users`, `team_members`, `invites`, `audit_logs`.
- **Admin API**: `app/api/admin/users/route.ts`, `app/api/admin/audit-logs/route.ts` use Supabase.

## Supabase migrations

- `supabase/migrations/20260303000000_profiles_and_auth_sync.sql` adds:
  - `profiles` (id = auth.uid(), role, team_id, full_name, etc.)
  - `invites`
  - `compliance_log`
  - `events`
  - `notifications`
  - Team code columns on `teams`: `team_id_code`, `player_code`, `parent_code`

## Prisma fully removed

All Prisma imports and calls have been removed. Former Prisma-dependent API routes return 501 with message "Not migrated: Prisma removed. Use Supabase." Server utilities that used Prisma throw the same message. Pages that depended on Prisma show a placeholder: "This feature is temporarily unavailable while migrating to Supabase."

To restore functionality, migrate each of those call sites to use `getSupabaseAdminClient()` / Supabase client and Supabase table names (snake_case), e.g.:

- `supabase.from("users").select("*").eq("email", email).single()`
- `supabase.from("team_members").select(...).eq("team_id", teamId)`
- `supabase.from("teams").select(...).eq("id", teamId).single()`

## Netlify

Builds no longer require `DATABASE_URL` or Prisma. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and (if needed) `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_*` in the Netlify environment.
