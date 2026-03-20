-- Ensures team documents tables exist for environments that never ran
-- 20260309000000_players_documents_inventory.sql (or where public.documents was missing).
-- Requires public.teams and public.users (same FKs as the original schema).
do $$
begin
  if to_regclass('public.teams') is null or to_regclass('public.users') is null then
    raise warning '20260345000000_ensure_team_documents_stack: skipped — create public.teams and public.users first';
    return;
  end if;

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
    updated_at timestamptz not null default now(),
    extracted_text text,
    public_share_token text
  );

  -- Older installs: add columns the app expects
  alter table public.documents add column if not exists extracted_text text;
  alter table public.documents add column if not exists public_share_token text;

  create index if not exists idx_documents_team_id on public.documents(team_id);
  create index if not exists idx_documents_created_by on public.documents(created_by);

  create unique index if not exists documents_public_share_token_key
    on public.documents(public_share_token)
    where public_share_token is not null;

  comment on column public.documents.public_share_token is 'Opaque token for read-only access via /api/documents/public/[token].';

  alter table public.documents enable row level security;
  drop policy if exists documents_service_role on public.documents;
  create policy documents_service_role on public.documents for all using (true) with check (true);

  create table if not exists public.document_acknowledgements (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.documents(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique(document_id, user_id)
  );

  create index if not exists idx_document_acknowledgements_document_id
    on public.document_acknowledgements(document_id);

  alter table public.document_acknowledgements enable row level security;
  drop policy if exists document_acknowledgements_service_role on public.document_acknowledgements;
  create policy document_acknowledgements_service_role on public.document_acknowledgements
    for all using (true) with check (true);

  create table if not exists public.document_shares (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.documents(id) on delete cascade,
    shared_with_user_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique(document_id, shared_with_user_id)
  );

  create index if not exists idx_document_shares_document_id on public.document_shares(document_id);
  create index if not exists idx_document_shares_shared_with on public.document_shares(shared_with_user_id);

  alter table public.document_shares enable row level security;
  drop policy if exists document_shares_service_role on public.document_shares;
  create policy document_shares_service_role on public.document_shares for all using (true) with check (true);
end
$$;
