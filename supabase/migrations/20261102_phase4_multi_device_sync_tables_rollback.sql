-- =============================================================================
-- LOCATRUST - ROLLBACK PHASE 4 : ANNULATION TABLES MULTI-APPAREILS
-- Fichier : supabase/migrations/20261102_phase4_multi_device_sync_tables_rollback.sql
-- =============================================================================

BEGIN;

-- 1. Retrait des tables de la publication Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.agency_mandates;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.conversations;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 2. Suppression des fonctions et triggers
DROP FUNCTION IF EXISTS public.mark_conversation_messages_read(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_or_create_conversation(UUID, UUID);
DROP TRIGGER IF EXISTS trg_messages_update_conversation ON public.messages;
DROP FUNCTION IF EXISTS public.fn_update_conversation_timestamp();

-- 3. Suppression des tables
DROP TABLE IF EXISTS public.agency_mandates CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;

COMMIT;

