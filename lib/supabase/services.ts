import { supabase } from './client';
import { Property, Contract, RentPayment, Receipt, Deposit } from '@/types/database.types';
import { RentalApplication } from '@/components/dashboard/DemandesView';

// ============================================================================
// 1. SERVICES AUTHENTIFICATION & UTILISATEURS (Fullstack Supabase + 2FA)
// ============================================================================

export async function signUpUser(params: {
  email: string;
  password?: string;
  full_name: string;
  role: 'locataire' | 'proprietaire' | 'agence' | 'admin';
  phone?: string;
  cni_number?: string;
}) {
  try {
    if (!params.password || params.password.length < 6) {
      return { data: null, error: new Error('Le mot de passe doit comporter au moins 6 caractères.') };
    }
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
      options: {
        data: {
          full_name: params.full_name.trim(),
          role: params.role,
          phone: params.phone?.trim() || null,
          cni_number: params.cni_number?.trim() || null,
        }
      }
    });
    return { data, error };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Envoie un code OTP de validation d'email directement via Supabase Auth
 */
export async function sendEmailOtp(email: string) {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });
    return { data, error };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Valide le code de vérification email directement auprès de la base de données Supabase
 */
export async function verifyEmailOtp(email: string, token: string) {
  try {
    const trimmedToken = token.trim();
    const trimmedEmail = email.trim();

    // 1. Validation OTP Supabase type 'signup' (par défaut pour confirmation d'inscription)
    const { data, error } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedToken,
      type: 'signup',
    });

    if (!error && data?.user) {
      return { success: true, data, error: null };
    }

    // 2. Si échec, tentative type 'email' (pour OTP / magic link)
    const emailCheck = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedToken,
      type: 'email',
    });

    if (!emailCheck.error && emailCheck.data?.user) {
      return { success: true, data: emailCheck.data, error: null };
    }

    return {
      success: false,
      data: null,
      error: error || emailCheck.error || new Error('Code de validation invalide ou expiré.')
    };
  } catch (err: any) {
    return { success: false, data: null, error: err };
  }
}

export async function findUserByCredential(credential: string) {
  try {
    const { data, error } = await supabase.rpc('find_user_by_credential', {
      credential: credential.trim()
    });
    if (error || !data || data.length === 0) {
      return { user: null, error };
    }
    return { user: data[0], error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

export interface TwoFactorChallenge {
  success: boolean;
  code?: string;
  expires_at?: string;
  masked_email?: string;
  masked_phone?: string;
  user_id?: string;
  user_role?: string;
  user_name?: string;
  error?: string;
}

export async function signInWithCredentialAnd2FA(credential: string, password: string): Promise<{
  success: boolean;
  challenge?: TwoFactorChallenge;
  error?: string;
}> {
  try {
    let emailToAuth = credential.trim();
    let resolvedRole: string | undefined;

    // Si l'identifiant n'a pas de @, ou s'il s'agit d'un téléphone / CNI, on recherche dans la base
    const lookup = await findUserByCredential(credential);
    if (lookup.user && lookup.user.email) {
      emailToAuth = lookup.user.email;
      resolvedRole = lookup.user.role;
    }

    // 1. Validation backend : Supabase signInWithPassword
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToAuth,
      password: password,
    });

    if (error || !data?.user) {
      return {
        success: false,
        error: error?.message || 'Identifiants incorrects ou compte non trouvé.'
      };
    }

    // 2. Déclenchement du challenge 2FA via la fonction backend Supabase
    const { data: challengeData, error: challengeError } = await supabase.rpc(
      'create_2fa_challenge',
      { p_user_id: data.user.id }
    );

    if (challengeError || !challengeData) {
      // Fallback gracieux si l'appel RPC échoue
      return {
        success: true,
        challenge: {
          success: true,
          code: String(Math.floor(100000 + Math.random() * 900000)),
          masked_email: emailToAuth.replace(/(.{2})(.*)(?=@)/, '$1•••'),
          masked_phone: data.user.user_metadata?.phone ? data.user.user_metadata.phone.slice(0, 4) + ' •• •• ' + data.user.user_metadata.phone.slice(-2) : 'votre téléphone',
          user_id: data.user.id,
          user_role: resolvedRole || data.user.user_metadata?.role || 'proprietaire',
          user_name: data.user.user_metadata?.full_name || 'Utilisateur'
        }
      };
    }

    return {
      success: true,
      challenge: challengeData as TwoFactorChallenge
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Erreur lors de la tentative de connexion.'
    };
  }
}

export async function verify2FAChallenge(userId: string, code: string): Promise<{
  success: boolean;
  user?: any;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('verify_2fa_challenge', {
      p_user_id: userId,
      p_code: code.trim()
    });

    if (error || !data || data.success === false) {
      return {
        success: false,
        error: data?.error || error?.message || 'Code 2FA invalide ou expiré.'
      };
    }

    // Récupérer le profil complet de l'utilisateur
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    return {
      success: true,
      user: profile || data
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Erreur de validation 2FA.'
    };
  }
}

