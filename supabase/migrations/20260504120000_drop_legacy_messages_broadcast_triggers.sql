-- INSERT into public.messages failed with 42883 when a legacy trigger called a non-existent
-- PostgreSQL helper (wrong name/signature vs current Supabase Realtime).
-- This migration removes such triggers on public.messages while keeping BrAIk's own
-- update_message_thread_updated_at_trigger.

DO $$
DECLARE
  trg RECORD;
  fn_src TEXT;
BEGIN
  FOR trg IN
    SELECT t.tgname::TEXT AS tg_name, p.oid AS fn_oid
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'messages'
      AND NOT t.tgisinternal
      AND t.tgname <> 'update_message_thread_updated_at_trigger'
  LOOP
    fn_src := pg_get_functiondef(trg.fn_oid);
    -- Drop only triggers whose function body references the obsolete SQL symbol (see migration comment above).
    IF fn_src ILIKE '%realtime.broadcast(%' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.messages', trg.tg_name);
      RAISE NOTICE 'Dropped trigger % on public.messages (obsolete realtime broadcast hook)', trg.tg_name;
    END IF;
  END LOOP;
END $$;
