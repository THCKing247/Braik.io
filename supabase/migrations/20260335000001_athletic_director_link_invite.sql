-- Add invite code type for linking existing head coach program to an Athletic Director organization

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'invite_code_type' and e.enumlabel = 'athletic_director_link_invite'
  ) then
    alter type public.invite_code_type add value 'athletic_director_link_invite';
  end if;
end $$;

-- Optional metadata for target program (e.g. program name hint; not required for validation)
alter table public.invite_codes add column if not exists metadata jsonb;

comment on column public.invite_codes.metadata is 'Optional metadata, e.g. for athletic_director_link_invite: target_program_name or notes.';
