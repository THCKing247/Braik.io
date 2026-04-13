-- Ensure due collection status allows pending / in_progress / completed (fixes saves when older check only allowed pending/collected).

alter table public.fundraising_due_collections drop constraint if exists fundraising_due_collections_status_check;

update public.fundraising_due_collections
set status = 'completed'
where status = 'collected';

alter table public.fundraising_due_collections
  add constraint fundraising_due_collections_status_check check (status in ('pending', 'in_progress', 'completed'));

comment on column public.fundraising_due_collections.amount_due is
  'Total collection goal for this due item; divide evenly among targeted recipients for expected share (tracking only).';
