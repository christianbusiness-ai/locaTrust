-- =============================================================================
-- LOCATRUST - MIGRATION DE DURCISSEMENT DE SÉCURITÉ (2026-10-09)
-- Protection RLS sur Subscriptions, Messages, Conversations et Propriétés
-- =============================================================================

-- 1. DURCISSEMENT DES PROPRIÉTÉS (WITH CHECK SUR LA MODIFICATION)
DROP POLICY IF EXISTS "properties_modify_own" ON public.properties;
CREATE POLICY "properties_modify_own" ON public.properties
  FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

-- 2. ACTIVATION RLS & POLICIES SUR LES ABONNEMENTS
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "subscriptions_modify_own" ON public.subscriptions;
CREATE POLICY "subscriptions_modify_own" ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 3. ACTIVATION RLS & POLICIES SUR LES PAIEMENTS D'ABONNEMENTS
ALTER TABLE IF EXISTS public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_payments_select_own" ON public.subscription_payments;
CREATE POLICY "subscription_payments_select_own" ON public.subscription_payments
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- 4. ACTIVATION RLS & POLICIES SUR LES CONVERSATIONS & MESSAGES
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_participate" ON public.conversations;
CREATE POLICY "conversations_participate" ON public.conversations
  FOR SELECT
  USING (auth.uid() = tenant_id OR auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "conversations_create" ON public.conversations;
CREATE POLICY "conversations_create" ON public.conversations
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id OR auth.uid() = owner_id OR public.is_admin());

ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_read_participate" ON public.messages;
CREATE POLICY "messages_read_participate" ON public.messages
  FOR SELECT
  USING (
    sender_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.tenant_id = auth.uid() OR c.owner_id = auth.uid())
    ) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "messages_send_own" ON public.messages;
CREATE POLICY "messages_send_own" ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.tenant_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );
