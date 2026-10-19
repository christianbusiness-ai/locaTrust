-- =============================================================================
-- LOCATRUST — MIGRATION WORKFLOW SIGNATURES & TRANSMISSION DES REÇUS DE LOYER
-- Date : 2026-10-19
-- Description :
-- 1. Ajoute les colonnes de signatures réelles, horodatages et transmission sur receipts et rent_payments.
-- 2. Supprime les contraintes CHECK restrictives sur status pour autoriser les statuts du nouveau workflow :
--    - EN_ATTENTE_VERIFICATION / declare
--    - VERIFIE_PAR_PROPRIETAIRE
--    - EN_ATTENTE_SIGNATURE_LOCATAIRE / en_attente_signature_locataire
--    - FINALISE / certifie / confirme
--    - REFUSE / refuse
-- =============================================================================

DO $$
BEGIN
    -- 1. Assouplissement des contraintes de statut
    ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_status_check;
    ALTER TABLE public.receipts DROP CONSTRAINT IF EXISTS receipts_status_check;
    ALTER TABLE public.cautions DROP CONSTRAINT IF EXISTS cautions_status_check;

    -- 2. Colonnes sur RECEIPTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'owner_signature') THEN
        ALTER TABLE public.receipts ADD COLUMN owner_signature TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'owner_signed_at') THEN
        ALTER TABLE public.receipts ADD COLUMN owner_signed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'tenant_signature') THEN
        ALTER TABLE public.receipts ADD COLUMN tenant_signature TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'tenant_signed_at') THEN
        ALTER TABLE public.receipts ADD COLUMN tenant_signed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'signer_identity') THEN
        ALTER TABLE public.receipts ADD COLUMN signer_identity TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'signer_role') THEN
        ALTER TABLE public.receipts ADD COLUMN signer_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'transmitted_at') THEN
        ALTER TABLE public.receipts ADD COLUMN transmitted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' AND column_name = 'finalized_at') THEN
        ALTER TABLE public.receipts ADD COLUMN finalized_at TIMESTAMPTZ;
    END IF;

    -- 3. Colonnes sur RENT_PAYMENTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'owner_signature') THEN
        ALTER TABLE public.rent_payments ADD COLUMN owner_signature TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'owner_signed_at') THEN
        ALTER TABLE public.rent_payments ADD COLUMN owner_signed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'tenant_signature') THEN
        ALTER TABLE public.rent_payments ADD COLUMN tenant_signature TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'tenant_signed_at') THEN
        ALTER TABLE public.rent_payments ADD COLUMN tenant_signed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'transmitted_at') THEN
        ALTER TABLE public.rent_payments ADD COLUMN transmitted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'finalized_at') THEN
        ALTER TABLE public.rent_payments ADD COLUMN finalized_at TIMESTAMPTZ;
    END IF;
END $$;
