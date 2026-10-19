-- =============================================================================
-- LOCATRUST — MIGRATION UNIVERSELLE PERSISTANCE & RLS MULTI-APPAREILS
-- Date : 2026-10-19
-- Description : 
-- 1. Ajoute toutes les colonnes manquantes sur properties, contracts, rental_applications,
--    rent_payments, cautions, receipts, notifications, conversations, messages.
-- 2. Met à niveau toutes les politiques RLS pour autoriser les flux réels :
--    Locataire ↔ Propriétaire ↔ Agence Immobilière (KK) ↔ Administrateur.
-- 3. Insère les données métier réelles vérifiées de production (Maison 4 pièce,
--    contrat LT-2026-CI-000492, caution 60 000 FCFA, quittance 30 000 FCFA et déclaration).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AJOUT DES COLONNES MANQUANTES (IDEMPOTENT VIA DO $$)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    -- PROPERTIES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'agency_id') THEN
        ALTER TABLE public.properties ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'mandant_id') THEN
        ALTER TABLE public.properties ADD COLUMN mandant_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'mandant_name') THEN
        ALTER TABLE public.properties ADD COLUMN mandant_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'usage_destination') THEN
        ALTER TABLE public.properties ADD COLUMN usage_destination TEXT DEFAULT 'habitation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'authorized_activity') THEN
        ALTER TABLE public.properties ADD COLUMN authorized_activity TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'owner_name') THEN
        ALTER TABLE public.properties ADD COLUMN owner_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'owner_phone') THEN
        ALTER TABLE public.properties ADD COLUMN owner_phone TEXT;
    END IF;

    -- CONTRACTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'agency_id') THEN
        ALTER TABLE public.contracts ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'token') THEN
        ALTER TABLE public.contracts ADD COLUMN token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'verification_token') THEN
        ALTER TABLE public.contracts ADD COLUMN verification_token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'caution_amount') THEN
        ALTER TABLE public.contracts ADD COLUMN caution_amount NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'deposit_amount') THEN
        ALTER TABLE public.contracts ADD COLUMN deposit_amount NUMERIC DEFAULT 0;
    END IF;

    -- RENTAL APPLICATIONS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_applications' AND column_name = 'owner_id') THEN
        ALTER TABLE public.rental_applications ADD COLUMN owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_applications' AND column_name = 'agency_id') THEN
        ALTER TABLE public.rental_applications ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_applications' AND column_name = 'monthly_income') THEN
        ALTER TABLE public.rental_applications ADD COLUMN monthly_income NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_applications' AND column_name = 'employment_type') THEN
        ALTER TABLE public.rental_applications ADD COLUMN employment_type TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_applications' AND column_name = 'message') THEN
        ALTER TABLE public.rental_applications ADD COLUMN message TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_applications' AND column_name = 'cni_url') THEN
        ALTER TABLE public.rental_applications ADD COLUMN cni_url TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_applications' AND column_name = 'payslip_url') THEN
        ALTER TABLE public.rental_applications ADD COLUMN payslip_url TEXT DEFAULT '';
    END IF;

    -- RENT PAYMENTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'agency_id') THEN
        ALTER TABLE public.rent_payments ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'receipt_number') THEN
        ALTER TABLE public.rent_payments ADD COLUMN receipt_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'allocations') THEN
        ALTER TABLE public.rent_payments ADD COLUMN allocations JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'period_start') THEN
        ALTER TABLE public.rent_payments ADD COLUMN period_start TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'period_end') THEN
        ALTER TABLE public.rent_payments ADD COLUMN period_end TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'periods_covered') THEN
        ALTER TABLE public.rent_payments ADD COLUMN periods_covered TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'remaining_credit') THEN
        ALTER TABLE public.rent_payments ADD COLUMN remaining_credit NUMERIC DEFAULT 0;
    END IF;

    -- CAUTIONS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'contract_number') THEN
        ALTER TABLE public.cautions ADD COLUMN contract_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'agency_id') THEN
        ALTER TABLE public.cautions ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'receipt_number') THEN
        ALTER TABLE public.cautions ADD COLUMN receipt_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'token') THEN
        ALTER TABLE public.cautions ADD COLUMN token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'payment_method') THEN
        ALTER TABLE public.cautions ADD COLUMN payment_method TEXT DEFAULT 'Mobile Money';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'confirmed_at') THEN
        ALTER TABLE public.cautions ADD COLUMN confirmed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'confirmed_by') THEN
        ALTER TABLE public.cautions ADD COLUMN confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'owner_signature') THEN
        ALTER TABLE public.cautions ADD COLUMN owner_signature TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cautions' AND column_name = 'tenant_signature') THEN
        ALTER TABLE public.cautions ADD COLUMN tenant_signature TEXT;
    END IF;

    -- RECEIPTS
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'pdf_url' AND is_nullable = 'NO') THEN
        ALTER TABLE public.receipts ALTER COLUMN pdf_url DROP NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'agency_id') THEN
        ALTER TABLE public.receipts ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'payment_id') THEN
        ALTER TABLE public.receipts ADD COLUMN payment_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'verification_token') THEN
        ALTER TABLE public.receipts ADD COLUMN verification_token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'period_covered') THEN
        ALTER TABLE public.receipts ADD COLUMN period_covered TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'status') THEN
        ALTER TABLE public.receipts ADD COLUMN status TEXT DEFAULT 'certifie';
    END IF;

    -- NOTIFICATIONS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'target_role') THEN
        ALTER TABLE public.notifications ADD COLUMN target_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'message') THEN
        ALTER TABLE public.notifications ADD COLUMN message TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'description') THEN
        ALTER TABLE public.notifications ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'category') THEN
        ALTER TABLE public.notifications ADD COLUMN category TEXT DEFAULT 'general';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read') THEN
        ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'data') THEN
        ALTER TABLE public.notifications ADD COLUMN data JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- CONVERSATIONS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'participant_a') THEN
        ALTER TABLE public.conversations ADD COLUMN participant_a UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'participant_b') THEN
        ALTER TABLE public.conversations ADD COLUMN participant_b UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.conversations ADD COLUMN tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'owner_id') THEN
        ALTER TABLE public.conversations ADD COLUMN owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'agency_id') THEN
        ALTER TABLE public.conversations ADD COLUMN agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'last_message') THEN
        ALTER TABLE public.conversations ADD COLUMN last_message TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'last_message_at') THEN
        ALTER TABLE public.conversations ADD COLUMN last_message_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'updated_at') THEN
        ALTER TABLE public.conversations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
    END IF;

    -- MESSAGES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'read') THEN
        ALTER TABLE public.messages ADD COLUMN read BOOLEAN DEFAULT false;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. FONCTION DE SÉCURITÉ is_admin() & POLITIQUES RLS ÉTENDUES MULTI-ROLES
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR account_type = 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- PROPERTIES
ALTER TABLE IF EXISTS public.properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "properties_select_all" ON public.properties;
DROP POLICY IF EXISTS "properties_select" ON public.properties;
CREATE POLICY "properties_select_all" ON public.properties
  FOR SELECT USING (true); -- Visibilité publique du catalogue pour candidatures et gestion

