# Supabase Migration Checklist

This document lists all migrations that need to be run in Supabase, in order.

## ✅ Already Completed
- `team_members` table - Created
- Helper functions - Created (`is_team_member`, `get_team_role`, `can_edit_roster`, `can_manage_team`)
- `depth_chart_entries` table - Exists
- `depth_chart_position_labels` table - Exists
- `players` table - Exists

## 📋 Remaining Migrations to Run

### Step 1: Check What Tables Exist
Run this query in Supabase SQL Editor to see what's missing:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'inventory_items',
    'documents',
    'document_acknowledgements',
    'message_threads',
    'messages',
    'message_thread_participants',
    'message_attachments',
    'playbooks',
    'plays',
    'collections',
    'invoices',
    'transactions',
    'memberships',
    'seasons',
    'games',
    'guardians',
    'guardian_links'
  )
ORDER BY table_name;
```

### Step 2: Run Missing Migrations

Run each migration below in the Supabase SQL Editor, one at a time, in this order:

---

## Migration 1: Inventory Items, Documents, Players
**File:** `20260309000000_players_documents_inventory.sql`

**Run this if `inventory_items`, `documents`, or `document_acknowledgements` are missing:**

```sql
-- Players (roster), documents, and inventory for dashboard GET APIs
-- Used by RosterManagerEnhanced, DocumentsManager, InventoryManager

-- Players: team roster
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  grade integer,
  jersey_number integer,
  position_group text,
  status text not null default 'active',
  notes text,
  image_url text,
  user_id uuid references public.users(id) on delete set null,
  email text,
  invite_code text,
  invite_status text,
  claimed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_players_team_id on public.players(team_id);
create index if not exists idx_players_user_id on public.players(user_id) where user_id is not null;
alter table public.players enable row level security;

-- Documents: team documents (waivers, playbooks, etc.)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  file_name text not null,
  file_url text,
  file_size bigint,
  mime_type text,
  category text not null default 'other',
  folder text,
  visibility text not null default 'all',
  scoped_unit text,
  scoped_position_groups jsonb,
  assigned_player_ids jsonb,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_team_id on public.documents(team_id);
create index if not exists idx_documents_created_by on public.documents(created_by);
alter table public.documents enable row level security;

-- Document acknowledgements (optional: for tracking who viewed/signed)
create table if not exists public.document_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(document_id, user_id)
);

create index if not exists idx_document_acknowledgements_document_id on public.document_acknowledgements(document_id);
alter table public.document_acknowledgements enable row level security;

-- Inventory items: team equipment
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  category text not null,
  name text not null,
  quantity_total integer not null default 0,
  quantity_available integer not null default 0,
  condition text not null default 'GOOD',
  assigned_to_player_id uuid references public.players(id) on delete set null,
  notes text,
  status text not null default 'AVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_items_team_id on public.inventory_items(team_id);
create index if not exists idx_inventory_items_assigned on public.inventory_items(assigned_to_player_id) where assigned_to_player_id is not null;
alter table public.inventory_items enable row level security;

-- RLS: allow service role full access (API uses service role)
drop policy if exists players_service_role on public.players;
create policy players_service_role on public.players for all using (true) with check (true);

drop policy if exists documents_service_role on public.documents;
create policy documents_service_role on public.documents for all using (true) with check (true);

drop policy if exists document_acknowledgements_service_role on public.document_acknowledgements;
create policy document_acknowledgements_service_role on public.document_acknowledgements for all using (true) with check (true);

drop policy if exists inventory_items_service_role on public.inventory_items;
create policy inventory_items_service_role on public.inventory_items for all using (true) with check (true);
```

---

## Migration 2: Messaging System
**File:** `20260310000000_messaging_system.sql`

**Run this if any messaging tables are missing:**

```sql
-- Messaging system: threads, messages, attachments, participants
-- Supports team messaging with thread-based conversations

-- Message threads: conversation containers
create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text,
  thread_type text not null default 'general', -- 'general', 'parent_player_coach', 'group'
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_message_threads_team_id on public.message_threads(team_id);
create index if not exists idx_message_threads_created_by on public.message_threads(created_by);
create index if not exists idx_message_threads_updated_at on public.message_threads(updated_at desc);
alter table public.message_threads enable row level security;

-- Message thread participants: who can see/participate in threads
create table if not exists public.message_thread_participants (
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (thread_id, user_id)
);

