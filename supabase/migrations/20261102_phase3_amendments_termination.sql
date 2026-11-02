-- =============================================================================
-- LOCATRUST - MIGRATION PHASE 3 : AVENANTS, RÉSILIATION ET SÉQUENCE DE FIN DE BAIL
-- Idempotente, exécutée dans une transaction sécurisée
-- =============================================================================

BEGIN;

-- 1. CRÉATION DE LA TABLE contract_amendments SI INEXISTANTE
CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  amendment_number TEXT NOT NULL,
  type TEXT NOT NULL,
  effective_date DATE NOT NULL,
  new_rent NUMERIC,
  clauses TEXT NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_signature TEXT,
  tenant_signature TEXT,
  owner_signed BOOLEAN DEFAULT false,
  tenant_signed BOOLEAN DEFAULT false,
  owner_signed_at TIMESTAMPTZ,
  tenant_signed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'en_attente_signature_locataire' CHECK (status IN ('en_attente_signature_locataire', 'signe', 'refuse', 'annule')),
  pdf_url TEXT,
  verification_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_amendments_contract_id ON public.contract_amendments(contract_id);
CREATE INDEX IF NOT EXISTS idx_amendments_status ON public.contract_amendments(status);
CREATE INDEX IF NOT EXISTS idx_amendments_tenant_id ON public.contract_amendments(tenant_id);

-- 2. POLITIQUES RLS SUR public.contract_amendments
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amendments_select" ON public.contract_amendments;
CREATE POLICY "amendments_select" ON public.contract_amendments
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "amendments_insert" ON public.contract_amendments;
CREATE POLICY "amendments_insert" ON public.contract_amendments
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "amendments_update" ON public.contract_amendments;
CREATE POLICY "amendments_update" ON public.contract_amendments
  FOR UPDATE USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "amendments_delete" ON public.contract_amendments;
CREATE POLICY "amendments_delete" ON public.contract_amendments
  FOR DELETE USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

-- 3. ASSURANCE DES COLONNES DE FIN DE CONTRAT SUR public.contracts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'closed_at') THEN
    ALTER TABLE public.contracts ADD COLUMN closed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'caution_status') THEN
    ALTER TABLE public.contracts ADD COLUMN caution_status TEXT DEFAULT 'en_cours';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'caution_restituted_amount') THEN
    ALTER TABLE public.contracts ADD COLUMN caution_restituted_amount NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'termination_effective_date') THEN
    ALTER TABLE public.contracts ADD COLUMN termination_effective_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'termination_reason') THEN
    ALTER TABLE public.contracts ADD COLUMN termination_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'deductions_amount') THEN
    ALTER TABLE public.contracts ADD COLUMN deductions_amount NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 4. RPC ATOMIQUE DE CLÔTURE DE BAIL & REMISE EN LOCATION
CREATE OR REPLACE FUNCTION public.terminate_contract_and_restore_property(
  p_contract_id UUID,
  p_effective_date DATE,
  p_reason TEXT,
  p_deductions NUMERIC,
  p_restitution NUMERIC,
  p_make_available BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_contract RECORD;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  IF v_uid IS NULL AND NOT public.is_trusted_caller() THEN
    RAISE EXCEPTION 'Authentification requise pour clôturer un bail.';
  END IF;

  SELECT * INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id;

  IF v_contract.id IS NULL THEN
    RAISE EXCEPTION 'Contrat introuvable.';
  END IF;

  -- Seul le propriétaire, l'agence mandataire ou l'admin peut initier la clôture
  IF v_contract.owner_id <> v_uid AND v_contract.agency_id <> v_uid AND NOT public.is_admin() AND NOT public.is_trusted_caller() THEN
    RAISE EXCEPTION 'Action réservée au bailleur du contrat.';
  END IF;

  -- 1. Clôture définitive du contrat (statut immuable 'termine')
  UPDATE public.contracts
  SET
    status = 'termine',
    closed_at = v_now,
    termination_effective_date = p_effective_date,
    termination_reason = p_reason,
    deductions_amount = COALESCE(p_deductions, 0),
    caution_restituted_amount = COALESCE(p_restitution, 0),
    caution_status = CASE WHEN COALESCE(p_restitution, 0) > 0 THEN 'restitue' ELSE 'retenu' END,
    updated_at = v_now
  WHERE id = p_contract_id;

  -- 2. Remise en location du bien si demandée
  IF p_make_available AND v_contract.property_id IS NOT NULL THEN
    UPDATE public.properties
    SET
      status = 'disponible',
      updated_at = v_now
    WHERE id = v_contract.property_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'contract_id', p_contract_id,
    'status', 'termine',
    'closed_at', v_now,
    'property_available', p_make_available
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.terminate_contract_and_restore_property(UUID, DATE, TEXT, NUMERIC, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.terminate_contract_and_restore_property(UUID, DATE, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

COMMIT;
