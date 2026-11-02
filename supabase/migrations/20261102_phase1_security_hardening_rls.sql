-- =============================================================================
-- LOCATRUST - MIGRATION PHASE 1 V2 : RENFORCEMENT DE SÉCURITÉ CRITIQUE (RLS & TRIGGERS)
-- Conforme Loi n° 2019-576 et AUDCG OHADA
-- Idempotente, exécutée dans une transaction sécurisée
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 0. FONCTION HELPER : is_trusted_caller()
-- -----------------------------------------------------------------------------
-- Retourne TRUE si l'appelant est le service_role, un superuser (postgres, supabase_admin),
-- ou s'il n'y a pas de session utilisateur authentifiée (NULL = console SQL, triggers internes, cron).
CREATE OR REPLACE FUNCTION public.is_trusted_caller()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT (
    auth.uid() IS NULL
    OR current_user IN ('postgres', 'supabase_admin')
    OR (current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
  );
$$;

-- -----------------------------------------------------------------------------
-- 1. FONCTIONS SÉCURISÉES : is_admin() et mask_name()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = v_uid;

  RETURN (v_role = 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.mask_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean text;
  words text[];
  word_count int;
  last_word text;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN 'Partie Certifiée';
  END IF;

  clean := regexp_replace(trim(p_name), '\s+', ' ', 'g');
  words := string_to_array(clean, ' ');
  word_count := array_length(words, 1);

  IF word_count = 1 THEN
    IF length(clean) <= 2 THEN
      RETURN clean || '***';
    ELSE
      RETURN substr(clean, 1, 2) || '***';
    END IF;
  ELSE
    last_word := words[word_count];
    RETURN words[1] || ' ' || upper(substr(last_word, 1, 1)) || '.';
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. ASSURANCE D'EXISTENCE DES TABLES ET COLONNES REQUISES
-- -----------------------------------------------------------------------------

-- Table document_verifications (Registre cryptographique officiel)
CREATE TABLE IF NOT EXISTS public.document_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('contrat', 'recu_loyer', 'recu_caution', 'recu_restitution', 'resiliation')),
  document_number TEXT NOT NULL,
  contract_number TEXT,
  status TEXT NOT NULL DEFAULT 'valide' CHECK (status IN ('valide', 'en_attente_signature', 'expire', 'revoque_annule', 'modifie_avenant')),
  document_hash TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'FCFA',
  period_covered TEXT,
  payment_method TEXT,
  transaction_reference TEXT,
  owner_name TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  property_title TEXT,
  property_address TEXT,
  is_owner_signed BOOLEAN DEFAULT true,
  is_tenant_signed BOOLEAN DEFAULT true,
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_doc_verif_token ON public.document_verifications(token);
CREATE INDEX IF NOT EXISTS idx_doc_verif_doc_num ON public.document_verifications(document_number);
CREATE INDEX IF NOT EXISTS idx_doc_verif_contract_num ON public.document_verifications(contract_number);

-- Colonnes de vérification aléatoire sur contracts et receipts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'verification_token') THEN
    ALTER TABLE public.contracts ADD COLUMN verification_token TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'token') THEN
    ALTER TABLE public.contracts ADD COLUMN token TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'verification_token') THEN
    ALTER TABLE public.receipts ADD COLUMN verification_token TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'token') THEN
    ALTER TABLE public.receipts ADD COLUMN token TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'rejection_reason') THEN
    ALTER TABLE public.rent_payments ADD COLUMN rejection_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'dispute_reason') THEN
    ALTER TABLE public.rent_payments ADD COLUMN dispute_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'rejection_contested') THEN
    ALTER TABLE public.rent_payments ADD COLUMN rejection_contested BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'tenant_signature') THEN
    ALTER TABLE public.rent_payments ADD COLUMN tenant_signature TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'tenant_signed_at') THEN
    ALTER TABLE public.rent_payments ADD COLUMN tenant_signed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'owner_signature') THEN
    ALTER TABLE public.rent_payments ADD COLUMN owner_signature TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'confirmed_at') THEN
    ALTER TABLE public.rent_payments ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'finalized_at') THEN
    ALTER TABLE public.rent_payments ADD COLUMN finalized_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rental_applications' AND column_name = 'rejection_reason') THEN
    ALTER TABLE public.rental_applications ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;

