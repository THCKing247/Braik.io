-- Add insurance + identification document types (matches lib/player-documents/constants DOCUMENT_TYPES).

alter table public.player_documents drop constraint if exists player_documents_document_type_check;

alter table public.player_documents
  add constraint player_documents_document_type_check
  check (
    document_type is null
    or document_type in (
      'physical',
      'waiver',
      'eligibility',
      'permission_slip',
      'medical_release',
      'media_consent',
      'insurance',
      'identification',
      'other'
    )
  );
