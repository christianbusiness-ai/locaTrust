-- ============================================================================
-- SCHÉMA DE BASE DE DONNÉES COMPLET - LOCATRUST (SaaS GESTION LOCATIVE AFRIQUE)
-- ============================================================================

-- 0. FONCTION HELPER UNIQUE DE SÉCURITÉ RLS
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3.1 Utilisateurs & vérification
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('locataire','proprietaire','agence','admin')),
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  avatar_url text,
  verification_status text NOT NULL DEFAULT 'non_verifie'
    CHECK (verification_status IN ('non_verifie','en_attente','verifie')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs visibles par tous pour les profils publics"
  ON public.users FOR SELECT USING (true);

CREATE POLICY "Utilisateurs modifiables par le propriétaire de l'id"
  ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('cni','rccm')),
  file_url text NOT NULL,
  status text DEFAULT 'en_attente' CHECK (status IN ('en_attente','verifie','refuse')),
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doc vérification visible par proprio et admin"
  ON public.verification_documents FOR SELECT
  USING (user_id = auth.uid() OR auth.user_role() = 'admin');

-- 3.2 Agences & collaborateurs
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES public.users(id),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  agency_role text NOT NULL CHECK (agency_role IN ('gestionnaire','comptable','lecture_seule')),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (agency_id, user_id)
);

ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membres agence voient uniquement leur agence"
  ON public.agency_members FOR SELECT
  USING (
    user_id = auth.uid() OR 
    agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()) OR
    auth.user_role() = 'admin'
  );

-- 3.3 Localisation & biens
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  city text NOT NULL,
  commune text,
  quartier text,
  UNIQUE (country, city, commune, quartier)
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Locations visibles par tous" ON public.locations FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.users(id),
  agency_id uuid REFERENCES public.agencies(id),
  location_id uuid REFERENCES public.locations(id),
  type text CHECK (type IN ('maison','appartement','studio','bureau','boutique','terrain','entrepot','parking')),
  title text NOT NULL,
  description text,
  gps_lat numeric, gps_lng numeric,
  surface numeric,
  rooms int, bedrooms int, bathrooms int,
  rent numeric NOT NULL,
  caution numeric,
  charges numeric DEFAULT 0,
  furnished boolean DEFAULT false,
  equipments jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'disponible'
    CHECK (status IN ('disponible','reserve','loue','fin_contrat','desactive')),
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- RLS: fil public = uniquement les biens disponibles et non supprimés
CREATE POLICY "Biens disponibles visibles publiquement"
  ON public.properties FOR SELECT
  USING (
    (status = 'disponible' AND deleted_at IS NULL) OR
    owner_id = auth.uid() OR
    agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid()) OR
    auth.user_role() = 'admin'
  );

CREATE TABLE IF NOT EXISTS public.property_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  media_type text CHECK (media_type IN ('photo','video')),
  url text NOT NULL,
  display_order int DEFAULT 0
);

ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Médias biens visibles publiquement" ON public.property_media FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.property_stats (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  views int DEFAULT 0,
  favorites_count int DEFAULT 0,
  visit_requests_count int DEFAULT 0,
  rental_requests_count int DEFAULT 0
);

-- 3.4 Contrats & avenants
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text UNIQUE NOT NULL,
  property_id uuid REFERENCES public.properties(id),
  tenant_id uuid REFERENCES public.users(id),
  owner_id uuid REFERENCES public.users(id),
  duration_months int DEFAULT 12,
  rent numeric NOT NULL,
  caution numeric NOT NULL,
  charges numeric DEFAULT 0,
  payment_due_day int DEFAULT 5,
  notice_period_days int DEFAULT 90,
  house_rules text,
  clauses text,
  pdf_url text,
  qr_code text,
  status text DEFAULT 'actif' CHECK (status IN ('actif','termine','resilie')),
  signed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contrats visibles aux parties et admin"
  ON public.contracts FOR SELECT
  USING (
    tenant_id = auth.uid() OR 
    owner_id = auth.uid() OR 
    auth.user_role() = 'admin'
  );

CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  changes jsonb NOT NULL,
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

