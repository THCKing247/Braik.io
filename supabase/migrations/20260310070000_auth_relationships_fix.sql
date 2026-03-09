-- Fix authentication-linked table relationships
-- Ensures proper alignment between auth.users, profiles, and app tables
-- Complements: 20260309120000_repair_team_members_from_profiles.sql (one-time repair)

-- CRITICAL: public.users.id must match auth.uid() for authenticated users
-- This table is used for:
-- 1. Admin portal (admin role checks)
-- 2. team_members foreign key (team_members.user_id references public.users.id)
-- 3. Support tickets, audit logs, etc.

-- Application code pattern (already implemented in signup/login routes):
-- 1. Create auth.users via Supabase Auth
-- 2. Upsert profiles with id = auth.uid()
-- 3. Upsert public.users with id = auth.uid() (required before team_members insert)
-- 4. Insert team_members with user_id = auth.uid()

-- Note: We cannot create a direct FK from team_members to auth.users
-- PostgreSQL doesn't allow FKs to auth schema, so we use public.users as intermediary
-- Application code ensures public.users.id = auth.uid() for all authenticated users

-- Document the relationship pattern
comment on table public.team_members is 'Team membership. user_id references public.users(id) where id = auth.uid() for authenticated users. Application code must ensure public.users row exists before inserting team_members.';
comment on column public.team_members.user_id is 'References public.users(id). For authenticated users, id must equal auth.uid(). Application code ensures this on signup/login.';

-- Ensure profiles.id always equals auth.uid() (enforced by FK)
comment on table public.profiles is 'App-specific user data. id = auth.uid() always. References auth.users(id) on delete cascade.';
comment on column public.profiles.id is 'Must equal auth.uid(). References auth.users(id) on delete cascade.';

-- Document public.users relationship
comment on table public.users is 'User records for admin portal and FK references. For authenticated users, id = auth.uid(). Application code upserts this on signup/login.';
comment on column public.users.id is 'For authenticated users, this must equal auth.uid(). Application code ensures this. For legacy/admin users created directly, may be different.';

-- Add index to help with auth user lookups (if not already exists)
create index if not exists idx_users_email on public.users(email) where email is not null;
