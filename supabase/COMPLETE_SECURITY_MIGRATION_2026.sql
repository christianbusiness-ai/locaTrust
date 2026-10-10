-- =============================================================================
-- LOCATRUST - SCRIPT SQL DE SÉCURITÉ UNIFIÉ & COMPLET (100% IDEMPOTENT)
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query > Run
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE PROFILES (Liée à auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  account_type TEXT NOT NULL DEFAULT 'locataire' CHECK (account_type IN ('locataire', 'proprietaire', 'agence')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  cni_number TEXT DEFAULT '',
  city TEXT DEFAULT 'Abidjan',
  commune TEXT DEFAULT '',
  profession TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'non_verifie' CHECK (verification_status IN ('non_verifie', 'en_attente', 'verifie', 'rejete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);

-- Compatibilité 'users' -> 'profiles' (sécurisé si 'users' existe déjà comme table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'users'
  ) THEN
    CREATE VIEW public.users AS SELECT * FROM public.profiles;
  END IF;
END $$;

-- 3. FONCTION DE SÉCURITÉ is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 4. TRIGGER CRÉATION DU PROFIL À L'INSCRIPTION AUTH
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    account_type,
    role,
    cni_number,
    city,
    commune,
    profession,
    verification_status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'locataire'),
    'user',
    COALESCE(NEW.raw_user_meta_data->>'cni_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Abidjan'),
    COALESCE(NEW.raw_user_meta_data->>'commune', ''),
    COALESCE(NEW.raw_user_meta_data->>'profession', ''),
    'non_verifie'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    phone = CASE WHEN public.profiles.phone = '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
    account_type = CASE WHEN public.profiles.account_type IS NULL THEN EXCLUDED.account_type ELSE public.profiles.account_type END,
    updated_at = timezone('utc'::text, now());
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. TABLES MÉTIER PRINCIPALES

-- Properties (Biens Immobiliers)
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  property_type TEXT NOT NULL DEFAULT 'appartement',
  rent_amount NUMERIC NOT NULL DEFAULT 0,
  charges_amount NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  city TEXT NOT NULL DEFAULT 'Abidjan',
  commune TEXT NOT NULL DEFAULT '',
  address TEXT DEFAULT '',
  surface NUMERIC DEFAULT 0,
  rooms INTEGER DEFAULT 1,
  bedrooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  is_furnished BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'disponible',
  images TEXT[] DEFAULT '{}',
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Rental Applications (Candidatures locatives)
CREATE TABLE IF NOT EXISTS public.rental_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_name TEXT NOT NULL DEFAULT '',
  tenant_phone TEXT DEFAULT '',
  tenant_email TEXT DEFAULT '',
  tenant_cni TEXT DEFAULT '',
  tenant_avatar TEXT DEFAULT '',
  property_title TEXT DEFAULT '',
  property_address TEXT DEFAULT '',
  rent_amount NUMERIC DEFAULT 0,
  caution_amount NUMERIC DEFAULT 0,
  date_received TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  status TEXT NOT NULL DEFAULT 'en_attente',
  dossier_status TEXT NOT NULL DEFAULT 'en_cours',
  tenant_signed BOOLEAN DEFAULT false,
  tenant_signed_at TIMESTAMPTZ,
  contract_number TEXT,
  contract_finalized BOOLEAN DEFAULT false,
  documents JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Contracts (Baux de location conformes loi 2019-576)
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number TEXT UNIQUE NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  monthly_rent NUMERIC NOT NULL,
  charges_amount NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  duration_months INTEGER NOT NULL DEFAULT 12,
  payment_due_day INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'actif',
  owner_signature TEXT,
  tenant_signature TEXT,
  signed_at TIMESTAMPTZ,
  qr_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Rent Payments (Paiements de loyers)
CREATE TABLE IF NOT EXISTS public.rent_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  rent_month DATE NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'wave',
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'en_attente',
  validated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Receipts (Quittances officielles avec QR Code)
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT UNIQUE NOT NULL,
  payment_id UUID REFERENCES public.rent_payments(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_paid NUMERIC NOT NULL,
  rent_month DATE NOT NULL,
  qr_token TEXT UNIQUE NOT NULL,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Deposits (Cautions séquestrées)
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID UNIQUE NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'sequestre',
  deductions_amount NUMERIC DEFAULT 0,
  refunded_amount NUMERIC DEFAULT 0,
  refund_receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Maintenance Tickets (Incidents & SAV)
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'autre',
  priority TEXT NOT NULL DEFAULT 'normale',
  status TEXT NOT NULL DEFAULT 'ouvert',
  estimated_cost NUMERIC DEFAULT 0,
  final_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Subscriptions (Abonnements SaaS Bailleurs)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'pro',
  status TEXT NOT NULL DEFAULT 'actif',
  properties_limit INTEGER DEFAULT 10,
  price_fcfa NUMERIC DEFAULT 2000,
  billing_cycle TEXT DEFAULT 'monthly',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Subscription Payments
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'wave',
  transaction_reference TEXT,
  status TEXT DEFAULT 'valide',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'delivered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- 6. ACTIVATION ROW LEVEL SECURITY (RLS) SUR TOUTES LES TABLES
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- POLICIES : PROFILES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : PROPERTIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "properties_select_all" ON public.properties;
CREATE POLICY "properties_select_all" ON public.properties
  FOR SELECT USING (
    status = 'disponible' OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "properties_modify_own" ON public.properties;
CREATE POLICY "properties_modify_own" ON public.properties
  FOR ALL USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : RENTAL APPLICATIONS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rental_applications_select" ON public.rental_applications;
CREATE POLICY "rental_applications_select" ON public.rental_applications
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "rental_applications_insert" ON public.rental_applications;
CREATE POLICY "rental_applications_insert" ON public.rental_applications
  FOR INSERT WITH CHECK (tenant_id = auth.uid() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "rental_applications_update" ON public.rental_applications;
CREATE POLICY "rental_applications_update" ON public.rental_applications
  FOR UPDATE USING (
    tenant_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR
    public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- POLICIES : CONTRACTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "contracts_select_parties" ON public.contracts;
CREATE POLICY "contracts_select_parties" ON public.contracts
  FOR SELECT USING (
    owner_id = auth.uid() OR
    tenant_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "contracts_modify_parties" ON public.contracts;
CREATE POLICY "contracts_modify_parties" ON public.contracts
  FOR ALL USING (owner_id = auth.uid() OR tenant_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : RENT PAYMENTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rent_payments_select_parties" ON public.rent_payments;
CREATE POLICY "rent_payments_select_parties" ON public.rent_payments
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "rent_payments_insert_parties" ON public.rent_payments;
CREATE POLICY "rent_payments_insert_parties" ON public.rent_payments
  FOR INSERT WITH CHECK (tenant_id = auth.uid() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "rent_payments_update_parties" ON public.rent_payments;
CREATE POLICY "rent_payments_update_parties" ON public.rent_payments
  FOR UPDATE USING (owner_id = auth.uid() OR tenant_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : RECEIPTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "receipts_select_parties" ON public.receipts;
CREATE POLICY "receipts_select_parties" ON public.receipts
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "receipts_insert_owner" ON public.receipts;
CREATE POLICY "receipts_insert_owner" ON public.receipts
  FOR INSERT WITH CHECK (owner_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : DEPOSITS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "deposits_select_parties" ON public.deposits;
CREATE POLICY "deposits_select_parties" ON public.deposits
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- POLICIES : MAINTENANCE TICKETS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "maintenance_tickets_select_parties" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_select_parties" ON public.maintenance_tickets
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "maintenance_tickets_insert_parties" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_insert_parties" ON public.maintenance_tickets
  FOR INSERT WITH CHECK (tenant_id = auth.uid() OR owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "maintenance_tickets_update_parties" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_update_parties" ON public.maintenance_tickets
  FOR UPDATE USING (tenant_id = auth.uid() OR owner_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : NOTIFICATIONS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : SUBSCRIPTIONS & PAIEMENTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "subscriptions_modify_own" ON public.subscriptions;
CREATE POLICY "subscriptions_modify_own" ON public.subscriptions
  FOR ALL USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "sub_payments_select_own" ON public.subscription_payments;
CREATE POLICY "sub_payments_select_own" ON public.subscription_payments
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : CONVERSATIONS & MESSAGES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversations_participate" ON public.conversations;
CREATE POLICY "conversations_participate" ON public.conversations
  FOR SELECT USING (tenant_id = auth.uid() OR owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "conversations_create" ON public.conversations;
CREATE POLICY "conversations_create" ON public.conversations
  FOR INSERT WITH CHECK (tenant_id = auth.uid() OR owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "messages_select_participate" ON public.messages;
CREATE POLICY "messages_select_participate" ON public.messages
  FOR SELECT USING (
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
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.tenant_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );
