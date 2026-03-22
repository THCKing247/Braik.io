-- Secure player documents: metadata, private storage, audit, RLS, expiration.
-- Team/program participation paperwork (physicals, waivers, permission slips) — not medical records.

-- ---------------------------------------------------------------------------
-- 1) Extend player_documents (keep legacy columns for backward compatibility)
-- ---------------------------------------------------------------------------

alter table public.player_documents
  add column if not exists org_id uuid references public.organizations(id) on delete set null;

alter table public.player_documents
  add column if not exists program_id uuid references public.programs(id) on delete set null;

alter table public.player_documents
  add column if not exists uploaded_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.player_documents
  add column if not exists uploaded_for_profile_id uuid references public.profiles(id) on delete set null;

alter table public.player_documents
  add column if not exists document_type text;

alter table public.player_documents
  add column if not exists file_path text;

alter table public.player_documents
  add column if not exists file_size_bytes bigint;

alter table public.player_documents
  add column if not exists consent_acknowledged boolean not null default false;

alter table public.player_documents
  add column if not exists consent_text text;

alter table public.player_documents
  add column if not exists retention_days integer not null default 365;

alter table public.player_documents
  add column if not exists expires_at timestamptz;

alter table public.player_documents
  add column if not exists uploaded_at timestamptz not null default now();

alter table public.player_documents
  add column if not exists deleted_at timestamptz;

alter table public.player_documents
  add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.player_documents
  add column if not exists notes text;

alter table public.player_documents
  add column if not exists season_label text;

alter table public.player_documents
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'player_documents_document_type_check'
  ) then
    alter table public.player_documents
      add constraint player_documents_document_type_check
      check (
        document_type is null
        or document_type in ('physical', 'waiver', 'permission_slip', 'other')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'player_documents_status_check'
  ) then
    alter table public.player_documents
      add constraint player_documents_status_check
      check (status in ('active', 'expired', 'deleted'));
  end if;
end $$;

comment on column public.player_documents.file_path is 'Private storage object path in bucket player-documents (no public URL). Legacy rows may use file_url for local disk instead.';
comment on column public.player_documents.uploaded_for_profile_id is 'When a parent uploads for a child, may reference the child profile id.';
comment on column public.player_documents.visible_to_player is 'Coach visibility toggle (legacy). Separate from health dashboard.';

-- Backfill new columns from legacy data
update public.player_documents pd
set
  document_type = case
    when pd.category is not null and lower(trim(pd.category)) in ('physical', 'waiver', 'permission_slip', 'other')
      then lower(trim(pd.category))
    when pd.category is not null and pd.category <> ''
      then 'other'
    else 'other'
  end
where pd.document_type is null;

update public.player_documents
set file_size_bytes = coalesce(file_size_bytes, file_size)
where file_size_bytes is null;

update public.player_documents
set uploaded_by_profile_id = created_by
where uploaded_by_profile_id is null
  and created_by is not null
  and exists (select 1 from public.profiles p where p.id = created_by);

update public.player_documents
set uploaded_at = coalesce(uploaded_at, created_at, now())
where uploaded_at is null;

update public.player_documents
set retention_days = 365
where retention_days is null;

update public.player_documents
set expires_at = uploaded_at + (retention_days || ' days')::interval
where expires_at is null;

update public.player_documents
set consent_text = coalesce(
  consent_text,
  'Legacy record; consent not recorded at upload time.'
)
where consent_text is null;

update public.player_documents
set consent_acknowledged = true
where consent_text is not null and consent_acknowledged = false;

alter table public.player_documents alter column consent_text set not null;

create index if not exists idx_player_documents_org_id on public.player_documents(org_id) where org_id is not null;
create index if not exists idx_player_documents_program_id on public.player_documents(program_id) where program_id is not null;
create index if not exists idx_player_documents_uploaded_by on public.player_documents(uploaded_by_profile_id) where uploaded_by_profile_id is not null;
create index if not exists idx_player_documents_status on public.player_documents(status);
create index if not exists idx_player_documents_expires_at on public.player_documents(expires_at);
create index if not exists idx_player_documents_deleted_at on public.player_documents(deleted_at) where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- 2) Audit log (API uses service role; RLS restricts direct client reads)
-- ---------------------------------------------------------------------------