-- Générer un verification_token de 16 octets aléatoires (hex 32 caractères) pour les contrats et reçus qui n'en ont pas
UPDATE public.contracts 
SET verification_token = 'tok_cnt_' || encode(gen_random_bytes(16), 'hex')
WHERE verification_token IS NULL;

UPDATE public.receipts 
SET verification_token = 'tok_rec_' || encode(gen_random_bytes(16), 'hex')
WHERE verification_token IS NULL;

-- -----------------------------------------------------------------------------
-- 3. SÉCURISATION DE PUBLIC.PROFILES (TRIGGERS & INSCRIPTION)
-- -----------------------------------------------------------------------------

-- Trigger avant insertion : handle_new_user et restrictions de rôle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role text;
  v_safe_role text;
BEGIN
  v_requested_role := lower(trim(COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_user_meta_data->>'account_type', 'locataire')));
  
  -- Seuls les rôles locataire, proprietaire, agence sont autorisés à l'inscription publique
  IF v_requested_role IN ('proprietaire', 'agence', 'locataire') THEN
    v_safe_role := v_requested_role;
  ELSE
    v_safe_role := 'locataire';
  END IF;

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
    v_safe_role,
    v_safe_role,
    COALESCE(NEW.raw_user_meta_data->>'cni_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Abidjan'),
    COALESCE(NEW.raw_user_meta_data->>'commune', ''),
    COALESCE(NEW.raw_user_meta_data->>'profession', ''),
    'non_verifie'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = CASE WHEN public.profiles.phone = '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
    updated_at = timezone('utc'::text, now());
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger BEFORE INSERT sur profiles : empêche la création directe d'un rôle admin
CREATE OR REPLACE FUNCTION public.check_profiles_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_trusted_caller() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role NOT IN ('locataire', 'proprietaire', 'agence') THEN
    RAISE EXCEPTION 'Attribution du rôle non autorisée à l''inscription.';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM 'non_verifie' THEN
    NEW.verification_status := 'non_verifie';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_profiles_insert ON public.profiles;
CREATE TRIGGER trg_check_profiles_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profiles_insert();

-- Trigger BEFORE UPDATE sur profiles (Liste blanche & protection stricte)
CREATE OR REPLACE FUNCTION public.protect_profiles_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_json jsonb;
  v_new_json jsonb;
  v_diff jsonb;
  v_whitelist text[] := ARRAY[
    'full_name', 'phone', 'city', 'commune', 'profession',
    'cni_number', 'avatar_url', 'id_document_url', 'updated_at'
  ];
BEGIN
  IF public.is_trusted_caller() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Protection immuable de l'ID et de l'email
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Modification de l''identifiant de profil interdite.';
  END IF;

  IF (to_jsonb(NEW) ? 'email') AND (NEW.email IS DISTINCT FROM OLD.email) THEN
    RAISE EXCEPTION 'La modification de l''email doit être effectuée via l''authentification.';
  END IF;

  -- Règle stricte KYC : un non-admin ne peut passer verification_status que de 'non_verifie' à 'en_attente'
  IF (to_jsonb(NEW) ? 'verification_status') AND (NEW.verification_status IS DISTINCT FROM OLD.verification_status) THEN
    IF NOT (OLD.verification_status = 'non_verifie' AND NEW.verification_status = 'en_attente') THEN
      RAISE EXCEPTION 'Transition de statut de vérification non autorisée : seul le passage de non_verifie à en_attente est permis.';
    END IF;
  END IF;

  -- Comparaison de l'ensemble des colonnes hors liste blanche
  -- On retire la liste blanche de base, plus verification_status si valide
  v_old_json := to_jsonb(OLD) - v_whitelist - ARRAY['verification_status'];
  v_new_json := to_jsonb(NEW) - v_whitelist - ARRAY['verification_status'];

  IF v_new_json IS DISTINCT FROM v_old_json THEN
    RAISE EXCEPTION 'Tentative de modification non autorisée de colonnes protégées du profil (rôle, abonnement, blocage, etc.).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profiles_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_protect_profiles_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_sensitive_columns();

-- Policies RLS sur public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
    OR auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