create index if not exists idx_message_thread_participants_thread_id on public.message_thread_participants(thread_id);
create index if not exists idx_message_thread_participants_user_id on public.message_thread_participants(user_id);
alter table public.message_thread_participants enable row level security;

-- Messages: individual messages within threads
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_messages_thread_id on public.messages(thread_id);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
alter table public.messages enable row level security;

-- Message attachments: file attachments for messages
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  thread_id uuid not null references public.message_threads(id) on delete cascade, -- Denormalized for efficient access checks
  team_id uuid not null references public.teams(id) on delete cascade, -- Denormalized for efficient access checks
  file_name text not null,
  file_url text not null, -- Secure path, not public URL
  file_size bigint not null,
  mime_type text not null,
  uploaded_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_attachments_message_id on public.message_attachments(message_id);
create index if not exists idx_message_attachments_thread_id on public.message_attachments(thread_id);
create index if not exists idx_message_attachments_team_id on public.message_attachments(team_id);
alter table public.message_attachments enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists message_threads_service_role on public.message_threads;
create policy message_threads_service_role on public.message_threads for all using (true) with check (true);

drop policy if exists message_thread_participants_service_role on public.message_thread_participants;
create policy message_thread_participants_service_role on public.message_thread_participants for all using (true) with check (true);

drop policy if exists messages_service_role on public.messages;
create policy messages_service_role on public.messages for all using (true) with check (true);

drop policy if exists message_attachments_service_role on public.message_attachments;
create policy message_attachments_service_role on public.message_attachments for all using (true) with check (true);

-- Function to update thread updated_at when message is created
create or replace function public.update_message_thread_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.message_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

create trigger update_message_thread_updated_at_trigger
after insert on public.messages
for each row
execute function public.update_message_thread_updated_at();
```

---

## Migration 3: Plays and Playbooks
**File:** `20260310010000_plays_playbooks.sql`

**Run this if `playbooks` or `plays` tables are missing:**

```sql
-- Plays and Playbooks: team play management
-- Supports playbook creation, organization, and play storage

-- Playbooks: collections of plays organized by team
create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  visibility text not null default 'team', -- 'team', 'offense', 'defense', 'special_teams'
  nodes jsonb not null default '{}'::jsonb, -- PlaybookNode structure
  root_by_side jsonb not null default '{}'::jsonb, -- Root nodes by side of ball
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_playbooks_team_id on public.playbooks(team_id);
create index if not exists idx_playbooks_visibility on public.playbooks(visibility);
alter table public.playbooks enable row level security;

