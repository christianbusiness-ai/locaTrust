-- =============================================================================
-- LOCATRUST - MIGRATION PHASE 2 : PAIEMENTS, GESTION DES LITIGES & ARBITRAGE
-- Idempotente, exécutée dans une transaction sécurisée
-- =============================================================================

BEGIN;

-- 1. CRÉATION DE LA TABLE payment_disputes SI INEXISTANTE
CREATE TABLE IF NOT EXISTS public.payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.rent_payments(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_in_dispute NUMERIC NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  dispute_reason TEXT NOT NULL,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'arbitrage_requis' CHECK (status IN ('arbitrage_requis', 'en_cours', 'resolu', 'rejete')),
  resolution_verdict TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_disputes_payment_id ON public.payment_disputes(payment_id);
CREATE INDEX IF NOT EXISTS idx_disputes_contract_id ON public.payment_disputes(contract_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.payment_disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_tenant_id ON public.payment_disputes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disputes_owner_id ON public.payment_disputes(owner_id);

-- 2. POLITIQUES RLS SUR public.payment_disputes
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select" ON public.payment_disputes;
CREATE POLICY "disputes_select" ON public.payment_disputes
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR agency_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "disputes_insert" ON public.payment_disputes;
CREATE POLICY "disputes_insert" ON public.payment_disputes
  FOR INSERT WITH CHECK (
    tenant_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_admin()
    OR public.is_trusted_caller()
  );

DROP POLICY IF EXISTS "disputes_update" ON public.payment_disputes;
CREATE POLICY "disputes_update" ON public.payment_disputes
  FOR UPDATE USING (
    public.is_admin()
    OR public.is_trusted_caller()
    OR (
      -- Les parties peuvent compléter les motifs avant résolution
      (tenant_id = auth.uid() OR owner_id = auth.uid())
      AND status = 'arbitrage_requis'
    )
  );

DROP POLICY IF EXISTS "disputes_delete" ON public.payment_disputes;
CREATE POLICY "disputes_delete" ON public.payment_disputes
  FOR DELETE USING (
    public.is_admin()
    OR public.is_trusted_caller()
  );

-- 3. RPC ARBITRAGE ADMINISTRATEUR : admin_resolve_dispute
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id UUID,
  p_verdict TEXT,
  p_decision TEXT -- 'locataire_confirme' (loyer validé) ou 'bailleur_maintenu' (rejet définitif)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_uid UUID := auth.uid();
  v_dispute RECORD;
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  IF NOT public.is_admin() AND NOT public.is_trusted_caller() THEN
    RAISE EXCEPTION 'Action réservée exclusivement aux administrateurs LocaTrust.';
  END IF;

  SELECT * INTO v_dispute
  FROM public.payment_disputes
  WHERE id = p_dispute_id;

  IF v_dispute.id IS NULL THEN
    RAISE EXCEPTION 'Dossier de litige introuvable.';
  END IF;

  -- 1. Mise à jour du litige
  UPDATE public.payment_disputes
  SET
    status = 'resolu',
    resolution_verdict = p_verdict,
    resolved_at = v_now,
    resolved_by = v_admin_uid,
    updated_at = v_now
  WHERE id = p_dispute_id;

  -- 2. Application sur le paiement de loyer
  IF v_dispute.payment_id IS NOT NULL THEN
    IF p_decision = 'locataire_confirme' THEN
      UPDATE public.rent_payments
      SET
        status = 'confirme',
        rejection_contested = false,
        confirmed_at = v_now,
        updated_at = v_now
      WHERE id = v_dispute.payment_id;
    ELSE
      UPDATE public.rent_payments
      SET
        status = 'rejete',
        rejection_contested = false,
        updated_at = v_now
      WHERE id = v_dispute.payment_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', p_dispute_id,
    'verdict', p_verdict,
    'decision', p_decision,
    'resolved_at', v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