-- -----------------------------------------------------------------------------
-- 4. SÉCURISATION DE PUBLIC.PROPERTIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "properties_select" ON public.properties;
CREATE POLICY "properties_select" ON public.properties
  FOR SELECT USING (
    status = 'disponible'
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.property_id = properties.id
        AND c.tenant_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "properties_insert" ON public.properties;
CREATE POLICY "properties_insert" ON public.properties
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "properties_update" ON public.properties;
CREATE POLICY "properties_update" ON public.properties
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "properties_delete" ON public.properties;
CREATE POLICY "properties_delete" ON public.properties
  FOR DELETE USING (
    (owner_id = auth.uid() OR agency_id = auth.uid() OR public.is_admin() OR public.is_trusted_caller())
    AND NOT EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.property_id = properties.id
        AND c.status = 'contrat_actif'
    )
  );

-- -----------------------------------------------------------------------------
-- 5. SÉCURISATION DE PUBLIC.CONTRACTS (RLS, TRIGGERS & INDEX ANTI-DOUBLON)
-- -----------------------------------------------------------------------------
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Index partiel anti-doublon garantissant l'unicité du contrat actif par logement
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_contract_per_property
ON public.contracts (property_id)
WHERE status = 'contrat_actif';

-- Trigger de protection des colonnes pour le contrat (JSONB liste blanche)
CREATE OR REPLACE FUNCTION public.protect_contracts_tenant_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_json jsonb;
  v_new_json jsonb;
  v_whitelist text[] := ARRAY[
    'tenant_signature', 'tenant_signed', 'tenant_signed_at', 'updated_at'
  ];
BEGIN
  IF public.is_trusted_caller() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Si l'appelant est le locataire
  IF auth.uid() = OLD.tenant_id AND auth.uid() IS DISTINCT FROM OLD.owner_id AND auth.uid() IS DISTINCT FROM OLD.agency_id THEN
    -- Immuabilité de la signature : le locataire ne peut signer que s'il n'avait pas déjà signé
    IF OLD.tenant_signed = true THEN
      RAISE EXCEPTION 'Le contrat a déjà été signé par le preneur et ne peut plus être modifié.';
    END IF;

    -- Le statut du contrat doit être en attente de signature preneur
    IF OLD.status IS DISTINCT FROM 'en_attente_signature_locataire' AND OLD.status IS DISTINCT FROM 'brouillon' THEN
      RAISE EXCEPTION 'La signature du preneur n''est recevable qu''en phase d''attente de signature.';
    END IF;

    -- Seules les colonnes de signature et horodatage sont modifiables par le locataire
    v_old_json := to_jsonb(OLD) - v_whitelist;
    v_new_json := to_jsonb(NEW) - v_whitelist;

    IF v_new_json IS DISTINCT FROM v_old_json THEN
      RAISE EXCEPTION 'Tentative frauduleuse de modification des clauses ou conditions financières du contrat par le locataire.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_contracts_tenant_update ON public.contracts;
CREATE TRIGGER trg_protect_contracts_tenant_update
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.protect_contracts_tenant_update();

DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT USING (
    owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR tenant_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT WITH CHECK (
    (
      owner_id = auth.uid()
      OR agency_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = contracts.property_id
          AND (p.owner_id = auth.uid() OR p.agency_id = auth.uid())
      )
      OR public.is_admin()
      OR public.is_trusted_caller()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = contracts.tenant_id
    )
  );

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR tenant_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

-- -----------------------------------------------------------------------------
-- 6. SÉCURISATION DE PUBLIC.RENT_PAYMENTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.protect_rent_payments_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_json jsonb;
  v_new_json jsonb;
