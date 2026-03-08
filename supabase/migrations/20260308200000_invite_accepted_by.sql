-- Track who accepted the invite (optional, for audit)
alter table public.invites add column if not exists accepted_by uuid references auth.users(id) on delete set null;
create index if not exists idx_invites_accepted_by on public.invites(accepted_by) where accepted_by is not null;
