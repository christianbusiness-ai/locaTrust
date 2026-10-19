-- supabase/migrations/20261019_add_payment_allocations_columns.sql
-- Ajout des colonnes d'allocations automatiques et périodes couvertes sur rent_payments

DO $$
BEGIN
  -- 1. Colonne allocations (JSONB structuré des mois couverts)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'allocations'
  ) THEN
    ALTER TABLE public.rent_payments ADD COLUMN allocations JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- 2. Colonne period_start (ex: "Octobre 2027")
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'period_start'
  ) THEN
    ALTER TABLE public.rent_payments ADD COLUMN period_start TEXT;
  END IF;

  -- 3. Colonne period_end (ex: "Novembre 2027")
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'period_end'
  ) THEN
    ALTER TABLE public.rent_payments ADD COLUMN period_end TEXT;
  END IF;

  -- 4. Colonne periods_covered (Array text des mois)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'periods_covered'
  ) THEN
    ALTER TABLE public.rent_payments ADD COLUMN periods_covered TEXT[];
  END IF;

  -- 5. Colonne remaining_credit (Crédit locatif restant)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'remaining_credit'
  ) THEN
    ALTER TABLE public.rent_payments ADD COLUMN remaining_credit NUMERIC DEFAULT 0;
  END IF;
END $$;