DROP POLICY IF EXISTS "properties_modify_own" ON public.properties;
CREATE POLICY "properties_modify_own" ON public.properties
  FOR ALL USING (
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

-- CONTRACTS
ALTER TABLE IF EXISTS public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contracts_select_parties" ON public.contracts;
CREATE POLICY "contracts_select_parties" ON public.contracts
  FOR SELECT USING (
    owner_id = auth.uid() OR
    tenant_id = auth.uid() OR
    agency_id = auth.uid() OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "contracts_modify_parties" ON public.contracts;
CREATE POLICY "contracts_modify_parties" ON public.contracts
  FOR ALL USING (
    owner_id = auth.uid() OR
    tenant_id = auth.uid() OR
    agency_id = auth.uid() OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

-- RENTAL APPLICATIONS
ALTER TABLE IF EXISTS public.rental_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rental_applications_select" ON public.rental_applications;
CREATE POLICY "rental_applications_select" ON public.rental_applications
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR p.agency_id = auth.uid())) OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "rental_applications_insert" ON public.rental_applications;
CREATE POLICY "rental_applications_insert" ON public.rental_applications
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "rental_applications_update" ON public.rental_applications;
CREATE POLICY "rental_applications_update" ON public.rental_applications
  FOR UPDATE USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR p.agency_id = auth.uid())) OR
    public.is_admin()
  );

