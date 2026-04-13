-- Team documents: persist binaries in private Supabase Storage instead of ephemeral server disk.
-- New uploads set file_path (object key in bucket team-documents); legacy rows keep file_url only.

alter table public.documents add column if not exists file_path text;

comment on column public.documents.file_path is
  'Private storage object path in bucket team-documents. When set, file bytes are loaded from Storage; legacy rows may use file_url for local disk only.';

insert into storage.buckets (id, name, public)
values ('team-documents', 'team-documents', false)
on conflict (id) do update set public = excluded.public;