-- Plays: individual plays that can belong to playbooks
create table if not exists public.plays (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  playbook_id uuid references public.playbooks(id) on delete set null,
  side text not null, -- 'offense', 'defense', 'special_teams'
  formation text not null,
  subcategory text,
  name text not null,
  canvas_data jsonb, -- Play canvas/drawing data
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plays_team_id on public.plays(team_id);
create index if not exists idx_plays_playbook_id on public.plays(playbook_id) where playbook_id is not null;
create index if not exists idx_plays_side on public.plays(side);
alter table public.plays enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists playbooks_service_role on public.playbooks;
create policy playbooks_service_role on public.playbooks for all using (true) with check (true);

drop policy if exists plays_service_role on public.plays;
create policy plays_service_role on public.plays for all using (true) with check (true);
```

---

## Migration 4: Payments and Collections
**File:** `20260310030000_payments_collections.sql`

**Run this if payment-related tables are missing:**

```sql
-- Payments and Collections: team payment management
-- Supports roster dues, custom collections, invoices, and transactions

-- Collections: payment collection campaigns (roster dues or custom)
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  collection_type text not null, -- 'roster-dues', 'custom'
  title text not null,
  description text,
  amount numeric(10,2) not null default 0,
  status text not null default 'open', -- 'open', 'closed'
  due_date timestamptz,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collections_team_id on public.collections(team_id);
create index if not exists idx_collections_status on public.collections(status);
create index if not exists idx_collections_type on public.collections(collection_type);
alter table public.collections enable row level security;

-- Invoices: individual payment obligations per player
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  payer_user_id uuid references public.users(id) on delete set null, -- Parent or player who pays
  amount_due numeric(10,2) not null,
  amount_paid numeric(10,2) not null default 0,
  status text not null default 'pending', -- 'pending', 'paid', 'partial', 'overdue'
  invoice_id text, -- External invoice ID if applicable
  date timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_collection_id on public.invoices(collection_id);
create index if not exists idx_invoices_player_id on public.invoices(player_id);
create index if not exists idx_invoices_payer_user_id on public.invoices(payer_user_id) where payer_user_id is not null;
create index if not exists idx_invoices_status on public.invoices(status);
alter table public.invoices enable row level security;

-- Transactions: payment records (cash, card, etc.)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  amount numeric(10,2) not null,
  payment_method text not null, -- 'cash', 'card', 'check', 'other'
  payment_type text not null, -- 'payment', 'refund', 'adjustment'
  processed_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_invoice_id on public.transactions(invoice_id);
create index if not exists idx_transactions_collection_id on public.transactions(collection_id);
create index if not exists idx_transactions_processed_by on public.transactions(processed_by) where processed_by is not null;
alter table public.transactions enable row level security;

-- Memberships: team membership records (may overlap with team_members but for payment context)
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null,
  position_groups jsonb, -- Array of position groups for coordinators
  permissions jsonb, -- Permissions object with coordinatorType, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create index if not exists idx_memberships_team_id on public.memberships(team_id);
create index if not exists idx_memberships_user_id on public.memberships(user_id);
create index if not exists idx_memberships_role on public.memberships(role);
alter table public.memberships enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists collections_service_role on public.collections;
create policy collections_service_role on public.collections for all using (true) with check (true);

drop policy if exists invoices_service_role on public.invoices;
create policy invoices_service_role on public.invoices for all using (true) with check (true);

drop policy if exists transactions_service_role on public.transactions;
create policy transactions_service_role on public.transactions for all using (true) with check (true);

drop policy if exists memberships_service_role on public.memberships;
create policy memberships_service_role on public.memberships for all using (true) with check (true);

-- Function to update invoice amount_paid when transaction is created/updated
create or replace function public.update_invoice_amount_paid()
returns trigger
language plpgsql
as $$
begin
  update public.invoices
  set amount_paid = (
    select coalesce(sum(amount), 0)
    from public.transactions
    where invoice_id = new.invoice_id
      and payment_type = 'payment'
  ),
  status = case
    when (select coalesce(sum(amount), 0) from public.transactions where invoice_id = new.invoice_id and payment_type = 'payment') >= amount_due then 'paid'
    when (select coalesce(sum(amount), 0) from public.transactions where invoice_id = new.invoice_id and payment_type = 'payment') > 0 then 'partial'
    else 'pending'
  end,
  paid_at = case
    when (select coalesce(sum(amount), 0) from public.transactions where invoice_id = new.invoice_id and payment_type = 'payment') >= amount_due 
      and paid_at is null then now()
    else paid_at
  end,
  updated_at = now()
  where id = new.invoice_id;
  return new;
end;
$$;

create trigger update_invoice_amount_paid_trigger
after insert or update on public.transactions
for each row
execute function public.update_invoice_amount_paid();
```

---

## Migration 5: Seasons and Games
**File:** `20260310040000_seasons_games.sql`

**Run this if `seasons` or `games` tables are missing:**

```sql
-- Seasons and Games: team season management and game records
-- Supports season tracking, game scheduling, and record keeping

-- Seasons: team seasons with division, conference, and playoff info
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  year integer not null,
  name text, -- e.g., "2024 Fall Season"
  division text, -- e.g., "5A", "Division I"
  conference text, -- e.g., "Big 12", "Metro Conference"
  playoff_ruleset text, -- Playoff qualification rules
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, year)
);

create index if not exists idx_seasons_team_id on public.seasons(team_id);
create index if not exists idx_seasons_year on public.seasons(year desc);
alter table public.seasons enable row level security;

-- Games: individual games within seasons
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  opponent text,
  game_date timestamptz not null,
  location text,
  game_type text, -- 'regular', 'playoff', 'scrimmage', 'tournament'
  conference_game boolean not null default false,
  result text, -- 'win', 'loss', 'tie', null if not played yet
  team_score integer,
  opponent_score integer,
  confirmed_by_coach boolean not null default false,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_games_season_id on public.games(season_id);
