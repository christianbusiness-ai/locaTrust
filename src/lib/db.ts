import { supabase } from '@/src/lib/supabase';

async function enrichPropertiesWithProfiles(properties: any[]) {
  if (!properties || properties.length === 0) return [];
  const ownerIds = Array.from(
    new Set(properties.map((p) => p.owner_id || p.agency_id).filter(Boolean))
  );

  const profilesMap = new Map<string, any>();
  if (ownerIds.length > 0) {
    try {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, phone, account_type, avatar_url, city, commune')
        .in('id', ownerIds);
      if (profs) {
        profs.forEach((pr) => profilesMap.set(pr.id, pr));
      }
    } catch (e) {
      console.warn('Erreur chargement profils propriétaires:', e);
    }
  }

  return properties.map((p: any) => {
    const ownerProfile = profilesMap.get(p.owner_id) || profilesMap.get(p.agency_id) || p.owner;
    const isAgency = p.is_agency || (ownerProfile?.account_type === 'agence');
    const ownerName = isAgency
      ? (p.agency_name || ownerProfile?.full_name || p.owner_name)
      : (ownerProfile?.full_name || p.owner_name);
    const ownerAvatar = ownerProfile?.avatar_url || p.owner_avatar || '';

    return {
      ...p,
      owner: ownerProfile ? {
        id: ownerProfile.id,
        full_name: ownerProfile.full_name,
        phone: ownerProfile.phone,
        account_type: ownerProfile.account_type,
        avatar_url: ownerProfile.avatar_url
      } : p.owner,
      owner_name: ownerName || p.owner_name,
      agency_name: isAgency ? (p.agency_name || ownerProfile?.full_name || p.owner_name) : undefined,
      is_agency: isAgency,
      owner_avatar: ownerAvatar,
      owner_phone: ownerProfile?.phone || p.owner_phone,
      photos: Array.isArray(p.photos) ? p.photos : (p.images && Array.isArray(p.images) ? p.images : (p.photo ? [p.photo] : [])),
      location: p.location || {
        city: p.city || 'Abidjan',
        commune: p.commune || '',
        quartier: p.quartier || '',
        country: p.country || "Côte d'Ivoire"
      },
      pricing: p.pricing || {
        monthly_rent: Number(p.rent || p.rent_amount) || 0,
        deposit_months: Math.round(Number(p.caution || p.deposit_amount) / (Number(p.rent || p.rent_amount) || 1)) || 2
      }
    };
  });
}

// =============================================================================
// REQUÊTES PROPRIÉTÉS (BIENS IMMOBILIERS)
// =============================================================================
export async function getProperties(ownerId?: string) {
  try {
    let query = supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (ownerId) {
      query = query.or(`owner_id.eq.${ownerId},agency_id.eq.${ownerId}`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Erreur lecture properties:', error.message);
      return { data: [], error: error.message };
    }
    const formatted = await enrichPropertiesWithProfiles(data || []);
    return { data: formatted, error: null };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Erreur réseau.' };
  }
}

export async function getAvailableProperties() {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('status', 'disponible')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Erreur lecture logements disponibles:', error.message);
      return { data: [], error: error.message };
    }
    const formatted = await enrichPropertiesWithProfiles(data || []);
    return { data: formatted, error: null };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Erreur réseau.' };
  }
}

export async function createProperty(property: any) {
  try {
    const { data, error } = await supabase
      .from('properties')
      .insert(property)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message };
  }
}

// =============================================================================
// REQUÊTES CONTRATS DE BAIL
// =============================================================================
export async function getContracts(userId: string, role?: 'locataire' | 'proprietaire') {
  try {
    let query = supabase
      .from('contracts')
      .select('*, property:property_id(*), owner:owner_id(*), tenant:tenant_id(*)')
      .order('created_at', { ascending: false });

    if (role === 'locataire') {
      query = query.eq('tenant_id', userId);
    } else if (role === 'proprietaire') {
      query = query.eq('owner_id', userId);
    } else {
      query = query.or(`tenant_id.eq.${userId},owner_id.eq.${userId}`);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err?.message };
  }
}

// =============================================================================
// REQUÊTES PAIEMENTS DE LOYERS
// =============================================================================
export async function getRentPayments(userId: string) {
  try {
    const { data, error } = await supabase
      .from('rent_payments')
      .select('*, contract:contract_id(*)')
      .or(`tenant_id.eq.${userId},owner_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err?.message };
  }
}

export async function createRentPayment(payment: any) {
  try {
    const { data, error } = await supabase
      .from('rent_payments')
      .insert(payment)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message };
  }
}

// =============================================================================
// REQUÊTES TICKETS DE MAINTENANCE (ART. 428)
// =============================================================================
export async function getMaintenanceTickets(userId: string) {
  try {
    const { data, error } = await supabase
      .from('maintenance_tickets')
      .select('*, property:property_id(*)')
      .or(`tenant_id.eq.${userId},owner_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err?.message };
  }
}

export async function createMaintenanceTicket(ticket: any) {
  try {
    const { data, error } = await supabase
      .from('maintenance_tickets')
      .insert(ticket)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message };
  }
}

// =============================================================================
// REQUÊTES CANDIDATURES LOCATIVES
// =============================================================================
export async function getRentalRequests(userId: string, isOwner = false) {
  try {
    let query = supabase
      .from('rental_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isOwner && userId) {
      query = query.eq('tenant_id', userId);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err?.message };
  }
}
