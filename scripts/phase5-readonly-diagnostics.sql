-- Phase 5 read-only diagnostics — run in Supabase SQL editor or psql (no writes).
-- Review results before any DDL. Do not run destructive statements from this file.

-- ---------------------------------------------------------------------------
-- Table activity (sequential vs index scans)
-- ---------------------------------------------------------------------------
select
  schemaname,
  relname as table_name,
  n_live_tup,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
from pg_stat_user_tables
where schemaname = 'public'
order by seq_tup_read desc
limit 50;

-- ---------------------------------------------------------------------------
-- Messaging / notifications / team hot tables only (narrow view)
-- ---------------------------------------------------------------------------
select
  relname as table_name,
  n_live_tup,
  seq_scan,
  idx_scan,
  seq_tup_read
from pg_stat_user_tables
where schemaname = 'public'
  and relname in (
    'messages',
    'message_threads',
    'message_thread_participants',
    'message_attachments',
    'notifications',
    'team_members',
    'players',
    'profiles',
    'events',
    'games'
  )
order by seq_tup_read desc nulls last;

-- ---------------------------------------------------------------------------
-- Index usage on key tables (find “unused” indexes before dropping anything)
-- ---------------------------------------------------------------------------
select
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
from pg_stat_user_indexes
where schemaname = 'public'
  and relname in (
    'messages',
    'message_threads',
    'message_thread_participants',
    'notifications'
  )
order by idx_scan asc nulls first, pg_relation_size(indexrelid) desc;

-- ---------------------------------------------------------------------------
-- Index definitions (compare duplicates / advisor naming)
-- ---------------------------------------------------------------------------
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('messages', 'message_threads', 'message_thread_participants', 'notifications')
order by tablename, indexname;

-- ---------------------------------------------------------------------------
-- Optional: pg_stat_statements (enable extension in Supabase if not on)
-- ---------------------------------------------------------------------------
-- select * from pg_stat_statements where query ilike '%messages%' order by total_exec_time desc limit 20;
