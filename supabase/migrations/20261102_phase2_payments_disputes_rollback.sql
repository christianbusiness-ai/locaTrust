-- =============================================================================
-- LOCATRUST - ROLLBACK MIGRATION PHASE 2
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.admin_resolve_dispute(UUID, TEXT, TEXT);
DROP TABLE IF EXISTS public.payment_disputes CASCADE;

COMMIT;