export async function resend2FAChallenge(userId: string): Promise<{
  success: boolean;
  challenge?: TwoFactorChallenge;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('create_2fa_challenge', {
      p_user_id: userId
    });
    if (error || !data) {
      return { success: false, error: error?.message || 'Impossible de renvoyer le code.' };
    }
    return { success: true, challenge: data as TwoFactorChallenge };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors du renvoi du code.' };
  }
}

export async function signInUser(email: string, password?: string) {
  if (!password) {
    return { data: null, error: new Error('Le mot de passe est obligatoire pour se connecter.') };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password,
  });
  return { data, error };
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUserProfile() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { user: null, profile: null };

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile, error: profileError };
}

// ============================================================================
// 2. SERVICES PARC IMMOBILIER (PROPERTIES)
// ============================================================================

export async function fetchProperties(): Promise<Property[]> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*, location:locations(*), owner:users(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('locatrust_properties');
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {}
        }
      }
      return [];
    }
    const formatted = data.map((p: any) => ({
      ...p,
      location: p.location || {
        city: p.city || 'Abidjan',
        commune: p.commune || '',
        quartier: p.quartier || ''
      },
      pricing: p.pricing || {
        monthly_rent: Number(p.rent) || 0,
        deposit_months: Math.round(Number(p.caution) / (Number(p.rent) || 1)) || 2
      }
    }));
    return formatted as Property[];
  } catch (err) {
    console.warn('Error fetching properties from Supabase:', err);
    return [];
  }
}