BEGIN
  IF public.is_trusted_caller() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Si l'appelant est le locataire
  IF auth.uid() = OLD.tenant_id AND auth.uid() IS DISTINCT FROM OLD.owner_id AND auth.uid() IS DISTINCT FROM OLD.agency_id THEN
    -- Cas 1 : Contestation d'un rejet
    IF OLD.status = 'rejete' THEN
      v_old_json := to_jsonb(OLD) - ARRAY['dispute_reason', 'rejection_contested', 'updated_at'];
      v_new_json := to_jsonb(NEW) - ARRAY['dispute_reason', 'rejection_contested', 'updated_at'];
      IF v_new_json IS DISTINCT FROM v_old_json THEN
        RAISE EXCEPTION 'Le locataire ne peut modifier que les motifs de contestation sur un loyer rejeté.';
      END IF;
      RETURN NEW;
    END IF;

    -- Cas 2 : Modification d'une déclaration en attente (status reste 'declare')
    IF OLD.status = 'declare' AND NEW.status = 'declare' THEN
      v_old_json := to_jsonb(OLD) - ARRAY['amount', 'payment_method', 'payment_date', 'notes', 'updated_at'];
      v_new_json := to_jsonb(NEW) - ARRAY['amount', 'payment_method', 'payment_date', 'notes', 'updated_at'];
      IF v_new_json IS DISTINCT FROM v_old_json THEN
        RAISE EXCEPTION 'Le locataire ne peut modifier le statut de validation de son loyer.';
      END IF;
      RETURN NEW;
    END IF;

    -- Toute autre modification directe du locataire est interdite (la confirmation passe par tenant_sign_receipt)
    RAISE EXCEPTION 'Action non autorisée sur cette déclaration de loyer.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_rent_payments_update ON public.rent_payments;
CREATE TRIGGER trg_protect_rent_payments_update
  BEFORE UPDATE ON public.rent_payments
  FOR EACH ROW EXECUTE FUNCTION public.protect_rent_payments_update();

DROP POLICY IF EXISTS "rent_payments_select" ON public.rent_payments;
CREATE POLICY "rent_payments_select" ON public.rent_payments
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "rent_payments_insert" ON public.rent_payments;
CREATE POLICY "rent_payments_insert" ON public.rent_payments
  FOR INSERT WITH CHECK (
    (
      tenant_id = auth.uid()
      AND status = 'declare'
      AND EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = rent_payments.contract_id
          AND c.tenant_id = auth.uid()
          AND c.owner_id = rent_payments.owner_id
      )
    )
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "rent_payments_update" ON public.rent_payments;
CREATE POLICY "rent_payments_update" ON public.rent_payments
  FOR UPDATE USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "rent_payments_delete" ON public.rent_payments;
CREATE POLICY "rent_payments_delete" ON public.rent_payments
  FOR DELETE USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

-- -----------------------------------------------------------------------------
-- 7. SÉCURISATION DE PUBLIC.CAUTIONS
-- -----------------------------------------------------------------------------
ALTER TABLE public.cautions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.protect_cautions_tenant_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_json jsonb;
  v_new_json jsonb;
BEGIN
  IF public.is_trusted_caller() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.tenant_id AND auth.uid() IS DISTINCT FROM OLD.owner_id AND auth.uid() IS DISTINCT FROM OLD.agency_id THEN
    v_old_json := to_jsonb(OLD) - ARRAY['tenant_signature', 'updated_at'];
    v_new_json := to_jsonb(NEW) - ARRAY['tenant_signature', 'updated_at'];

    IF v_new_json IS DISTINCT FROM v_old_json THEN
      RAISE EXCEPTION 'Le locataire ne peut modifier que sa signature sur la caution.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_cautions_tenant_update ON public.cautions;
CREATE TRIGGER trg_protect_cautions_tenant_update
  BEFORE UPDATE ON public.cautions
  FOR EACH ROW EXECUTE FUNCTION public.protect_cautions_tenant_update();

DROP POLICY IF EXISTS "cautions_select" ON public.cautions;
CREATE POLICY "cautions_select" ON public.cautions
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "cautions_insert" ON public.cautions;
CREATE POLICY "cautions_insert" ON public.cautions
  FOR INSERT WITH CHECK (
    (
      owner_id = auth.uid()
      OR agency_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = cautions.contract_id
          AND (c.owner_id = auth.uid() OR c.agency_id = auth.uid())
      )
      OR public.is_admin()
      OR public.is_trusted_caller()
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c2
      WHERE c2.id = cautions.contract_id
        AND c2.tenant_id = cautions.tenant_id
    )
  );

DROP POLICY IF EXISTS "cautions_update" ON public.cautions;
CREATE POLICY "cautions_update" ON public.cautions
  FOR UPDATE USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "cautions_delete" ON public.cautions;
