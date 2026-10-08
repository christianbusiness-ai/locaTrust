-- =============================================================================
-- LOCATRUST - MIGRATION OFFICIELLE : PROFILES & SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- Conforme Loi n° 2019-576 (Code de la Construction et de l'Habitat de CI)
-- =============================================================================

-- 1. EXTENSIONS NÉCESSAIRES
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

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

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

-- 4. TRIGGER CRÉATION AUTOMATIQUE DU PROFIL À L'INSCRIPTION
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
    'user', -- SÉCURITÉ ABSOLUE : tout nouvel inscrit a strictement le rôle 'user'
    COALESCE(NEW.raw_user_meta_data->>'cni_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Abidjan'),
    COALESCE(NEW.raw_user_meta_data->>'commune', ''),
    COALESCE(NEW.raw_user_meta_data->>'profession', ''),
    'non_verifie'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
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

-- 5. TRIGGER PROTECTION MODIFICATION DU RÔLE
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Empêche tout utilisateur normal de s'auto-promouvoir admin
  IF NEW.role <> OLD.role AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_role ON public.profiles;
CREATE TRIGGER tr_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 6. TABLES MÉTIER ESSENTIELLES (SI NON EXISTANTES)

-- Properties (Biens immobiliers)
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  property_type TEXT NOT NULL DEFAULT 'appartement',
  rent_amount NUMERIC NOT NULL CHECK (rent_amount > 0),
  charges_amount NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  city TEXT NOT NULL DEFAULT 'Abidjan',
  commune TEXT NOT NULL,
  address TEXT DEFAULT '',
  surface NUMERIC DEFAULT 0,
  rooms INTEGER DEFAULT 1,
  bedrooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  is_furnished BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible', 'loue', 'maintenance', 'archive')),
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);

-- Rental Requests (Candidatures locatives)
CREATE TABLE IF NOT EXISTS public.rental_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'retenu', 'refuse', 'annule')),
  monthly_income NUMERIC DEFAULT 0,
  employment_type TEXT DEFAULT '',
  message TEXT DEFAULT '',
  cni_url TEXT DEFAULT '',
  payslip_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_rental_requests_property ON public.rental_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_rental_requests_tenant ON public.rental_requests(tenant_id);

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
  status TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('brouillon', 'en_attente_signature', 'actif', 'resilie', 'termine')),
  owner_signature TEXT,
  tenant_signature TEXT,
  signed_at TIMESTAMPTZ,
  qr_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_contracts_owner ON public.contracts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON public.contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_property ON public.contracts(property_id);

-- Rent Payments (Paiements de loyers)
CREATE TABLE IF NOT EXISTS public.rent_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  rent_month DATE NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'wave' CHECK (payment_method IN ('wave', 'orange_money', 'mtn_momo', 'moov_money', 'virement', 'especes')),
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'valide', 'rejete')),
  validated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_rent_payments_contract ON public.rent_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_tenant ON public.rent_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_owner ON public.rent_payments(owner_id);

-- Receipts (Quittances officielles avec QR Code)
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT UNIQUE NOT NULL,
  payment_id UUID UNIQUE REFERENCES public.rent_payments(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_paid NUMERIC NOT NULL,
  rent_month DATE NOT NULL,
  qr_token TEXT UNIQUE NOT NULL,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_receipts_contract ON public.receipts(contract_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON public.receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_owner ON public.receipts(owner_id);

-- Deposits / Cautions (Séquestre des dépôts de garantie - Art. 414 plafonné à 2 mois)
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID UNIQUE NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'sequestre' CHECK (status IN ('sequestre', 'restitue_total', 'restitue_partiel', 'litige')),
  deductions_amount NUMERIC DEFAULT 0,
  refunded_amount NUMERIC DEFAULT 0,
  refund_receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_deposits_contract ON public.deposits(contract_id);

-- Maintenance Tickets (Incidents & Réparations - Art. 428)
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'autre',
  priority TEXT NOT NULL DEFAULT 'normale' CHECK (priority IN ('faible', 'normale', 'urgente')),
  status TEXT NOT NULL DEFAULT 'ouvert' CHECK (status IN ('ouvert', 'en_cours', 'resolu', 'ferme')),
  estimated_cost NUMERIC DEFAULT 0,
  final_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_property ON public.maintenance_tickets(property_id);

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
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- =============================================================================
-- 7. ACTIVATION STRICTE DE ROW LEVEL SECURITY (RLS) SUR TOUTES LES TABLES
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- POLICIES : PROFILES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_insert_own_or_admin" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : PROPERTIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "properties_select" ON public.properties;
CREATE POLICY "properties_select" ON public.properties
  FOR SELECT USING (
    status = 'disponible' OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "properties_modify_own" ON public.properties;
CREATE POLICY "properties_modify_own" ON public.properties
  FOR ALL USING (owner_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : RENTAL REQUESTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rental_requests_select" ON public.rental_requests;
CREATE POLICY "rental_requests_select" ON public.rental_requests
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "rental_requests_insert_tenant" ON public.rental_requests;
CREATE POLICY "rental_requests_insert_tenant" ON public.rental_requests
  FOR INSERT WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "rental_requests_update" ON public.rental_requests;
CREATE POLICY "rental_requests_update" ON public.rental_requests
  FOR UPDATE USING (
    tenant_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR
    public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- POLICIES : CONTRACTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT USING (
    owner_id = auth.uid() OR
    tenant_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "contracts_owner_all" ON public.contracts;
CREATE POLICY "contracts_owner_all" ON public.contracts
  FOR ALL USING (owner_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : RENT PAYMENTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rent_payments_select" ON public.rent_payments;
CREATE POLICY "rent_payments_select" ON public.rent_payments
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "rent_payments_insert_tenant" ON public.rent_payments;
CREATE POLICY "rent_payments_insert_tenant" ON public.rent_payments
  FOR INSERT WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "rent_payments_update_parties" ON public.rent_payments;
CREATE POLICY "rent_payments_update_parties" ON public.rent_payments
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    tenant_id = auth.uid() OR
    public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- POLICIES : RECEIPTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "receipts_select" ON public.receipts;
CREATE POLICY "receipts_select" ON public.receipts
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "receipts_owner_insert" ON public.receipts;
CREATE POLICY "receipts_owner_insert" ON public.receipts
  FOR INSERT WITH CHECK (owner_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- POLICIES : DEPOSITS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "deposits_select" ON public.deposits;
CREATE POLICY "deposits_select" ON public.deposits
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- POLICIES : MAINTENANCE TICKETS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "maintenance_tickets_select" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_select" ON public.maintenance_tickets
  FOR SELECT USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "maintenance_tickets_insert" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_insert" ON public.maintenance_tickets
  FOR INSERT WITH CHECK (
    tenant_id = auth.uid() OR
    owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "maintenance_tickets_update" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_update" ON public.maintenance_tickets
  FOR UPDATE USING (
    tenant_id = auth.uid() OR
    owner_id = auth.uid() OR
    public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- POLICIES : NOTIFICATIONS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());