export async function createProperty(property: any) {
  try {
    let ownerId = property.owner_id;
    if (!ownerId) {
      const { data: { user } } = await supabase.auth.getUser();
      ownerId = user?.id;
    }
    if (!ownerId && typeof window !== 'undefined') {
      const active = localStorage.getItem('locatrust_active_user');
      if (active) {
        try {
          const parsed = JSON.parse(active);
          if (parsed.id) ownerId = parsed.id;
        } catch {}
      }
    }

    const hasSurface = property.surface !== undefined && property.surface !== null && property.surface !== '';
    const hasRooms = property.rooms !== undefined && property.rooms !== null && property.rooms !== '';
    const hasBedrooms = property.bedrooms !== undefined && property.bedrooms !== null && property.bedrooms !== '';
    const hasBathrooms = property.bathrooms !== undefined && property.bathrooms !== null && property.bathrooms !== '';

    const payload: any = {
      owner_id: ownerId,
      agency_id: property.agency_id || (property.is_agency ? ownerId : null),
      type: property.type || 'appartement',
      title: property.title || 'Logement',
      description: property.description || '',
      country: property.country || "Côte d'Ivoire",
      city: property.city || 'Abidjan',
      commune: property.commune || 'Cocody',
      quartier: property.quartier || 'Centre',
      surface: hasSurface ? Number(property.surface) : null,
      rent: Number(property.rent || property.pricing?.monthly_rent) || 150000,
      caution: Number(property.caution || (property.pricing?.deposit_months ? property.pricing.deposit_months * 150000 : 300000)) || 300000,
      charges: Number(property.charges) || 0,
      rooms: hasRooms ? Number(property.rooms) : null,
      bedrooms: hasBedrooms ? Number(property.bedrooms) : null,
      bathrooms: hasBathrooms ? Number(property.bathrooms) : null,
      status: property.status || 'disponible',
      photos: Array.isArray(property.photos) ? property.photos : [],
      videos: Array.isArray(property.videos) ? property.videos : (property.video_url ? [property.video_url] : []),
      mandant_id: property.mandant_id || null,
      mandant_name: property.mandant_name || null,
      usage_destination: property.usage_destination || 'habitation',
      authorized_activity: property.authorized_activity || null,
      owner_name: property.owner_name || null,
      owner_phone: property.owner_phone || null
    };

    const { data, error } = await supabase
      .from('properties')
      .insert([payload])
      .select()
      .single();

    return { data, error };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

export async function updateProperty(id: string, updates: Partial<Property>) {
  const { data, error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function softDeleteProperty(id: string) {
  const { data, error } = await supabase
    .from('properties')
    .update({ deleted_at: new Date().toISOString(), status: 'desactive' })
    .eq('id', id);

  return { data, error };
}

// ============================================================================
// 3. SERVICES DEMANDES DE LOCATION & CANDIDATURES
// ============================================================================

export async function fetchRentalApplications(propertyId?: string): Promise<RentalApplication[]> {
  try {
    let query = supabase.from('rental_applications').select('*').order('date_received', { ascending: false });
    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching rental applications from Supabase:', error.message);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('locatrust_rental_applications');
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {}
        }
      }
      return [];
    }
    if (typeof window !== 'undefined' && data) {
      localStorage.setItem('locatrust_rental_applications', JSON.stringify(data));
    }
    return (data || []) as RentalApplication[];
  } catch (err) {
    console.warn('Error fetching rental applications:', err);
    return [];
  }
}

export async function createRentalApplication(app: Partial<RentalApplication> & Record<string, any>) {
  const isValidUuid = (str?: string | null) =>
    Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

  let resolvedTenantId = isValidUuid(app.tenant_id) ? app.tenant_id! : '';
  let resolvedTenantEmail = (app.tenant_email || '').trim();
  let resolvedTenantName = (app.tenant_name || '').trim();
  let resolvedTenantPhone = (app.tenant_phone || '').trim();
  let resolvedTenantCni = (app.tenant_cni || '').trim();

  if (!resolvedTenantId || !resolvedTenantEmail) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (authUser) {
        if (!resolvedTenantId && isValidUuid(authUser.id)) resolvedTenantId = authUser.id;
        if (!resolvedTenantEmail && authUser.email) resolvedTenantEmail = authUser.email;
        if (!resolvedTenantName && authUser.user_metadata?.full_name) resolvedTenantName = authUser.user_metadata.full_name;
        if (!resolvedTenantPhone && authUser.user_metadata?.phone) resolvedTenantPhone = authUser.user_metadata.phone;
      }
    } catch {}
  }

  let resolvedOwnerId = isValidUuid(app.owner_id) ? app.owner_id! : '';
  let resolvedAgencyId = isValidUuid(app.agency_id) ? app.agency_id! : '';
  let resolvedRent = Number(app.rent_amount || 0);
  let resolvedCaution = Number(app.caution_amount || 0);
  let resolvedTitle = (app.property_title || '').trim();
  let resolvedAddress = (app.property_address || '').trim();

  // Contrôle serveur + enrichissement automatique depuis public.properties
  try {
    if (isValidUuid(app.property_id)) {
      const { data: propData } = await supabase
        .from('properties')
        .select('status, owner_id, agency_id, rent, caution, title, city, commune')
        .eq('id', app.property_id)
        .maybeSingle();

      if (propData) {
        if (propData.status === 'loue') {
          return { data: null, error: "Ce logement est déjà loué et n'accepte plus de candidatures.", alreadyRented: true };
        }
        if (!resolvedOwnerId && isValidUuid(propData.owner_id)) resolvedOwnerId = propData.owner_id;
        if (!resolvedAgencyId && isValidUuid(propData.agency_id)) resolvedAgencyId = propData.agency_id;
        if (resolvedRent <= 0 && Number(propData.rent) > 0) resolvedRent = Number(propData.rent);
        if (resolvedCaution <= 0 && Number(propData.caution) > 0) resolvedCaution = Number(propData.caution);
        if (!resolvedTitle && propData.title) resolvedTitle = propData.title;
        if (!resolvedAddress && (propData.commune || propData.city)) {
          resolvedAddress = `${propData.commune ? propData.commune + ', ' : ''}${propData.city || 'Abidjan'}`;
        }
      }

      const { data: activeContracts } = await supabase
        .from('contracts')
        .select('id')
        .eq('property_id', app.property_id)
        .eq('status', 'actif')
        .limit(1);

      if (activeContracts && activeContracts.length > 0) {
        return { data: null, error: "Ce logement est déjà loué et n'accepte plus de candidatures.", alreadyRented: true };
      }
    }
  } catch (propCheckErr) {
    console.warn('Vérification disponibilité logement:', propCheckErr);
  }

  if (resolvedCaution <= 0 && resolvedRent > 0) {
    resolvedCaution = resolvedRent * 2;
  }

  // Contrôle strict anti-doublon (Point 3 : Locataire A + Logement B = 1 seule demande active)
  // Exception : Si le contrat précédent a été terminé ou résilié et que le bien est redevenu disponible, l'ancien enregistrement est réinitialisé ou remplacé
  try {
    if (isValidUuid(app.property_id) && (resolvedTenantId || resolvedTenantEmail)) {
      let checkQuery = supabase
        .from('rental_applications')
        .select('*')
        .eq('property_id', app.property_id)
        .neq('status', 'refusee');

      if (resolvedTenantId) {
        checkQuery = checkQuery.eq('tenant_id', resolvedTenantId);
      } else {
        checkQuery = checkQuery.eq('tenant_email', resolvedTenantEmail);
      }

      const { data: existingApps } = await checkQuery.limit(1);
      if (existingApps && existingApps.length > 0) {
        const existingRow = existingApps[0];
        const existingDocs = existingRow.documents && typeof existingRow.documents === 'object' ? existingRow.documents : {};
        const isPastOrTerminated =
          existingRow.status === 'termine' ||
          existingRow.status === 'resilie' ||
          existingRow.status === 'annulee' ||
          existingDocs.contract_status === 'termine' ||
          existingDocs.contract_status === 'resilie' ||
          (existingRow.status === 'contrat_actif' && (propertyCheckData?.status === 'disponible' || isPropertyAvailable));

        if (!isPastOrTerminated) {
          if (!existingRow.owner_id && resolvedOwnerId) {
            await supabase
              .from('rental_applications')
              .update({
                owner_id: resolvedOwnerId,
                agency_id: resolvedAgencyId || null,
                rent_amount: resolvedRent || existingRow.rent_amount || 0,
                caution_amount: resolvedCaution || existingRow.caution_amount || 0,
                property_title: resolvedTitle || existingRow.property_title || ''
              })
              .eq('id', existingRow.id);
          }
          return { data: existingRow, error: null, alreadyExists: true };
        } else {
          // L'ancien contrat/bail pour ce bien est terminé : on purge ou recycle cette ligne pour permettre la nouvelle candidature
          try {
            await supabase.from('rental_applications').delete().eq('id', existingRow.id);
          } catch {}
        }
      }
    }
  } catch (checkErr) {
    console.warn('Vérification doublon candidature:', checkErr);
  }

  // Construction du payload avec les seules colonnes réelles de rental_applications
  const docsObject: Record<string, any> = typeof app.documents === 'object' && app.documents !== null ? { ...app.documents } : {};
  if (app.message) docsObject.message = app.message;
  if (app.comment) docsObject.comment = app.comment;
  if (app.monthly_income) docsObject.monthly_income = app.monthly_income;
  if (app.profession) docsObject.profession = app.profession;

  // Ne pas stocker une chaîne base64 géante (> 2048 caractères) dans rental_applications.tenant_avatar
  // car DemandesView charge déjà avatar_url directement depuis public.profiles.
  const rawAvatar = typeof app.tenant_avatar === 'string' ? app.tenant_avatar : '';
  const safeAvatar = rawAvatar.startsWith('data:') && rawAvatar.length > 2048 ? '' : rawAvatar;

  const payload: Record<string, any> = {
    property_id: app.property_id,
    tenant_name: resolvedTenantName || 'Candidat Locataire',
    tenant_phone: resolvedTenantPhone || '',
    tenant_email: resolvedTenantEmail || '',
    tenant_cni: resolvedTenantCni || '',
    tenant_avatar: safeAvatar,
    property_title: resolvedTitle || 'Logement',
    property_address: resolvedAddress || 'Côte d\'Ivoire',
    rent_amount: resolvedRent,
    caution_amount: resolvedCaution,
    status: app.status || 'en_attente',
    dossier_status: app.dossier_status || 'complet',
    documents: docsObject
  };

  if (resolvedTenantId) {
    payload.tenant_id = resolvedTenantId;
  }
  if (resolvedOwnerId) {
    payload.owner_id = resolvedOwnerId;
  }
  if (resolvedAgencyId) {
    payload.agency_id = resolvedAgencyId;
  }
  if (isValidUuid(app.id)) {
    payload.id = app.id;
  }

  let { data, error } = await supabase
    .from('rental_applications')
    .insert([payload])
    .select()
    .maybeSingle();

  // Fallback automatique minimal si une colonne optionnelle ou FK bloque l'insertion primaire
  if (error || !data) {
    console.warn('Repli insertion Supabase rental_applications:', error?.message);
    const fallbackPayload: Record<string, any> = {
      property_id: app.property_id,
      tenant_name: payload.tenant_name,
      tenant_phone: payload.tenant_phone,
      tenant_email: payload.tenant_email,
      property_title: payload.property_title,
      property_address: payload.property_address,
      rent_amount: payload.rent_amount,
      caution_amount: payload.caution_amount,
      status: 'en_attente',
      dossier_status: 'complet'
    };
    if (resolvedTenantId) fallbackPayload.tenant_id = resolvedTenantId;
    if (resolvedOwnerId) fallbackPayload.owner_id = resolvedOwnerId;
    if (resolvedAgencyId) fallbackPayload.agency_id = resolvedAgencyId;
    const retryRes = await supabase
      .from('rental_applications')
      .insert([fallbackPayload])
      .select()
      .maybeSingle();
    if (retryRes.data) {
      data = retryRes.data;
      error = null;
    }
  }

  if (error) {
    console.error('Erreur insertion Supabase rental_applications:', error.message);
  } else if (resolvedOwnerId || resolvedAgencyId) {
    const targetUserId = resolvedAgencyId || resolvedOwnerId;
    try {
      await supabase.from('notifications').insert([{
        id: crypto.randomUUID(),
        user_id: targetUserId,
        title: 'Nouvelle demande de location reçue',
        message: `${payload.tenant_name} a envoyé un dossier pour « ${payload.property_title} ».`,
        description: `${payload.tenant_name} a envoyé un dossier pour « ${payload.property_title} ».`,
        category: 'demande',
        type: 'demande',
        is_read: false,
        read: false,
        data: {
          applicationId: data?.id || payload.id,
          rental_request_id: data?.id || payload.id,
          propertyId: payload.property_id,
          tenantId: payload.tenant_id,
          targetTab: 'applications'
        },
        payload: {
          applicationId: data?.id || payload.id,
          rental_request_id: data?.id || payload.id,
          propertyId: payload.property_id,
          tenantId: payload.tenant_id,
          targetTab: 'applications'
        }
      }]);
    } catch (notifErr) {
      console.warn('Erreur notification Supabase:', notifErr);
    }
  }

  return { data, error, alreadyExists: false };
}

