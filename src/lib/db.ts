import { supabase } from '@/src/lib/supabase';

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
    const formatted = (data || []).map((p: any) => ({
      ...p,
      photos: Array.isArray(p.photos) ? p.photos : (p.photo ? [p.photo] : []),
      equipments: Array.isArray(p.equipments) ? p.equipments : [],
      location: p.location || {
        city: p.city || 'Abidjan',
        commune: p.commune || '',
        quartier: p.quartier || '',
        country: p.country || 'Côte d\'Ivoire'
      },
      pricing: p.pricing || {
        monthly_rent: Number(p.rent) || 0,
        deposit_months: Math.round(Number(p.caution) / (Number(p.rent) || 1)) || 2
      }
    }));
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
    const formatted = (data || []).map((p: any) => ({
      ...p,
      location: p.location || { city: p.city || 'Abidjan', commune: p.commune || '', quartier: p.quartier || '' },
      pricing: p.pricing || { monthly_rent: p.rent, deposit_months: Math.round(Number(p.caution) / (Number(p.rent) || 1)) || 2 }
    }));
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
