-- =============================================================================
-- LOCATRUST - MIGRATION PHASE 4 : SYNCHRONISATION MULTI-APPAREILS
-- Tables réelles pour Messagerie (conversations & messages) et Mandats Agence
-- Idempotente et exécutable dans une transaction sécurisée.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- SECTION 1 : TABLE CONVERSATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_different_participants CHECK (participant_a <> participant_b)
);

CREATE INDEX IF NOT EXISTS idx_conversations_participant_a ON public.conversations(participant_a);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_b ON public.conversations(participant_b);
CREATE INDEX IF NOT EXISTS idx_conversations_property_id ON public.conversations(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- -----------------------------------------------------------------------------
-- SECTION 2 : TABLE MESSAGES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text',
  attachments JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(receiver_id, is_read) WHERE is_read = false;

-- Trigger pour mettre à jour automatiquement last_message_at sur conversation
CREATE OR REPLACE FUNCTION public.fn_update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      updated_at = timezone('utc'::text, now())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_update_conversation ON public.messages;
CREATE TRIGGER trg_messages_update_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_conversation_timestamp();

-- -----------------------------------------------------------------------------
-- SECTION 3 : TABLE AGENCY_MANDATES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  mandate_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'gestion_complete' CHECK (type IN ('gestion_complete', 'mandat_simple', 'mandat_exclusif')),
  status TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'expire', 'suspendu', 'resilie')),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 8.00,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  documents JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_agency_mandates_agency_id ON public.agency_mandates(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_mandates_owner_id ON public.agency_mandates(owner_id);
CREATE INDEX IF NOT EXISTS idx_agency_mandates_property_id ON public.agency_mandates(property_id);
CREATE INDEX IF NOT EXISTS idx_agency_mandates_status ON public.agency_mandates(status);

-- -----------------------------------------------------------------------------
-- SECTION 4 : SÉCURISATION ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

-- RLS CONVERSATIONS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (
    participant_a = auth.uid()
    OR participant_b = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT WITH CHECK (
    (participant_a = auth.uid() OR participant_b = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
CREATE POLICY "conversations_update" ON public.conversations
  FOR UPDATE USING (
    participant_a = auth.uid()
    OR participant_b = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;
CREATE POLICY "conversations_delete" ON public.conversations
  FOR DELETE USING (
    public.is_admin()
  );

-- RLS MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (
    receiver_id = auth.uid()
    OR sender_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "messages_delete" ON public.messages;
CREATE POLICY "messages_delete" ON public.messages
  FOR DELETE USING (
    sender_id = auth.uid()
    OR public.is_admin()
  );

-- RLS AGENCY_MANDATES
ALTER TABLE public.agency_mandates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_mandates_select" ON public.agency_mandates;
CREATE POLICY "agency_mandates_select" ON public.agency_mandates
  FOR SELECT USING (
    agency_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "agency_mandates_insert" ON public.agency_mandates;
CREATE POLICY "agency_mandates_insert" ON public.agency_mandates
  FOR INSERT WITH CHECK (
    agency_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "agency_mandates_update" ON public.agency_mandates;
CREATE POLICY "agency_mandates_update" ON public.agency_mandates
  FOR UPDATE USING (
    agency_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "agency_mandates_delete" ON public.agency_mandates;
CREATE POLICY "agency_mandates_delete" ON public.agency_mandates
  FOR DELETE USING (
    public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- SECTION 5 : FONCTIONS SÉCURISÉES D'AIDE À LA SYNCHRONISATION
-- -----------------------------------------------------------------------------

-- Fonction pour marquer atomiquement les messages d'une conversation comme lus
CREATE OR REPLACE FUNCTION public.mark_conversation_messages_read(
  p_conversation_id UUID,
  p_reader_id UUID DEFAULT auth.uid()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF p_reader_id IS NULL THEN
    p_reader_id := auth.uid();
  END IF;

  UPDATE public.messages
  SET is_read = true,
      status = 'read',
      read_at = timezone('utc'::text, now())
  WHERE conversation_id = p_conversation_id
    AND receiver_id = p_reader_id
    AND is_read = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- Fonction pour obtenir ou créer de manière idempotente une conversation
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_other_user_id UUID,
  p_property_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_conv_id UUID;
BEGIN
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  IF v_current_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'Impossible de créer une conversation avec soi-même';
  END IF;

  -- 1. Recherche d'une conversation existante entre les deux participants
  IF p_property_id IS NOT NULL THEN
    SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE property_id = p_property_id
      AND (
        (participant_a = v_current_user_id AND participant_b = p_other_user_id)
        OR (participant_a = p_other_user_id AND participant_b = v_current_user_id)
      )
    LIMIT 1;
  ELSE
    SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE (
        (participant_a = v_current_user_id AND participant_b = p_other_user_id)
        OR (participant_a = p_other_user_id AND participant_b = v_current_user_id)
      )
    ORDER BY last_message_at DESC
    LIMIT 1;
  END IF;

  -- 2. Si aucune conversation n'existe, création
  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (
      participant_a,
      participant_b,
      property_id,
      last_message_at
    ) VALUES (
      v_current_user_id,
      p_other_user_id,
      p_property_id,
      timezone('utc'::text, now())
    )
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- SECTION 6 : CONFIGURATION DU TEMPS RÉEL (REALTIME REPLICATION)
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.agency_mandates REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN
    -- Table déjà dans la publication
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN
    -- Table déjà dans la publication
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agency_mandates;
  EXCEPTION WHEN duplicate_object THEN
    -- Table déjà dans la publication
  END;
END $$;

COMMIT;

