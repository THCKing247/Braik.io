-- Pending uploads: attachment row may exist before the message is inserted.
alter table public.message_attachments alter column message_id drop not null;

-- Private bucket; uploads and downloads go through the API (service role).
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do update set public = excluded.public;
