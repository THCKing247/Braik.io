-- Extracted text storage for Coach B document intelligence.
-- Enables summarization of uploaded PDF, TXT, and DOCX content.

alter table public.player_documents add column if not exists extracted_text text;
comment on column public.player_documents.extracted_text is 'Plain text extracted from the document for AI summarization (PDF, TXT, DOCX).';

alter table public.documents add column if not exists extracted_text text;
comment on column public.documents.extracted_text is 'Plain text extracted from the document for AI summarization (PDF, TXT, DOCX).';
