-- =============================================================================
-- LOCATRUST - ROLLBACK MIGRATION PHASE 3
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.terminate_contract_and_restore_property(UUID, DATE, TEXT, NUMERIC, NUMERIC, BOOLEAN);
DROP TABLE IF EXISTS public.contract_amendments CASCADE;

COMMIT;