CREATE POLICY "cautions_delete" ON public.cautions
  FOR DELETE USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

-- -----------------------------------------------------------------------------
-- 8. SÉCURISATION DE PUBLIC.RECEIPTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipts_select" ON public.receipts;
CREATE POLICY "receipts_select" ON public.receipts
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "receipts_insert" ON public.receipts;
CREATE POLICY "receipts_insert" ON public.receipts
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "receipts_update" ON public.receipts;
CREATE POLICY "receipts_update" ON public.receipts
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "receipts_delete" ON public.receipts;
CREATE POLICY "receipts_delete" ON public.receipts
  FOR DELETE USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

-- -----------------------------------------------------------------------------
-- 9. SÉCURISATION DE PUBLIC.RENTAL_APPLICATIONS
-- -----------------------------------------------------------------------------
ALTER TABLE public.rental_applications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.protect_rental_applications_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_trusted_caller() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.tenant_id AND auth.uid() IS DISTINCT FROM OLD.owner_id AND auth.uid() IS DISTINCT FROM OLD.agency_id THEN
    -- Le preneur peut annuler ou passer à contrat_signe_locataire
    IF NEW.status = 'annulee' THEN
      RETURN NEW;
    ELSIF OLD.status = 'en_attente_signature_locataire' AND NEW.status = 'contrat_signe_locataire' THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Transition de statut de candidature interdite au locataire (% -> %).', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_rental_applications_update ON public.rental_applications;
CREATE TRIGGER trg_protect_rental_applications_update
  BEFORE UPDATE ON public.rental_applications
  FOR EACH ROW EXECUTE FUNCTION public.protect_rental_applications_update();

DROP POLICY IF EXISTS "rental_applications_select" ON public.rental_applications;
CREATE POLICY "rental_applications_select" ON public.rental_applications
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "rental_applications_insert" ON public.rental_applications;
CREATE POLICY "rental_applications_insert" ON public.rental_applications
  FOR INSERT WITH CHECK (
    tenant_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = rental_applications.property_id
        AND p.status = 'disponible'
    )
  );

DROP POLICY IF EXISTS "rental_applications_update" ON public.rental_applications;
CREATE POLICY "rental_applications_update" ON public.rental_applications
  FOR UPDATE USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "rental_applications_delete" ON public.rental_applications;
CREATE POLICY "rental_applications_delete" ON public.rental_applications
  FOR DELETE USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

-- -----------------------------------------------------------------------------
-- 10. SÉCURISATION DE PUBLIC.MAINTENANCE_TICKETS
-- -----------------------------------------------------------------------------
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.protect_maintenance_tickets_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_json jsonb;
  v_new_json jsonb;
BEGIN
  IF public.is_trusted_caller() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.tenant_id AND auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    -- Le locataire peut mettre à jour description, photos ou marquer résolu si clôturé par lui
    v_old_json := to_jsonb(OLD) - ARRAY['description', 'photos', 'status', 'updated_at'];
    v_new_json := to_jsonb(NEW) - ARRAY['description', 'photos', 'status', 'updated_at'];

    IF v_new_json IS DISTINCT FROM v_old_json THEN
      RAISE EXCEPTION 'Le locataire ne peut modifier le coût ou l''artisan sur un ticket.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_maintenance_tickets_update ON public.maintenance_tickets;
CREATE TRIGGER trg_protect_maintenance_tickets_update
  BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.protect_maintenance_tickets_update();

DROP POLICY IF EXISTS "maintenance_tickets_select" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_select" ON public.maintenance_tickets
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "maintenance_tickets_insert" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_insert" ON public.maintenance_tickets
  FOR INSERT WITH CHECK (
    (
      tenant_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.property_id = maintenance_tickets.property_id
          AND c.tenant_id = auth.uid()
          AND c.status = 'contrat_actif'
      )
    )
    OR owner_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "maintenance_tickets_update" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_update" ON public.maintenance_tickets
  FOR UPDATE USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "maintenance_tickets_delete" ON public.maintenance_tickets;
CREATE POLICY "maintenance_tickets_delete" ON public.maintenance_tickets
  FOR DELETE USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

