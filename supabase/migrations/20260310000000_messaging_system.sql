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

drop trigger if exists update_message_thread_updated_at_trigger on public.messages;

create trigger update_message_thread_updated_at_trigger
after insert on public.messages
for each row
execute function public.update_message_thread_updated_at();
