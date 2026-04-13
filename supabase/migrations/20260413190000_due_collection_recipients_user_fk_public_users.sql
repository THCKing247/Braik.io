-- Align with players.user_id / team_members.user_id: recipient rows reference app users (public.users), not auth.users alone.

alter table public.fundraising_due_collection_recipients
  drop constraint if exists fundraising_due_collection_recipients_user_id_fkey;

alter table public.fundraising_due_collection_recipients
  add constraint fundraising_due_collection_recipients_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;