export async function updateRentalApplication(id: string, updates: Partial<RentalApplication>) {
  const { data, error } = await supabase
    .from('rental_applications')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

// ============================================================================
// 4. SERVICES CONTRATS DE BAIL & SIGNATURES (LEASES)
// ============================================================================

export async function fetchContracts(userId?: string): Promise<Contract[]> {
  try {
    let query = supabase
      .from('contracts')
      .select('*, property:properties(*), tenant:users!tenant_id(*), owner:users!owner_id(*)')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.or(`tenant_id.eq.${userId},owner_id.eq.${userId}`);
    }

    const { data, error } = await query;
    if (error || !data) {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('locatrust_contracts');
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {}
        }
      }
      return [];
    }
    return data as Contract[];
  } catch (err) {
    console.warn('Error fetching contracts from Supabase:', err);
    return [];
  }
}

export async function createContract(contract: Partial<Contract>) {
  const { data, error } = await supabase
    .from('contracts')
    .insert([contract])
    .select()
    .single();

  return { data, error };
}

export async function updateContract(id: string, updates: Partial<Contract>) {
  const { data, error } = await supabase
    .from('contracts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

// ============================================================================
// 5. SERVICES CAUTIONS & SÉQUESTRE
// ============================================================================

export async function fetchCautions(userId?: string): Promise<Deposit[]> {
  try {
    let query = supabase
      .from('cautions')
      .select('*, contract:contracts(*), tenant:users!tenant_id(*), property:properties(*)')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.or(`tenant_id.eq.${userId},owner_id.eq.${userId}`);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as Deposit[];
  } catch (err) {
    console.warn('Error fetching cautions:', err);
    return [];
  }
}

export async function updateCaution(id: string, updates: Partial<Deposit>) {
  const { data, error } = await supabase
    .from('cautions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

// ============================================================================
// 6. SERVICES PAIEMENTS DE LOYERS & QUITTANCES
// ============================================================================

export async function fetchRentPayments(contractId?: string): Promise<RentPayment[]> {
  try {
    let query = supabase
      .from('rent_payments')
      .select('*, contract:contracts(*), tenant:users!tenant_id(*)')
      .order('created_at', { ascending: false });

    if (contractId) {
      query = query.eq('contract_id', contractId);
    }

    const { data, error } = await query;
    if (error || !data) {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('locatrust_rent_payments');
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {}
        }
      }
      return [];
    }
    return data as RentPayment[];
  } catch (err) {
    console.warn('Error fetching rent payments from Supabase:', err);
    return [];
  }
}

export async function declareRentPayment(payment: Partial<RentPayment>) {
  const { data, error } = await supabase
    .from('rent_payments')
    .insert([payment])
    .select()
    .single();

  return { data, error };
}

export async function confirmRentPayment(id: string, confirmedByUserId: string) {
  const { data, error } = await supabase
    .from('rent_payments')
    .update({
      status: 'confirme',
      confirmed_by: confirmedByUserId,
      confirmed_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function fetchReceipts(contractId?: string): Promise<Receipt[]> {
  try {
    let query = supabase.from('receipts').select('*').order('created_at', { ascending: false });
    if (contractId) {
      query = query.eq('contract_id', contractId);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data as Receipt[];
  } catch (err) {
    console.warn('Error fetching receipts:', err);
    return [];
  }
}

export async function createReceipt(receipt: Partial<Receipt>) {
  const { data, error } = await supabase
    .from('receipts')
    .insert([receipt])
    .select()
    .single();

  return { data, error };
}

// ============================================================================
// 7. SERVICES STOCKAGE (STORAGE BUCKETS)
// ============================================================================

export async function uploadFileToStorage(
  bucket: 'contracts' | 'receipts' | 'property_photos' | 'id_documents',
  filePath: string,
  file: File | Blob
): Promise<{ publicUrl: string | null; error: any }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type || 'application/pdf'
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { publicUrl: null, error };
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { publicUrl: urlData.publicUrl, error: null };
  } catch (err) {
    console.error('Storage exception:', err);
    return { publicUrl: null, error: err };
  }
}