-- Trigger PostgreSQL d'automatisation des statuts de biens sur signature/fin de contrat
CREATE OR REPLACE FUNCTION update_property_status_on_contract()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'actif' THEN
    UPDATE public.properties SET status = 'loue' WHERE id = NEW.property_id;
  ELSIF TG_OP = 'UPDATE' AND (NEW.status = 'termine' OR NEW.status = 'resilie') THEN
    UPDATE public.properties SET status = 'disponible' WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_contract_property_status ON public.contracts;
CREATE TRIGGER trg_contract_property_status
  AFTER INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION update_property_status_on_contract();

-- 3.5 Cautions
CREATE TABLE IF NOT EXISTS public.cautions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  amount_requested numeric NOT NULL,
  amount_paid numeric DEFAULT 0,
  status text DEFAULT 'partiel' CHECK (status IN ('partiel','complet','restitue','retenu')),
  restitution_amount numeric,
  retenue_reason text,
  justificatif_url text,
  updated_at timestamptz DEFAULT now()
);

-- 3.6 Paiements de loyer (déclaratif) & litiges
CREATE TABLE IF NOT EXISTS public.rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id),
  tenant_id uuid REFERENCES public.users(id),
  owner_id uuid REFERENCES public.users(id),
  target_month date NOT NULL,
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  reference text,
  proof_url text,
  status text DEFAULT 'declare' CHECK (status IN ('declare','confirme','refuse')),
  confirmed_by uuid REFERENCES public.users(id),
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paiements de loyer visibles par locataire, bailleur et admin"
  ON public.rent_payments FOR SELECT
  USING (tenant_id = auth.uid() OR owner_id = auth.uid() OR auth.user_role() = 'admin');

CREATE TABLE IF NOT EXISTS public.payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_payment_id uuid REFERENCES public.rent_payments(id),
  tenant_justification text,
  tenant_proof_url text,
  owner_justification text,
  status text DEFAULT 'ouvert' CHECK (status IN ('ouvert','resolu_locataire','resolu_proprietaire')),
  resolved_by uuid REFERENCES public.users(id),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_payment_id uuid REFERENCES public.rent_payments(id),
  contract_id uuid REFERENCES public.contracts(id),
  pdf_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quittances toujours accessibles au locataire"
  ON public.receipts FOR SELECT
  USING (
    contract_id IN (SELECT id FROM public.contracts WHERE tenant_id = auth.uid() OR owner_id = auth.uid()) OR
    auth.user_role() = 'admin'
  );

-- 3.7 Abonnement LocaTrust (flux réel)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.users(id),
  agency_id uuid REFERENCES public.agencies(id),
  tier text NOT NULL,
  price numeric NOT NULL,
  properties_count_snapshot int NOT NULL,
  status text DEFAULT 'actif' CHECK (status IN ('actif','impaye','resilie')),
  gateway text CHECK (gateway IN ('stripe','cinetpay')),
  external_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id),
  amount numeric NOT NULL,
  gateway text NOT NULL,
  gateway_ref text,
  webhook_verified boolean NOT NULL DEFAULT false,
  status text CHECK (status IN ('pending','success','failed')),
  created_at timestamptz DEFAULT now()
);

-- 3.8 Maintenance, messagerie, favoris, demandes
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id),
  tenant_id uuid REFERENCES public.users(id),
  description text NOT NULL,
  status text DEFAULT 'ouvert' CHECK (status IN ('ouvert','resolu')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id),
  participant_a uuid REFERENCES public.users(id),
  participant_b uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.users(id),
  content text,
  attachment_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.favorites (
  tenant_id uuid REFERENCES public.users(id),
  property_id uuid REFERENCES public.properties(id),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, property_id)
);

CREATE TABLE IF NOT EXISTS public.visit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id),
  tenant_id uuid REFERENCES public.users(id),
  status text DEFAULT 'en_attente' CHECK (status IN ('en_attente','acceptee','refusee')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rental_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id),
  tenant_id uuid REFERENCES public.users(id),
  status text DEFAULT 'en_attente' CHECK (status IN ('en_attente','acceptee','refusee')),
  created_at timestamptz DEFAULT now()
);

-- 3.9 Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  type text NOT NULL,
  payload jsonb,
  channel text[] DEFAULT '{app}',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notifications persos uniquement" ON public.notifications FOR SELECT USING (user_id = auth.uid());
