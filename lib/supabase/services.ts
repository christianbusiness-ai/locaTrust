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
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password || 'LocaTrust2026!',
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
      error: error || signupCheck.error || new Error('Code de validation invalide ou expiré.')
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: password || 'LocaTrust2026!',
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

    const payload = {
      owner_id: ownerId,
      type: property.type || 'appartement',
      title: property.title || 'Logement',
      description: property.description || '',
      country: property.country || "Côte d'Ivoire",
      city: property.city || 'Abidjan',
      commune: property.commune || 'Cocody',
      quartier: property.quartier || 'Centre',
      surface: Number(property.surface) || 50,
      rent: Number(property.rent || property.pricing?.monthly_rent) || 150000,
      caution: Number(property.caution || (property.pricing?.deposit_months ? property.pricing.deposit_months * 150000 : 300000)) || 300000,
      charges: Number(property.charges) || 0,
      rooms: Number(property.rooms) || 2,
      bedrooms: Number(property.bedrooms) || 1,
      bathrooms: Number(property.bathrooms) || 1,
      status: property.status || 'disponible',
      photos: property.photos || [],
      videos: property.videos || (property.video_url ? [property.video_url] : [])
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
    if (error || !data || data.length === 0) {
      // Fallback local storage
      const cached = localStorage.getItem('locatrust_rental_applications');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }
      return [];
    }
    return data as RentalApplication[];
  } catch (err) {
    console.warn('Error fetching rental applications:', err);
    return [];
  }
}

export async function createRentalApplication(app: Partial<RentalApplication>) {
  const { data, error } = await supabase
    .from('rental_applications')
    .insert([app])
    .select()
    .single();

  return { data, error };
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