-- -----------------------------------------------------------------------------
-- 11. SÉCURISATION DE PUBLIC.DOCUMENT_VERIFICATIONS
-- -----------------------------------------------------------------------------
ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;

-- Verrouillage total : aucun INSERT/UPDATE client, lecture publique interdite directement
DROP POLICY IF EXISTS "doc_verif_no_public_select" ON public.document_verifications;
CREATE POLICY "doc_verif_no_public_select" ON public.document_verifications
  FOR SELECT USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "doc_verif_admin_write" ON public.document_verifications;
CREATE POLICY "doc_verif_admin_write" ON public.document_verifications
  FOR ALL USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

-- -----------------------------------------------------------------------------
-- 12. RPC ATOMIQUE : tenant_sign_receipt
-- -----------------------------------------------------------------------------
-- Permet au locataire d'apposer sa signature sur la quittance validée par le propriétaire
-- et de confirmer le rent_payment de façon strictement atomique et sécurisée.
CREATE OR REPLACE FUNCTION public.tenant_sign_receipt(
  p_receipt_id text,
  p_signature text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_receipt RECORD;
  v_payment RECORD;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_doc_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour signer une quittance.';
  END IF;

  IF p_signature IS NULL OR trim(p_signature) = '' THEN
    RAISE EXCEPTION 'Signature électronique obligatoire.';
  END IF;

  -- 1. Récupérer le reçu
  SELECT * INTO v_receipt
  FROM public.receipts r
  WHERE (r.id::text = p_receipt_id OR r.receipt_number = p_receipt_id OR r.token = p_receipt_id)
  LIMIT 1;

  IF v_receipt.id IS NULL THEN
    RAISE EXCEPTION 'Quittance introuvable.';
  END IF;

  -- 2. Vérifier que l'appelant est le locataire
  IF v_receipt.tenant_id <> v_uid THEN
    RAISE EXCEPTION 'Seul le locataire titulaire peut signer cette quittance.';
  END IF;

  -- 3. Récupérer le paiement associé
  SELECT * INTO v_payment
  FROM public.rent_payments p
  WHERE p.id = v_receipt.rent_payment_id OR p.contract_id = v_receipt.contract_id
  LIMIT 1;

  -- 4. Mise à jour de la quittance
  UPDATE public.receipts
  SET 
    status = 'FINALISE',
    updated_at = v_now
  WHERE id = v_receipt.id;

  -- 5. Mise à jour du paiement de loyer associé
  IF v_payment.id IS NOT NULL THEN
    UPDATE public.rent_payments
    SET 
      status = 'confirme',
      tenant_signature = p_signature,
      tenant_signed_at = v_now,
      confirmed_at = COALESCE(confirmed_at, v_now),
      finalized_at = v_now,
      updated_at = v_now
    WHERE id = v_payment.id;
  END IF;

  -- 6. Enregistrement automatique côté serveur dans document_verifications
  v_doc_hash := encode(digest(
    (v_receipt.receipt_number || '|' || v_receipt.amount::text || '|' || v_receipt.tenant_id::text || '|' || v_receipt.owner_id::text || '|' || v_now::text),
    'sha256'
  ), 'hex');

  INSERT INTO public.document_verifications (
    token,
    document_type,
    document_number,
    contract_number,
    status,
    document_hash,
    amount,
    currency,
    period_covered,
    owner_name,
    tenant_name,
    is_owner_signed,
    is_tenant_signed,
    tenant_signed_at,
    finalized_at
  ) VALUES (
    COALESCE(v_receipt.verification_token, v_receipt.token, 'tok_rec_' || encode(gen_random_bytes(16), 'hex')),
    'recu_loyer',
    v_receipt.receipt_number,
    v_receipt.contract_id::text,
    'valide',
    v_doc_hash,
    v_receipt.amount,
    'FCFA',
    COALESCE(v_receipt.period_covered, 'Période courante'),
    'Bailleur Certifié',
    'Locataire Certifié',
    true,
    true,
    v_now,
    v_now
  )
  ON CONFLICT (token) DO UPDATE SET
    status = 'valide',
    is_tenant_signed = true,
    tenant_signed_at = v_now,
    finalized_at = v_now,
    updated_at = v_now;

  RETURN jsonb_build_object(
    'success', true,
    'receipt_id', v_receipt.id,
    'receipt_number', v_receipt.receipt_number,
    'status', 'confirme',
    'finalized_at', v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tenant_sign_receipt(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_sign_receipt(text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 13. RPC SÉCURISÉES : verify_contract et verify_receipt (UNIQUEMENT PAR JETON)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_contract(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
  v_clean text := trim(COALESCE(p_token, ''));
  v_row RECORD;
  v_status text;
BEGIN
  IF v_clean = '' OR length(v_clean) < 8 THEN
    RETURN jsonb_build_object('isFound', false, 'error', 'Jeton invalide.');
  END IF;

  -- Recherche EXCLUSIVEMENT par jeton aléatoire
  SELECT 
    c.id,
    c.contract_number,
    c.status,
    c.start_date,
    c.end_date,
    c.owner_signed,
    c.tenant_signed,
    c.owner_signed_at,
    c.tenant_signed_at,
    c.created_at,
    c.verification_token,
    p_owner.full_name as owner_name,
    p_tenant.full_name as tenant_name,
    prop.type as property_type,
    prop.commune as property_commune,
    prop.city as property_city
  INTO v_row
  FROM public.contracts c
  LEFT JOIN public.profiles p_owner ON p_owner.id = c.owner_id
  LEFT JOIN public.profiles p_tenant ON p_tenant.id = c.tenant_id
  LEFT JOIN public.properties prop ON prop.id = c.property_id
  WHERE c.verification_token = v_clean OR c.token = v_clean
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'isFound', false,
      'status', 'introuvable',
      'message', 'Aucun contrat certifié ne correspond à ce jeton de vérification.'
    );
  END IF;

  -- Détermination du statut réel
  IF v_row.status = 'resilie' THEN
    v_status := 'revoque_annule';
  ELSIF v_row.status = 'termine' THEN
    v_status := 'expire';
  ELSIF COALESCE(v_row.owner_signed, false) AND COALESCE(v_row.tenant_signed, false) THEN
    v_status := 'valide';
  ELSE
    v_status := 'en_attente_signature';
  END IF;

  v_result := jsonb_build_object(
    'isFound', true,
    'status', v_status,
    'contractNumber', v_row.contract_number,
    'startDate', v_row.start_date,
    'endDate', v_row.end_date,
    'isOwnerSigned', COALESCE(v_row.owner_signed, false),
    'isTenantSigned', COALESCE(v_row.tenant_signed, false),
    'ownerSignedAt', v_row.owner_signed_at,
    'tenantSignedAt', v_row.tenant_signed_at,
    'maskedOwnerName', public.mask_name(v_row.owner_name),
    'maskedTenantName', public.mask_name(v_row.tenant_name),
    'propertyType', COALESCE(v_row.property_type, 'Logement résidentiel'),
    'propertyLocation', COALESCE(v_row.property_commune || ', ' || v_row.property_city, 'Côte d''Ivoire'),
    'verifiedAt', timezone('utc'::text, now())
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_receipt(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
  v_clean text := trim(COALESCE(p_token, ''));
  v_row RECORD;
  v_status text;
BEGIN
  IF v_clean = '' OR length(v_clean) < 8 THEN
    RETURN jsonb_build_object('isFound', false, 'error', 'Jeton invalide.');
  END IF;

  -- Recherche EXCLUSIVEMENT par jeton aléatoire
  SELECT 
    r.id,
    r.receipt_number,
    r.period_covered,
    r.created_at,
    r.type,
    r.status,
    r.verification_token,
    c.contract_number,
    p_owner.full_name as owner_name,
    p_tenant.full_name as tenant_name,
    prop.commune as property_commune,
    prop.city as property_city,
    pmt.status as payment_status,
    pmt.tenant_signature as payment_tenant_sig
  INTO v_row
  FROM public.receipts r
  LEFT JOIN public.contracts c ON c.id = r.contract_id
  LEFT JOIN public.rent_payments pmt ON pmt.id = r.rent_payment_id
  LEFT JOIN public.profiles p_owner ON p_owner.id = r.owner_id
  LEFT JOIN public.profiles p_tenant ON p_tenant.id = r.tenant_id
  LEFT JOIN public.properties prop ON prop.id = c.property_id
  WHERE r.verification_token = v_clean OR r.token = v_clean
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'isFound', false,
      'status', 'introuvable',
      'message', 'Aucune quittance certifiée ne correspond à ce jeton de vérification.'
    );
  END IF;

  -- Statut réel
  IF v_row.payment_status = 'confirme' OR v_row.status = 'FINALISE' OR v_row.payment_tenant_sig IS NOT NULL THEN
    v_status := 'valide';
  ELSE
    v_status := 'en_attente_signature';
  END IF;

  v_result := jsonb_build_object(
    'isFound', true,
    'status', v_status,
    'receiptNumber', v_row.receipt_number,
    'contractNumber', v_row.contract_number,
    'periodCovered', COALESCE(v_row.period_covered, 'Loyer mensuel'),
    'receiptType', COALESCE(v_row.type, 'quittance'),
    'createdAt', v_row.created_at,
    'isConfirmed', (v_status = 'valide'),
    'maskedOwnerName', public.mask_name(v_row.owner_name),
    'maskedTenantName', public.mask_name(v_row.tenant_name),
    'propertyLocation', COALESCE(v_row.property_commune || ', ' || v_row.property_city, 'Côte d''Ivoire'),
    'verifiedAt', timezone('utc'::text, now())
  );

  RETURN v_result;
END;
$$;

-- Droit d'exécution public pour les scanners QR sur verify_contract et verify_receipt
GRANT EXECUTE ON FUNCTION public.verify_contract(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_receipt(text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 14. RPC SÉCURISÉE : create_notification
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_notif_id UUID;
  v_allowed_types text[] := ARRAY[
    'candidature', 'demande', 'contrat', 'loyer', 'paiement',
    'caution', 'quittance', 'ticket', 'message', 'visite'
  ];
BEGIN
  IF v_sender IS NULL AND NOT public.is_trusted_caller() THEN
    RAISE EXCEPTION 'Authentification requise pour émettre une notification.';
  END IF;

  -- Liste blanche stricte des types de notification
  IF p_type NOT MEMBER OF v_allowed_types THEN
    RAISE EXCEPTION 'Type de notification non autorisé : %', p_type;
  END IF;

  -- Rejet des notifications système émises par un utilisateur ordinaire
  IF p_type = 'system' AND NOT public.is_admin() AND NOT public.is_trusted_caller() THEN
    RAISE EXCEPTION 'Émission de notification système réservée aux administrateurs.';
  END IF;

  -- Validation d'une relation réelle si émise par un utilisateur connecté
  IF v_sender IS NOT NULL AND NOT public.is_admin() AND NOT public.is_trusted_caller() THEN
    IF NOT (
      -- Même utilisateur (auto-rappel)
      v_sender = p_user_id
      -- Relation contractuelle
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE (c.owner_id = v_sender AND c.tenant_id = p_user_id)
           OR (c.tenant_id = v_sender AND c.owner_id = p_user_id)
           OR (c.agency_id = v_sender AND c.tenant_id = p_user_id)
      )
      -- Relation de candidature
      OR EXISTS (
        SELECT 1 FROM public.rental_applications ra
        WHERE (ra.owner_id = v_sender AND ra.tenant_id = p_user_id)
           OR (ra.tenant_id = v_sender AND ra.owner_id = p_user_id)
           OR (ra.agency_id = v_sender AND ra.tenant_id = p_user_id)
      )
      -- Relation de ticket
      OR EXISTS (
        SELECT 1 FROM public.maintenance_tickets mt
        WHERE (mt.owner_id = v_sender AND mt.tenant_id = p_user_id)
           OR (mt.tenant_id = v_sender AND mt.owner_id = p_user_id)
      )
    ) THEN
      RAISE EXCEPTION 'Action refusée : aucune relation locative établie entre l''émetteur et le destinataire.';
    END IF;
  END IF;

  INSERT INTO public.notifications (
    id, user_id, title, message, type, data, read, created_at
  ) VALUES (
    gen_random_uuid(), p_user_id, p_title, p_message, p_type, p_data, false, timezone('utc'::text, now())
  ) RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Suppression de l'insert direct pour notifications
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

COMMIT;
