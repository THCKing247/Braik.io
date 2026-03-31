-- Player profile: medical alerts and emergency contact relationship (Health tab / coach portal).
alter table public.players add column if not exists medical_alerts text;
alter table public.players add column if not exists emergency_contact_relationship text;

comment on column public.players.medical_alerts is 'Short medical alert lines for coaches (separate from medical_notes).';
comment on column public.players.emergency_contact_relationship is 'Relationship to player for emergency_contact (e.g. Mother).';
