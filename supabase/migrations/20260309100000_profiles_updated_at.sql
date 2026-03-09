-- Add updated_at to profiles if missing (schema may have been created without it)
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
