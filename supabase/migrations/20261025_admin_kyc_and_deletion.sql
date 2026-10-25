-- =============================================================================
-- LOCATRUST - MIGRATION ADMIN KYC & SUPPRESSION UTILISATEUR
-- Date: 2026-10-25
-- Permet à l'administrateur de certifier KYC et supprimer des utilisateurs de la BDD
-- =============================================================================

-- 1. FONCTION RPC ADMIN_VERIFY_USER_KYC
CREATE OR REPLACE FUNCTION public.admin_verify_user_kyc(
  target_user_id UUID,
  new_status TEXT,
  reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    verification_status = new_status,
    updated_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- 2. FONCTION RPC ADMIN_DELETE_USER
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Supprimer le profil (les clés étrangères ON DELETE CASCADE se chargent du reste)
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- Si auth.users existe, tenter la suppression
  BEGIN
    DELETE FROM auth.users WHERE id = target_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorer si l'utilisateur auth n'existe pas ou permissions restreintes
  END;

  RETURN true;
END;
$$;

-- 3. POLICIES SUR PUBLIC.PROFILES POUR L'ADMIN
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (
    public.is_admin() OR auth.uid() = id
  );

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    public.is_admin() OR auth.uid() = id
  );
