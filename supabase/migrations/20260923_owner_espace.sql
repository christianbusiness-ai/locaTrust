-- ====================================================================
-- MIGRATION SUPABASE : ESPACE PROPRIÉTAIRE LOCATRUST (RLS & SCHEMA)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. HELPER ROLE FUNCTION (Auth Source of Truth)
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'locataire'
  );
$$ LANGUAGE sql STABLE;

-- 3. TABLE PROPERTIES (Biens Immobiliers avec Soft Delete)
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('maison', 'appartement', 'studio', 'bureau', 'boutique', 'terrain', 'entrepot', 'parking')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  country VARCHAR(100) DEFAULT 'Côte d''Ivoire',
  city VARCHAR(100) DEFAULT 'Abidjan',
  commune VARCHAR(100) NOT NULL,
  quartier VARCHAR(100) NOT NULL,
  gps_latitude NUMERIC(10, 8),
  gps_longitude NUMERIC(11, 8),
  surface NUMERIC(10, 2) NOT NULL,
  rooms INT DEFAULT 1,
  bedrooms INT DEFAULT 0,
  bathrooms INT DEFAULT 1,
  rent NUMERIC(12, 2) NOT NULL,
  caution NUMERIC(12, 2) NOT NULL,
  charges NUMERIC(12, 2) DEFAULT 0,
  furnished BOOLEAN DEFAULT FALSE,
  equipments TEXT[] DEFAULT '{}',
  photos TEXT[] DEFAULT '{}',
  videos TEXT[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'disponible' CHECK (status IN ('disponible', 'reserve', 'loue', 'fin_de_contrat', 'desactive')),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Properties are viewable by owner or active public if available"
  ON public.properties FOR SELECT
  USING (
    owner_id = auth.uid()
    OR (deleted_at IS NULL AND status = 'disponible')
  );

CREATE POLICY "Owners can insert their own properties"
  ON public.properties FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their own properties"
  ON public.properties FOR UPDATE
  USING (owner_id = auth.uid());

-- 4. TABLE CONTRACTS & CONTRACT AMENDMENTS
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number VARCHAR(50) UNIQUE NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_months INT NOT NULL DEFAULT 12,
  monthly_rent NUMERIC(12, 2) NOT NULL,
  caution_amount NUMERIC(12, 2) NOT NULL,
  charges_amount NUMERIC(12, 2) DEFAULT 0,
  payment_due_day INT DEFAULT 5,
  notice_period_months INT DEFAULT 3,
  internal_rules TEXT,
  special_clauses TEXT,
  qr_code_hash VARCHAR(255),
  owner_signed BOOLEAN DEFAULT FALSE,
  tenant_signed BOOLEAN DEFAULT FALSE,
  owner_signed_at TIMESTAMP WITH TIME ZONE,
  tenant_signed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'en_attente' CHECK (status IN ('brouillon', 'en_attente', 'actif', 'fin_bientot', 'termine', 'resilie')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table Avenants (Amendments)
CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  amendment_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  changes_summary TEXT NOT NULL,
  previous_terms JSONB NOT NULL,
  new_terms JSONB NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and Tenants can view their contracts"
  ON public.contracts FOR SELECT
  USING (owner_id = auth.uid() OR tenant_id = auth.uid());

CREATE POLICY "Owners can create and update contracts"
  ON public.contracts FOR ALL
  USING (owner_id = auth.uid());

-- 5. TRIGGER POSTGRESQL : METTRE A JOUR LE STATUT DE LA PROPRIÉTÉ LORS DE LA SIGNATURE
CREATE OR REPLACE FUNCTION public.update_property_status_on_contract()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'actif' THEN
    UPDATE public.properties SET status = 'loue' WHERE id = NEW.property_id;
  ELSIF NEW.status IN ('termine', 'resilie') THEN
    UPDATE public.properties SET status = 'disponible' WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_contract_status_change
  AFTER INSERT OR UPDATE OF status ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_property_status_on_contract();

-- 6. TABLE DEPOSITS (Cautions)
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  requested_amount NUMERIC(12, 2) NOT NULL,
  paid_amount NUMERIC(12, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'non_paye' CHECK (status IN ('non_paye', 'partiel', 'paye', 'restitue', 'retenue_partielle', 'retenue_totale')),
  returned_amount NUMERIC(12, 2) DEFAULT 0,
  retained_amount NUMERIC(12, 2) DEFAULT 0,
  retention_reason TEXT,
  justification_proofs TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deposits viewable by owner and tenant"
  ON public.deposits FOR SELECT USING (owner_id = auth.uid() OR tenant_id = auth.uid());
CREATE POLICY "Owners manage deposits"
  ON public.deposits FOR ALL USING (owner_id = auth.uid());

-- 7. TABLE RENT PAYMENTS (Paiements Déclaratifs)
CREATE TABLE IF NOT EXISTS public.rent_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  month_period VARCHAR(20) NOT NULL, -- ex: '2026-09'
  amount NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- Orange Money, MTN, Wave, Virement
  transaction_reference VARCHAR(100) NOT NULL,
  proof_url TEXT,
  status VARCHAR(50) DEFAULT 'declare' CHECK (status IN ('declare', 'confirme', 'refuse')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rent payments viewable by owner and tenant"
  ON public.rent_payments FOR SELECT USING (owner_id = auth.uid() OR tenant_id = auth.uid());
CREATE POLICY "Owners manage rent payments"
  ON public.rent_payments FOR ALL USING (owner_id = auth.uid());

-- 8. TABLE RECEIPTS (Quittances générées uniquement après confirmation)
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  payment_id UUID NOT NULL REFERENCES public.rent_payments(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  month_period VARCHAR(20) NOT NULL,
  amount_paid NUMERIC(12, 2) NOT NULL,
  pdf_url TEXT,
  qr_code_hash VARCHAR(255),
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Receipts viewable by owner and tenant"
  ON public.receipts FOR SELECT USING (owner_id = auth.uid() OR tenant_id = auth.uid());

-- 9. TABLE MAINTENANCE TICKETS
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(50) DEFAULT 'moyenne' CHECK (priority IN ('faible', 'moyenne', 'haute', 'urgente')),
  status VARCHAR(50) DEFAULT 'ouvert' CHECK (status IN ('ouvert', 'en_cours', 'resolu', 'ferme')),
  attachments TEXT[] DEFAULT '{}',
  owner_reply TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Maintenance tickets viewable by owner and tenant"
  ON public.maintenance_tickets FOR SELECT USING (owner_id = auth.uid() OR tenant_id = auth.uid());
CREATE POLICY "Owners and Tenants update maintenance tickets"
  ON public.maintenance_tickets FOR ALL USING (owner_id = auth.uid() OR tenant_id = auth.uid());

-- 10. TABLE SUBSCRIPTION PAYMENTS (Abonnement SaaS LocaTrust)
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL,
  active_properties_count INT NOT NULL,
  tier_amount NUMERIC(12, 2) NOT NULL, -- 500, 2000, 5000, 10000 FCFA
  payment_method VARCHAR(50) NOT NULL, -- Stripe, CinetPay, Orange Money, Wave
  transaction_ref VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'paye' CHECK (status IN ('paye', 'echec', 'en_attente')),
  period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month')
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view subscription payments"
  ON public.subscription_payments FOR SELECT USING (owner_id = auth.uid());
