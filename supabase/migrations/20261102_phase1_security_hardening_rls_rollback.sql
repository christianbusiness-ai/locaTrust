-- =============================================================================
-- LOCATRUST - ROLLBACK MIGRATION PHASE 1 V2
-- =============================================================================

BEGIN;

-- 1. Supprimer l'index anti-doublon
DROP INDEX IF EXISTS public.idx_unique_active_contract_per_property;

-- 2. Supprimer les triggers ajoutés
DROP TRIGGER IF EXISTS trg_protect_profiles_sensitive_columns ON public.profiles;
DROP TRIGGER IF EXISTS trg_check_profiles_insert ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_contracts_tenant_update ON public.contracts;
DROP TRIGGER IF EXISTS trg_protect_rent_payments_update ON public.rent_payments;
DROP TRIGGER IF EXISTS trg_protect_cautions_tenant_update ON public.cautions;
DROP TRIGGER IF EXISTS trg_protect_rental_applications_update ON public.rental_applications;
DROP TRIGGER IF EXISTS trg_protect_maintenance_tickets_update ON public.maintenance_tickets;

-- 3. Supprimer les fonctions de trigger
DROP FUNCTION IF EXISTS public.protect_profiles_sensitive_columns();
DROP FUNCTION IF EXISTS public.check_profiles_insert();
DROP FUNCTION IF EXISTS public.protect_contracts_tenant_update();
DROP FUNCTION IF EXISTS public.protect_rent_payments_update();
DROP FUNCTION IF EXISTS public.protect_cautions_tenant_update();
DROP FUNCTION IF EXISTS public.protect_rental_applications_update();
DROP FUNCTION IF EXISTS public.protect_maintenance_tickets_update();

-- 4. Supprimer les RPCs créées
DROP FUNCTION IF EXISTS public.tenant_sign_receipt(text, text);
DROP FUNCTION IF EXISTS public.verify_contract(text);
DROP FUNCTION IF EXISTS public.verify_receipt(text);
DROP FUNCTION IF EXISTS public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.is_trusted_caller();
DROP FUNCTION IF EXISTS public.mask_name(text);

-- 5. Rétablir les policies de base pour profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());

COMMIT;
