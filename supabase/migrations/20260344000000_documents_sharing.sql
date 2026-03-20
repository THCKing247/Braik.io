-- Minimal document sharing: direct user shares + optional public link token
-- Order-safe: no-op until base tables exist.
do $$
begin
  if to_regclass('public.documents') is not null then
    alter table public.documents add column if not exists public_share_token text;
    create unique index if not exists documents_public_share_token_key
      on public.documents(public_share_token)
      where public_share_token is not null;
    comment on column public.documents.public_share_token is 'Opaque token for read-only access via /api/documents/public/[token].';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.documents') is not null and to_regclass('public.users') is not null then
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
  end if;
end
$$;
