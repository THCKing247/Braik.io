-- Optional visibility: coaches can hide a document from player view.
alter table public.player_documents add column if not exists visible_to_player boolean not null default true;
comment on column public.player_documents.visible_to_player is 'When false, only coaches see this document. Players see only rows where visible_to_player is true.';