create table if not exists public.document_access_audit (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.player_documents(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_role text,
  action text not null,
  access_method text,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint document_access_audit_action_check check (
    action in (
      'upload',
      'view',
      'download',
      'delete',
      'restore',
      'signed_url_generated',
      'bulk_export'
    )
  )
);

create index if not exists idx_document_access_audit_document_id on public.document_access_audit(document_id);
create index if not exists idx_document_access_audit_actor on public.document_access_audit(actor_profile_id);
create index if not exists idx_document_access_audit_action on public.document_access_audit(action);
create index if not exists idx_document_access_audit_created_at on public.document_access_audit(created_at desc);

comment on table public.document_access_audit is 'Access trail for player participation documents. Query via admin API (service role).';

alter table public.document_access_audit enable row level security;

-- Admin / platform profiles may read audit rows (direct Supabase client use)
drop policy if exists document_access_audit_admin_select on public.document_access_audit;
create policy document_access_audit_admin_select on public.document_access_audit
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(replace(coalesce(p.role, ''), '-', '_')) in ('admin', 'school_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Helper functions for RLS (JWT / PostgREST)
-- ---------------------------------------------------------------------------

create or replace function public.normalize_profile_role(p_role text)
returns text
language sql
immutable
as $$
  select lower(replace(coalesce(p_role, ''), '-', '_'));
$$;

create or replace function public.is_linked_parent_to_player(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_player_links ppl
    where ppl.parent_user_id = auth.uid()
      and ppl.player_id = p_player_id
  )
  or exists (
    select 1
    from public.guardian_links gl
    join public.guardians g on g.id = gl.guardian_id
    where gl.player_id = p_player_id
      and g.user_id = auth.uid()
  );
$$;

create or replace function public.player_documents_team_role(p_team_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(replace(coalesce(tm.role, ''), '-', '_'))
  from public.team_members tm
  where tm.team_id = p_team_id
    and tm.user_id = auth.uid()
    and tm.active = true
  limit 1;
$$;

create or replace function public.player_is_self(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players pl
    where pl.id = p_player_id
      and pl.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 4) RLS on player_documents (replace permissive open policy)
-- ---------------------------------------------------------------------------

alter table public.player_documents enable row level security;

drop policy if exists player_documents_service_role on public.player_documents;

-- SELECT
drop policy if exists player_documents_select_scoped on public.player_documents;
create policy player_documents_select_scoped on public.player_documents
  for select to authenticated
  using (
    deleted_at is null
    and (
      public.player_is_self(player_id)
      or public.is_linked_parent_to_player(player_id)
      or (
        public.player_documents_team_role(team_id) in ('head_coach', 'assistant_coach')
        and public.is_team_member(team_id)
      )
      or (
        public.normalize_profile_role((select role from public.profiles where id = auth.uid())) = 'athletic_director'
        and public.is_athletic_director_team_access(team_id)
      )
    )
  );

-- INSERT: player (self) or linked parent only — coaches use API/service role for legacy flows
drop policy if exists player_documents_insert_player_parent on public.player_documents;
create policy player_documents_insert_player_parent on public.player_documents
  for insert to authenticated
  with check (
    consent_acknowledged = true
    and uploaded_by_profile_id = auth.uid()
    and exists (
      select 1 from public.players pl
      where pl.id = player_id and pl.team_id = team_id
    )
    and (
      (
        public.player_is_self(player_id)
        and (uploaded_for_profile_id is null or uploaded_for_profile_id = auth.uid())
      )
      or public.is_linked_parent_to_player(player_id)
    )
    and (
      public.is_team_member(team_id)
      or public.player_is_self(player_id)
      or public.is_linked_parent_to_player(player_id)
    )
  );

-- UPDATE: soft-delete or notes by privileged roles (narrow)
drop policy if exists player_documents_update_privileged on public.player_documents;
create policy player_documents_update_privileged on public.player_documents
  for update to authenticated
  using (
    deleted_at is null
    and (
      (
        (public.player_is_self(player_id) or public.is_linked_parent_to_player(player_id))
        and uploaded_by_profile_id = auth.uid()
      )
      or (
        public.player_documents_team_role(team_id) = 'head_coach'
        and public.is_team_member(team_id)
      )
      or (
        public.normalize_profile_role((select role from public.profiles where id = auth.uid())) = 'athletic_director'
        and public.is_athletic_director_team_access(team_id)
      )
      or public.normalize_profile_role((select role from public.profiles where id = auth.uid())) = 'admin'
    )
  )
  with check (true);

-- Hard DELETE denied for JWT users (API uses soft delete)
drop policy if exists player_documents_delete_denied on public.player_documents;
create policy player_documents_delete_denied on public.player_documents
  for delete to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- 5) Private storage bucket (signed URLs from server only)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('player-documents', 'player-documents', false)
on conflict (id) do update set public = excluded.public;

-- Optional: tighten limits in Dashboard → Storage → player-documents (15MB, allowed MIME types).

-- No storage policies for authenticated — only service role / signed URLs

-- ---------------------------------------------------------------------------
-- 6) Mark expired rows (schedule via pg_cron or external job)
-- ---------------------------------------------------------------------------

create or replace function public.mark_expired_player_documents()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.player_documents
  set
    status = 'expired',
    updated_at = now()
  where deleted_at is null
    and expires_at < now()
    and status = 'active';
  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.mark_expired_player_documents() is
  'Sets status=expired for active rows past expires_at. Safe to run on a schedule; does not delete files.';
