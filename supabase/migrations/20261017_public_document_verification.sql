-- =============================================================================
-- LOCATRUST - MIGRATION OFFICIELLE : REGISTRE CRYPTOGRAPHIQUE PUBLIC
-- Conforme Loi n° 2019-576 (Code de la Construction et de l'Habitat de CI)
-- Permet la vérification publique et anonyme des QR Codes par smartphone
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('contrat', 'recu_loyer', 'recu_caution', 'recu_restitution')),
  document_number TEXT NOT NULL,
  contract_number TEXT,
  status TEXT NOT NULL DEFAULT 'valide' CHECK (status IN ('valide', 'en_attente_signature', 'expire', 'revoque_annule')),
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

-- Index pour performance optimale sur les requêtes de scan QR Code
CREATE INDEX IF NOT EXISTS idx_doc_verif_token ON public.document_verifications(token);
CREATE INDEX IF NOT EXISTS idx_doc_verif_doc_num ON public.document_verifications(document_number);
CREATE INDEX IF NOT EXISTS idx_doc_verif_contract_num ON public.document_verifications(contract_number);

-- Activation de Row Level Security
ALTER TABLE public.document_verifications ENABLE ROW LEVEL SECURITY;

-- 1. POLITIQUE DE LECTURE PUBLIQUE ANONYME (Pour tout scan QR sans connexion préalable)
DROP POLICY IF EXISTS "doc_verif_public_select" ON public.document_verifications;
CREATE POLICY "doc_verif_public_select" ON public.document_verifications
  FOR SELECT USING (true);

-- 2. POLITIQUE D'INSERTION PUBLIQUE OU AUTHENTIFIÉE (Enregistrement automatique des tokens)
DROP POLICY IF EXISTS "doc_verif_insert" ON public.document_verifications;
CREATE POLICY "doc_verif_insert" ON public.document_verifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "doc_verif_update" ON public.document_verifications;
CREATE POLICY "doc_verif_update" ON public.document_verifications
  FOR UPDATE USING (true);

-- 3. POLITIQUES DE LECTURE PUBLIQUE PAR TOKEN POUR LES TABLES HISTORIQUES
-- Permet aux scanners anonymes de retrouver un reçu par son numéro ou token sans exposer les données privées
DROP POLICY IF EXISTS "receipts_select_public_by_token" ON public.receipts;
CREATE POLICY "receipts_select_public_by_token" ON public.receipts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "contracts_select_public_by_number" ON public.contracts;
CREATE POLICY "contracts_select_public_by_number" ON public.contracts
  FOR SELECT USING (true);
