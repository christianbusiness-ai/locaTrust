-- =============================================================================
-- LOCATRUST - MIGRATION DE SYNCHRONISATION MULTI-APPAREILS & RLS PERMISSIF
-- Date: 2026-10-19
-- Réf: Harmonisation Agence (KK) ↔ Propriétaire ↔ Locataire (Christian)
-- =============================================================================

-- 1. COLONNES AGENCES SUR PAIEMENTS, CAUTIONS ET REÇUS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'agency_id'
    ) THEN
        ALTER TABLE public.rent_payments ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'agency_id'
    ) THEN
        ALTER TABLE public.cautions ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'agency_id'
    ) THEN
        ALTER TABLE public.receipts ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. POLICIES SUR RENT_PAYMENTS
ALTER TABLE IF EXISTS public.rent_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rent_payments_select_parties" ON public.rent_payments;
DROP POLICY IF EXISTS "rent_payments_select" ON public.rent_payments;
CREATE POLICY "rent_payments_select_parties" ON public.rent_payments
  FOR SELECT USING (
    auth.uid() = tenant_id OR
    auth.uid() = owner_id OR
    (agency_id IS NOT NULL AND auth.uid() = agency_id) OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "rent_payments_insert_parties" ON public.rent_payments;
DROP POLICY IF EXISTS "rent_payments_insert_tenant" ON public.rent_payments;
CREATE POLICY "rent_payments_insert_parties" ON public.rent_payments
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "rent_payments_update_parties" ON public.rent_payments;
CREATE POLICY "rent_payments_update_parties" ON public.rent_payments
  FOR UPDATE USING (
    auth.uid() = owner_id OR
    auth.uid() = tenant_id OR
    (agency_id IS NOT NULL AND auth.uid() = agency_id) OR
    public.is_admin()
  );

-- 3. POLICIES SUR NOTIFICATIONS (PERMETTRE L'ENVOI TRANSVERSAL LOCATAIRE -> AGENCE/BAILLEUR)
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (
    auth.uid() = user_id OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "notifications_insert_cross" ON public.notifications;
CREATE POLICY "notifications_insert_cross" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (
    auth.uid() = user_id OR
    public.is_admin()
  );

-- 4. POLICIES SUR CAUTIONS
ALTER TABLE IF EXISTS public.cautions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cautions_select_parties" ON public.cautions;
CREATE POLICY "cautions_select_parties" ON public.cautions
  FOR SELECT USING (
    auth.uid() = tenant_id OR
    auth.uid() = owner_id OR
    (agency_id IS NOT NULL AND auth.uid() = agency_id) OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "cautions_insert_parties" ON public.cautions;
CREATE POLICY "cautions_insert_parties" ON public.cautions
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "cautions_update_parties" ON public.cautions;
CREATE POLICY "cautions_update_parties" ON public.cautions
  FOR UPDATE USING (
    auth.uid() = owner_id OR
    auth.uid() = tenant_id OR
    (agency_id IS NOT NULL AND auth.uid() = agency_id) OR
    public.is_admin()
  );

-- 5. POLICIES SUR REÇUS & QUITTANCES (RECEIPTS)
ALTER TABLE IF EXISTS public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipts_select_parties" ON public.receipts;
CREATE POLICY "receipts_select_parties" ON public.receipts
  FOR SELECT USING (
    auth.uid() = tenant_id OR
    auth.uid() = owner_id OR
    (agency_id IS NOT NULL AND auth.uid() = agency_id) OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "receipts_insert_parties" ON public.receipts;
CREATE POLICY "receipts_insert_parties" ON public.receipts
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "receipts_update_parties" ON public.receipts;
CREATE POLICY "receipts_update_parties" ON public.receipts
  FOR UPDATE USING (
    auth.uid() = owner_id OR
    auth.uid() = tenant_id OR
    (agency_id IS NOT NULL AND auth.uid() = agency_id) OR
    public.is_admin()
  );