create index if not exists idx_games_team_id on public.games(team_id);
create index if not exists idx_games_game_date on public.games(game_date);
create index if not exists idx_games_confirmed on public.games(confirmed_by_coach, result) where confirmed_by_coach = true and result is not null;
alter table public.games enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists seasons_service_role on public.seasons;
create policy seasons_service_role on public.seasons for all using (true) with check (true);

drop policy if exists games_service_role on public.games;
create policy games_service_role on public.games for all using (true) with check (true);
```

---

## Migration 6: Guardians
**File:** `20260310050000_guardians.sql`

**Run this if `guardians` or `guardian_links` tables are missing:**

```sql
-- Guardians and Guardian Links: parent-player relationships
-- Supports parent accounts linking to player accounts for high school teams

-- Guardians: parent/guardian user accounts
create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  email text,
  relationship text, -- 'parent', 'guardian', 'other'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create index if not exists idx_guardians_user_id on public.guardians(user_id);
alter table public.guardians enable row level security;

-- Guardian links: many-to-many relationship between guardians and players
create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  relationship text, -- 'parent', 'guardian', 'other'
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(guardian_id, player_id)
);

create index if not exists idx_guardian_links_guardian_id on public.guardian_links(guardian_id);
create index if not exists idx_guardian_links_player_id on public.guardian_links(player_id);
alter table public.guardian_links enable row level security;

-- RLS: Allow service role full access (API uses service role)
drop policy if exists guardians_service_role on public.guardians;
create policy guardians_service_role on public.guardians for all using (true) with check (true);

drop policy if exists guardian_links_service_role on public.guardian_links;
create policy guardian_links_service_role on public.guardian_links for all using (true) with check (true);
```

---

## Migration 7: Teams Additional Fields
**File:** `20260310060000_teams_additional_fields.sql`

**Run this to add missing columns to teams table:**

```sql
-- Additional team fields: fields referenced in code but not yet in schema
-- Based on DASHBOARD_DATA_REQUIREMENTS.md and code references

-- Add missing team fields
alter table public.teams add column if not exists slogan text;
alter table public.teams add column if not exists logo_url text;
alter table public.teams add column if not exists season_name text;
alter table public.teams add column if not exists dues_amount numeric(10,2);
alter table public.teams add column if not exists dues_due_date timestamptz;
alter table public.teams add column if not exists service_status text default 'ACTIVE'; -- For team suspension checks

-- Add indexes for new fields if needed
create index if not exists idx_teams_service_status on public.teams(service_status) where service_status is not null;
```

---

## Migration 8: Auth Relationships Fix
**File:** `20260310070000_auth_relationships_fix.sql`

**Run this to add documentation and indexes:**

```sql
-- Fix authentication-linked table relationships
-- Ensures proper alignment between auth.users, profiles, and app tables

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
```

---

## Migration 9: RLS Policies for Migrated Tables
**File:** `20260311000000_rls_policies_migrated_tables.sql`

**⚠️ IMPORTANT: This is a large migration. Run it after all tables are created.**

This migration adds proper RLS policies for all the migrated tables. Since it's very long, you should run the entire file from `supabase/migrations/20260311000000_rls_policies_migrated_tables.sql`.

**Note:** The helper functions should already exist (we created them earlier), but this migration will recreate them if needed.

---

## Migration 10: RLS Policies for Inventory, Players, Documents
**File:** `20260312000000_rls_policies_inventory_players_documents.sql`

**Run this after Migration 9:**

This migration adds specific RLS policies for inventory, players, and documents. Run the entire file from `supabase/migrations/20260312000000_rls_policies_inventory_players_documents.sql`.

---

## Verification Steps

After running all migrations, verify everything is set up:

### 1. Check All Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### 2. Check Helper Functions Exist
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'is_team_member',
    'get_team_role',
    'can_edit_roster',
    'can_manage_team',
    'is_thread_participant',
    'can_access_player'
  )
ORDER BY routine_name;
```

### 3. Check RLS is Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'inventory_items',
    'message_threads',
    'plays',
    'collections',
    'seasons',
    'guardians'
  )
ORDER BY tablename;
```

All should show `rowsecurity = true`.

---

## Summary

1. ✅ **Depth Chart Modal Fix** - Completed (returns to roster view when closed)
2. ⏳ **Supabase Migrations** - Run the migrations above in order
3. ✅ **Helper Functions** - Already created
4. ✅ **Team Members Table** - Already created

After running all migrations, your Supabase database will be fully set up!
