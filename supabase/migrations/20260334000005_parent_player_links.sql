-- Parent-player links: explicit link table for parent accounts to player profiles (supplements guardian_links)

-- parent_player_links: links auth user (parent) to player profile; supports parent codes
create table if not exists public.parent_player_links (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  relationship text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_user_id, player_id)
);

create index if not exists idx_parent_player_links_parent on public.parent_player_links(parent_user_id);
create index if not exists idx_parent_player_links_player on public.parent_player_links(player_id);
alter table public.parent_player_links enable row level security;

drop policy if exists parent_player_links_service_role on public.parent_player_links;
create policy parent_player_links_service_role on public.parent_player_links for all using (true) with check (true);

comment on table public.parent_player_links is 'Links parent account (auth user) to player profile. Used with parent_link_invite codes.';
