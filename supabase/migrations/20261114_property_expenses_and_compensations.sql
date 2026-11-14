-- =============================================================================
-- MIGRATION : MODULE DE GESTION DES DÉPENSES, RÉPARATIONS ET COMPENSATIONS
-- Date : 14 Novembre 2026
-- Conforme : Loi ivoirienne n° 2019-576 & AUDCG OHADA
-- =============================================================================

-- 1. TABLE DES DÉPENSES IMMOBILIÈRES & INTERVENTIONS
CREATE TABLE IF NOT EXISTS public.property_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number TEXT UNIQUE NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  maintenance_ticket_id UUID REFERENCES public.maintenance_tickets(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  category TEXT NOT NULL DEFAULT 'autre' CHECK (
    category IN (
      'plomberie', 'electricite', 'menuiserie', 'serrurerie', 'peinture',
      'toiture', 'entretien_general', 'reparation_equipement', 'nettoyage', 'autre'
    )
  ),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Qui a payé la facture
  paid_by TEXT NOT NULL DEFAULT 'proprietaire' CHECK (paid_by IN ('proprietaire', 'locataire', 'agence')),
  payer_id UUID REFERENCES public.profiles(id),
  
  -- Qui est légalement et contractuellement responsable du coût
  responsible_party TEXT NOT NULL DEFAULT 'proprietaire' CHECK (responsible_party IN ('proprietaire', 'locataire', 'partage')),
  
  payment_method TEXT NOT NULL DEFAULT 'especes' CHECK (
    payment_method IN ('especes', 'orange_money', 'mtn_money', 'wave', 'moov_money', 'virement', 'autre')
  ),
  
  target_rent_month TEXT, -- Ex: '2026-11' ou 'Novembre 2026'
  receipt_url TEXT,       -- Justificatif / Facture
  photos TEXT[] DEFAULT '{}',
  
  -- Circuit de validation
  status TEXT NOT NULL DEFAULT 'approuvee' CHECK (
    status IN (
      'en_attente_validation',
      'informations_demandees',
      'approuvee',
      'refusee',
      'compensee_partiellement',
      'compensee_totalement',
      'remboursee_partiellement',
      'remboursee_totalement'
    )
  ),
  
  refusal_reason TEXT,
  information_request TEXT,
  
  -- Suivi des flux financiers
  amount_reimbursed NUMERIC NOT NULL DEFAULT 0 CHECK (amount_reimbursed >= 0),
  amount_compensated NUMERIC NOT NULL DEFAULT 0 CHECK (amount_compensated >= 0),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index pour requêtes performantes
CREATE INDEX IF NOT EXISTS idx_property_expenses_property_id ON public.property_expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_property_expenses_contract_id ON public.property_expenses(contract_id);
CREATE INDEX IF NOT EXISTS idx_property_expenses_owner_id ON public.property_expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_property_expenses_agency_id ON public.property_expenses(agency_id);
CREATE INDEX IF NOT EXISTS idx_property_expenses_tenant_id ON public.property_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_expenses_status ON public.property_expenses(status);

-- 2. TABLE DES REMBOURSEMENTS DE RÉPARATIONS (SCÉNARIO B)
CREATE TABLE IF NOT EXISTS public.expense_reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_number TEXT UNIQUE NOT NULL,
  expense_id UUID NOT NULL REFERENCES public.property_expenses(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  
  payer_id UUID NOT NULL REFERENCES public.profiles(id),
  payer_type TEXT NOT NULL DEFAULT 'locataire' CHECK (payer_type IN ('locataire', 'proprietaire', 'agence')),
  beneficiary_id UUID NOT NULL REFERENCES public.profiles(id),
  beneficiary_type TEXT NOT NULL DEFAULT 'proprietaire' CHECK (beneficiary_type IN ('proprietaire', 'locataire', 'agence')),
  
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reimbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'wave' CHECK (
    payment_method IN ('especes', 'orange_money', 'mtn_money', 'wave', 'moov_money', 'virement', 'autre')
  ),
  transaction_reference TEXT,
  receipt_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'valide' CHECK (status IN ('en_attente', 'valide', 'rejete')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_expense_id ON public.expense_reimbursements(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_contract_id ON public.expense_reimbursements(contract_id);

-- 3. TABLE DES COMPENSATIONS SUR LOYERS (SCÉNARIO C)
CREATE TABLE IF NOT EXISTS public.rent_compensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compensation_number TEXT UNIQUE NOT NULL,
  expense_id UUID NOT NULL REFERENCES public.property_expenses(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  target_rent_month TEXT NOT NULL, -- Ex: '2026-11'
  
  authorized_amount NUMERIC NOT NULL CHECK (authorized_amount > 0),
  applied_amount NUMERIC NOT NULL DEFAULT 0 CHECK (applied_amount >= 0),
  authorized_by UUID NOT NULL REFERENCES public.profiles(id),
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  
  status TEXT NOT NULL DEFAULT 'approuvee' CHECK (
    status IN ('en_attente', 'approuvee', 'appliquee', 'annulee')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_rent_compensations_expense_id ON public.rent_compensations(expense_id);
CREATE INDEX IF NOT EXISTS idx_rent_compensations_contract_id ON public.rent_compensations(contract_id);
CREATE INDEX IF NOT EXISTS idx_rent_compensations_target_month ON public.rent_compensations(target_rent_month);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.property_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_compensations ENABLE ROW LEVEL SECURITY;

-- Politiques pour property_expenses
DROP POLICY IF EXISTS "property_expenses_select" ON public.property_expenses;
CREATE POLICY "property_expenses_select" ON public.property_expenses
  FOR SELECT USING (
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    tenant_id = auth.uid() OR
    payer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_expenses.property_id AND (p.owner_id = auth.uid() OR p.agency_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = property_expenses.contract_id AND (c.tenant_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "property_expenses_insert" ON public.property_expenses;
CREATE POLICY "property_expenses_insert" ON public.property_expenses
  FOR INSERT WITH CHECK (
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    tenant_id = auth.uid() OR
    payer_id = auth.uid()
  );

DROP POLICY IF EXISTS "property_expenses_update" ON public.property_expenses;
CREATE POLICY "property_expenses_update" ON public.property_expenses
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    agency_id = auth.uid() OR
    (tenant_id = auth.uid() AND status = 'en_attente_validation')
  );

-- Politiques pour expense_reimbursements
DROP POLICY IF EXISTS "expense_reimbursements_select" ON public.expense_reimbursements;
CREATE POLICY "expense_reimbursements_select" ON public.expense_reimbursements
  FOR SELECT USING (
    payer_id = auth.uid() OR
    beneficiary_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.property_expenses pe
      WHERE pe.id = expense_reimbursements.expense_id AND (pe.owner_id = auth.uid() OR pe.agency_id = auth.uid() OR pe.tenant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "expense_reimbursements_insert" ON public.expense_reimbursements;
CREATE POLICY "expense_reimbursements_insert" ON public.expense_reimbursements
  FOR INSERT WITH CHECK (
    payer_id = auth.uid() OR
    beneficiary_id = auth.uid()
  );

-- Politiques pour rent_compensations
DROP POLICY IF EXISTS "rent_compensations_select" ON public.rent_compensations;
CREATE POLICY "rent_compensations_select" ON public.rent_compensations
  FOR SELECT USING (
    authorized_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = rent_compensations.contract_id AND (c.owner_id = auth.uid() OR c.tenant_id = auth.uid() OR c.agency_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "rent_compensations_insert" ON public.rent_compensations;
CREATE POLICY "rent_compensations_insert" ON public.rent_compensations
  FOR INSERT WITH CHECK (
    authorized_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = rent_compensations.contract_id AND (c.owner_id = auth.uid() OR c.agency_id = auth.uid())
    )
  );