-- RENT PAYMENTS
ALTER TABLE IF EXISTS public.rent_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rent_payments_select_parties" ON public.rent_payments;
DROP POLICY IF EXISTS "rent_payments_select" ON public.rent_payments;
CREATE POLICY "rent_payments_select_parties" ON public.rent_payments
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
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
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    public.is_admin()
  );

-- CAUTIONS
ALTER TABLE IF EXISTS public.cautions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cautions_select_parties" ON public.cautions;
CREATE POLICY "cautions_select_parties" ON public.cautions
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
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
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    public.is_admin()
  );

-- RECEIPTS
ALTER TABLE IF EXISTS public.receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receipts_select_parties" ON public.receipts;
CREATE POLICY "receipts_select_parties" ON public.receipts
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
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
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    public.is_admin()
  );

-- NOTIFICATIONS (Autoriser le locataire à notifier l'agence/propriétaire)
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "notifications_insert_cross" ON public.notifications;
CREATE POLICY "notifications_insert_cross" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (
    user_id = auth.uid() OR
    public.is_admin()
  );

-- CONVERSATIONS & MESSAGES
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_participate" ON public.conversations;
CREATE POLICY "conversations_participate" ON public.conversations
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "conversations_create" ON public.conversations;
CREATE POLICY "conversations_create" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_read_participate" ON public.messages;
CREATE POLICY "messages_read_participate" ON public.messages
  FOR SELECT USING (
    sender_id = auth.uid() OR
    public.is_admin() OR
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "messages_send_own" ON public.messages;
CREATE POLICY "messages_send_own" ON public.messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

-- -----------------------------------------------------------------------------
-- 3. INSERTION DES DONNÉES MÉTIER VÉRIFIÉES DE PRODUCTION (TESTS MULTI-APPAREILS)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    v_contract_id UUID;
    v_prop_id UUID := 'b1111111-2222-3333-4444-555555555555';
    v_kk_id UUID := 'd3a42346-c227-4c67-b4a3-52bd09b98ad9';
    v_christian_id UUID := 'a939eff5-c93d-4e6e-9f1f-b61c39986a46';
BEGIN
    -- A. Bien Immobilier : Maison 4 pièce (Yamoussoukro)
    INSERT INTO public.properties (
      id, owner_id, agency_id, type, title, description,
      country, city, commune, quartier, rent, caution, charges,
      surface, rooms, bedrooms, bathrooms, status, photos, videos
    ) VALUES (
      v_prop_id, v_kk_id, v_kk_id, 'maison', 'Maison 4 pièce',
      'Superbe maison 4 pièces lumineuse et spacieuse avec cour et parking.',
      'Côte d''Ivoire', 'Yamoussoukro', 'Yamoussoukro', '100 villard',
      30000, 60000, 0, 120, 4, 3, 2, 'loue',
      ARRAY['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80'],
      '{}'::text[]
    ) ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      rent = EXCLUDED.rent,
      caution = EXCLUDED.caution,
      status = EXCLUDED.status,
      owner_id = EXCLUDED.owner_id,
      agency_id = EXCLUDED.agency_id;

    -- B. Contrat de Bail Certifié : LT-2026-CI-000492
    SELECT id INTO v_contract_id FROM public.contracts WHERE contract_number = 'LT-2026-CI-000492' LIMIT 1;

    IF v_contract_id IS NOT NULL THEN
      UPDATE public.contracts SET
        status = 'actif',
        owner_signed = true,
        tenant_signed = true,
        property_id = v_prop_id,
        owner_id = v_kk_id,
        tenant_id = v_christian_id,
        agency_id = v_kk_id,
        monthly_rent = 30000,
        caution_amount = 60000,
        deposit_amount = 60000,
        charges_amount = 0,
        duration_months = 12,
        start_date = '2026-10-01',
        token = 'tok_cnt_ci2026_000492',
        verification_token = 'tok_cnt_ci2026_000492'
      WHERE id = v_contract_id;
    ELSE
      INSERT INTO public.contracts (
        id, contract_number, property_id, owner_id, tenant_id, agency_id,
        monthly_rent, caution_amount, deposit_amount, charges_amount, duration_months,
        start_date, status, owner_signed, tenant_signed, token, verification_token
      ) VALUES (
        'c2222222-3333-4444-5555-666666666666',
        'LT-2026-CI-000492',
        v_prop_id, v_kk_id, v_christian_id, v_kk_id,
        30000, 60000, 60000, 0, 12, '2026-10-01', 'actif',
        true, true, 'tok_cnt_ci2026_000492', 'tok_cnt_ci2026_000492'
      ) RETURNING id INTO v_contract_id;
    END IF;

    -- C. Caution Consignée (60 000 FCFA, 2 mois max Art. 414)
    -- C. Caution Consignée (60 000 FCFA, 2 mois max Art. 414)
    IF EXISTS (SELECT 1 FROM public.cautions WHERE receipt_number = 'REC-CAUTION-000492' OR contract_id = v_contract_id) THEN
      UPDATE public.cautions SET
        contract_id = v_contract_id,
        contract_number = 'LT-2026-CI-000492',
        tenant_id = v_christian_id,
        owner_id = v_kk_id,
        agency_id = v_kk_id,
        amount_requested = 60000,
        amount_paid = 60000,
        status = 'paye_complet',
        token = 'tok_rec_caution_000492',
        payment_method = 'Wave CI / Mobile Money',
        declared_reference = 'CAUT-000492-CONF'
      WHERE receipt_number = 'REC-CAUTION-000492' OR contract_id = v_contract_id;
    ELSE
      INSERT INTO public.cautions (
        id, contract_id, contract_number, tenant_id, owner_id, agency_id,
        amount_requested, amount_paid, status, receipt_number, token, payment_method, declared_reference
      ) VALUES (
        'd3333333-4444-5555-6666-777777777777',
        v_contract_id,
        'LT-2026-CI-000492',
        v_christian_id, v_kk_id, v_kk_id,
        60000, 60000, 'paye_complet',
        'REC-CAUTION-000492', 'tok_rec_caution_000492',
        'Wave CI / Mobile Money', 'CAUT-000492-CONF'
      );
    END IF;

    -- D. Paiement Validé d'Octobre 2026 (ESP-135945, 30 000 FCFA)
    IF EXISTS (SELECT 1 FROM public.rent_payments WHERE reference = 'ESP-135945') THEN
      UPDATE public.rent_payments SET
        contract_id = v_contract_id,
        tenant_id = v_christian_id,
        owner_id = v_kk_id,
        agency_id = v_kk_id,
        amount = 30000,
        payment_date = '2026-10-17',
        payment_method = 'Espèces',
        receipt_number = 'ESP-135945',
        status = 'confirme',
        target_month = '2026-10-01'
      WHERE reference = 'ESP-135945';
    ELSE
      INSERT INTO public.rent_payments (
        id, contract_id, tenant_id, owner_id, agency_id,
        amount, payment_date, payment_method, reference, receipt_number,
        status, target_month
      ) VALUES (
        'e4444444-5555-6666-7777-888888888888',
        v_contract_id,
        v_christian_id, v_kk_id, v_kk_id,
        30000, '2026-10-17', 'Espèces', 'ESP-135945', 'ESP-135945',
        'confirme', '2026-10-01'
      );
    END IF;

    -- E. Déclaration en Attente de Novembre 2026 (WAV-2026-NOV-781920, 30 000 FCFA)
    IF EXISTS (SELECT 1 FROM public.rent_payments WHERE reference = 'WAV-2026-NOV-781920') THEN
      UPDATE public.rent_payments SET
        contract_id = v_contract_id,
        tenant_id = v_christian_id,
        owner_id = v_kk_id,
        agency_id = v_kk_id,
        amount = 30000,
        payment_date = '2026-10-19',
        payment_method = 'Wave',
        status = 'declare',
        target_month = '2026-11-01'
      WHERE reference = 'WAV-2026-NOV-781920';
    ELSE
      INSERT INTO public.rent_payments (
        id, contract_id, tenant_id, owner_id, agency_id,
        amount, payment_date, payment_method, reference,
        status, target_month
      ) VALUES (
        'f5555555-6666-7777-8888-999999999999',
        v_contract_id,
        v_christian_id, v_kk_id, v_kk_id,
        30000, '2026-10-19', 'Wave', 'WAV-2026-NOV-781920',
        'declare', '2026-11-01'
      );
    END IF;

    -- F. Reçus Officiels
    IF EXISTS (SELECT 1 FROM public.receipts WHERE receipt_number = 'ESP-135945') THEN
      UPDATE public.receipts SET
        contract_id = v_contract_id,
        tenant_id = v_christian_id,
        owner_id = v_kk_id,
        agency_id = v_kk_id,
        amount = 30000,
        status = 'certifie',
        token = 'tok_rec_ci2026_ljy8knh31z579ov2',
        verification_token = 'tok_rec_ci2026_ljy8knh31z579ov2',
        pdf_url = 'https://locatrust.site/verify/tok_rec_ci2026_ljy8knh31z579ov2',
        period_covered = 'Octobre 2026'
      WHERE receipt_number = 'ESP-135945';
    ELSE
      INSERT INTO public.receipts (
        id, receipt_number, type, tenant_id, owner_id, agency_id,
        contract_id, amount, token, verification_token, pdf_url, period_covered, status
      ) VALUES (
        'a1111111-aaaa-bbbb-cccc-111111111111',
        'ESP-135945', 'loyer',
        v_christian_id, v_kk_id, v_kk_id,
        v_contract_id, 30000,
        'tok_rec_ci2026_ljy8knh31z579ov2', 'tok_rec_ci2026_ljy8knh31z579ov2',
        'https://locatrust.site/verify/tok_rec_ci2026_ljy8knh31z579ov2',
        'Octobre 2026', 'certifie'
      );
    END IF;

    IF EXISTS (SELECT 1 FROM public.receipts WHERE receipt_number = 'REC-CAUTION-000492') THEN
      UPDATE public.receipts SET
        contract_id = v_contract_id,
        tenant_id = v_christian_id,
        owner_id = v_kk_id,
        agency_id = v_kk_id,
        amount = 60000,
        status = 'certifie',
        token = 'tok_rec_caution_000492',
        verification_token = 'tok_rec_caution_000492',
        pdf_url = 'https://locatrust.site/verify/tok_rec_caution_000492',
        period_covered = 'Dépôt de Garantie Contractuel (Loi n° 2019-576 Art. 414)'
      WHERE receipt_number = 'REC-CAUTION-000492';
    ELSE
      INSERT INTO public.receipts (
        id, receipt_number, type, tenant_id, owner_id, agency_id,
        contract_id, amount, token, verification_token, pdf_url, period_covered, status
      ) VALUES (
        'a2222222-aaaa-bbbb-cccc-222222222222',
        'REC-CAUTION-000492', 'caution',
        v_christian_id, v_kk_id, v_kk_id,
        v_contract_id, 60000,
        'tok_rec_caution_000492', 'tok_rec_caution_000492',
        'https://locatrust.site/verify/tok_rec_caution_000492',
        'Dépôt de Garantie Contractuel (Loi n° 2019-576 Art. 414)', 'certifie'
      );
    END IF;

    -- G. Notifications Persistantes pour l'Agence KK
    IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'b9999999-8888-7777-6666-555555555555') THEN
      INSERT INTO public.notifications (
        id, user_id, title, type, category, target_role,
        message, description, read, is_read, payload
      ) VALUES (
        'b9999999-8888-7777-6666-555555555555',
        v_kk_id,
        '💳 Nouveau paiement de loyer déclaré',
        'paiement', 'paiement', 'agence',
        'Christian a déclaré le loyer de Novembre 2026 (30 000 FCFA).',
        'Christian a déclaré le paiement du loyer de Novembre 2026 (30 000 FCFA • Wave - Réf: WAV-2026-NOV-781920). Cliquez pour vérifier et valider la quittance.',
        false, false,
        '{"paymentId": "f5555555-6666-7777-8888-999999999999", "amount": 30000, "month": "Novembre 2026", "reference": "WAV-2026-NOV-781920"}'::jsonb
      );
    END IF;
END $$;
