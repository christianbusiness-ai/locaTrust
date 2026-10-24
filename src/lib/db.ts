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
export async function getContracts(userId: string, role?: 'locataire' | 'proprietaire' | 'agence' | 'admin') {
  try {
    let query = supabase
      .from('contracts')
      .select('*, property:properties(*)')
      .order('created_at', { ascending: false });

    if (userId) {
      if (role === 'locataire') {
        query = query.eq('tenant_id', userId);
      } else if (role === 'proprietaire') {
        query = query.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
      } else if (role === 'agence') {
        query = query.or(`agency_id.eq.${userId},owner_id.eq.${userId}`);
      } else {
        query = query.or(`tenant_id.eq.${userId},owner_id.eq.${userId},agency_id.eq.${userId}`);
      }
    }

    const { data: rawContracts, error: cntError } = await query;
    if (cntError) {
      console.warn('Erreur lecture contracts:', cntError.message);
      return { data: [], error: cntError.message };
    }

    const contracts = rawContracts || [];
    const userIds = Array.from(
      new Set(contracts.flatMap((c) => [c.owner_id, c.tenant_id, c.agency_id]).filter(Boolean))
    );
    const profilesMap = new Map<string, any>();
    if (userIds.length > 0) {
      try {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, phone, email, avatar_url, account_type')
          .in('id', userIds);
        if (profs) profs.forEach((p) => profilesMap.set(p.id, p));
      } catch (profErr) {
        console.warn('Erreur profils contrats:', profErr);
      }
    }

    const enriched = contracts.map((c) => ({
      ...c,
      contractNumber: c.contract_number,
      rent: Number(c.monthly_rent || 0),
      rent_amount: Number(c.monthly_rent || 0),
      caution: Number(c.caution_amount || 0),
      caution_amount: Number(c.caution_amount || 0),
      charges: Number(c.charges_amount || 0),
      duration_months: Number(c.duration_months || 12),
      status: c.status || 'actif',
      owner_signed: Boolean(c.owner_signed || c.owner_signature),
      tenant_signed: Boolean(c.tenant_signed || c.tenant_signature),
      owner: profilesMap.get(c.owner_id) || profilesMap.get(c.agency_id) || c.owner || { full_name: 'Bailleur' },
      tenant: profilesMap.get(c.tenant_id) || c.tenant || { full_name: 'Locataire' },
      property: c.property || { title: 'Logement LocaTrust', city: 'Abidjan' }
    }));

    return { data: enriched, error: null };
  } catch (err: any) {
    return { data: [], error: err?.message };
  }
}

// =============================================================================
// REQUÊTES PAIEMENTS DE LOYERS
// =============================================================================
export async function getRentPayments(userId: string) {
  try {
    // Stratégie 1 : Avec jointure du contrat et du bien
    const { data, error } = await supabase
      .from('rent_payments')
      .select('*, contract:contracts(*, property:properties(*))')
      .or(`tenant_id.eq.${userId},owner_id.eq.${userId},agency_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return { data, error: null };
    }

    // Stratégie 2 : Requête directe sans jointures si la relation est en cache PostgREST
    const { data: simpleData, error: simpleErr } = await supabase
      .from('rent_payments')
      .select('*')
      .or(`tenant_id.eq.${userId},owner_id.eq.${userId},agency_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (simpleErr) return { data: [], error: simpleErr.message };
    return { data: simpleData || [], error: null };
  } catch (err: any) {
    return { data: [], error: err?.message };
  }
}

export function parseMonthToIsoDate(input?: string): string {
  if (!input) return new Date().toISOString().split('T')[0];
  const str = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}$/.test(str)) return `${str}-01`;

  const monthsMap: Record<string, string> = {
    janvier: '01', fevrier: '02', 'février': '02', mars: '03', avril: '04',
    mai: '05', juin: '06', juillet: '07', aout: '08', 'août': '08',
    septembre: '09', octobre: '10', novembre: '11', decembre: '12', 'décembre': '12'
  };

  const lower = str.toLowerCase();
  for (const [mName, mNum] of Object.entries(monthsMap)) {
    if (lower.includes(mName)) {
      const yearMatch = str.match(/\b(202\d|203\d)\b/);
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
      return `${year}-${mNum}-01`;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

export function normalizePaymentMethod(method?: string): string {
  if (!method) return 'wave';
  const m = String(method).toLowerCase();
  if (m.includes('orange')) return 'orange_money';
  if (m.includes('wave')) return 'wave';
  if (m.includes('mtn')) return 'mtn_momo';
  if (m.includes('moov')) return 'moov_money';
  if (m.includes('espece') || m.includes('espèces') || m.includes('cash')) return 'especes';
  if (m.includes('virement')) return 'virement';
  return 'wave';
}

export async function createRentPayment(payment: any) {
  try {
    const isoTargetMonth = parseMonthToIsoDate(payment.target_month || payment.month || payment.payment_date);
    const normalizedMethod = normalizePaymentMethod(payment.payment_method || payment.method);

    // 1. Résolution stricte de l'owner_id (uniquement s'il est valide ou rattaché au contrat spécifique)
    let validOwnerId = payment.owner_id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(payment.owner_id) ? payment.owner_id : null;
    let validContractId = payment.contract_id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(payment.contract_id) ? payment.contract_id : null;

    if (!validOwnerId && validContractId) {
      try {
        const { data: cRow } = await supabase
          .from('contracts')
          .select('owner_id, agency_id')
          .eq('id', validContractId)
          .maybeSingle();
        if (cRow?.owner_id) validOwnerId = cRow.owner_id;
        else if (cRow?.agency_id) validOwnerId = cRow.agency_id;
      } catch {}
    }

    // 3. Construction du payload strict respectant le schéma PostgreSQL de Supabase
    const cleanPayload: any = {
      tenant_id: payment.tenant_id,
      amount: Number(payment.amount) || 0,
      target_month: isoTargetMonth,
      payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
      payment_method: normalizedMethod,
      reference: payment.reference || `REF-${Date.now().toString().slice(-6)}`,
      status: 'en_attente'
    };

    if (validOwnerId) cleanPayload.owner_id = validOwnerId;
    if (validContractId) cleanPayload.contract_id = validContractId;
    if (payment.proof_url) cleanPayload.proof_url = payment.proof_url;

    // Tentative d'insertion principale
    const { data, error } = await supabase
      .from('rent_payments')
      .insert(cleanPayload)
      .select()
      .maybeSingle();

    if (!error && data) {
      return { data: { ...payment, ...data, id: data.id, status: 'en_attente' }, error: null };
    }

    // Si erreur liée à une clé étrangère manquante sur contract_id
    if (error && (error.message?.includes('foreign key') || error.code === '23503')) {
      const fallbackPayload = { ...cleanPayload };
      delete fallbackPayload.contract_id;
      const retry = await supabase.from('rent_payments').insert(fallbackPayload).select().maybeSingle();
      if (!retry.error && retry.data) {
        return { data: { ...payment, ...retry.data, id: retry.data.id, status: 'en_attente' }, error: null };
      }
    }

    return { data: null, error: error?.message || 'Erreur insertion' };
  } catch (err: any) {
    return { data: null, error: err?.message };
  }
}

// =============================================================================
// REQUÊTES TICKETS DE MAINTENANCE (ART. 428)
// =============================================================================
export async function getMaintenanceTickets(userId: string) {
  try {
    let query = supabase
      .from('maintenance_tickets')
      .select('*, property:properties(*)')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.or(`tenant_id.eq.${userId},owner_id.eq.${userId}`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Erreur lecture maintenance_tickets:', error.message);
      return { data: [], error: error.message };
    }

    const rawTickets = data || [];
    const userIds = Array.from(
      new Set(rawTickets.flatMap((t) => [t.owner_id, t.tenant_id]).filter(Boolean))
    );
    const profilesMap = new Map<string, any>();
    if (userIds.length > 0) {
      try {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, phone, avatar_url, account_type')
          .in('id', userIds);
        if (profs) profs.forEach((p) => profilesMap.set(p.id, p));
      } catch (profErr) {
        console.warn('Erreur profils maintenance:', profErr);
      }
    }

    const formatted = rawTickets.map((t: any) => {
      let parsedNotes: any[] = [];
      let parsedCategory = t.category || 'Général';
      let parsedCost = Number(t.final_cost || t.estimated_cost || 0);
      let parsedSchedule = t.scheduled_date || '';
      let cleanDesc = t.description || '';

      if (typeof cleanDesc === 'string' && cleanDesc.trim().startsWith('{')) {
        try {
          const meta = JSON.parse(cleanDesc.trim());
          if (meta.category) parsedCategory = meta.category;
          if (meta.notes && Array.isArray(meta.notes)) parsedNotes = meta.notes;
          if (meta.cost) parsedCost = Number(meta.cost);
          if (meta.scheduledDate) parsedSchedule = meta.scheduledDate;
          if (meta.description) cleanDesc = meta.description;
        } catch {}
      }

      const tenantProf = profilesMap.get(t.tenant_id);
      const ownerProf = profilesMap.get(t.owner_id);

      return {
        ...t,
        ticketNumber: `TCK-2026-${(t.id || '999').slice(0, 4).toUpperCase()}`,
        tenantName: tenantProf?.full_name || t.tenant_name || 'Locataire',
        tenantPhone: tenantProf?.phone || t.tenant_phone || '+225 00 00 00 00',
        propertyTitle: t.property?.title || t.property_title || 'Logement LocaTrust',
        propertyAddress: t.property?.address || t.property_address || 'Abidjan',
        category: parsedCategory,
        priority: t.priority || 'normale',
        status: t.status === 'ouvert' ? 'Nouveau' : t.status === 'resolu' ? 'Résolu' : (t.status === 'en_cours' ? 'En cours' : t.status),
        createdAt: new Date(t.created_at || Date.now()).toLocaleDateString('fr-FR'),
        description: cleanDesc,
        cost: parsedCost,
        scheduledDate: parsedSchedule,
        notes: parsedNotes,
        photos: Array.isArray(t.photos) ? t.photos : (t.media_url ? [t.media_url] : [])
      };
    });

    return { data: formatted, error: null };
  } catch (err: any) {
    return { data: [], error: err?.message };
  }
}

export async function createMaintenanceTicket(ticket: any) {
  try {
    const richDescription = JSON.stringify({
      description: ticket.description || '',
      category: ticket.category || 'Général',
      cost: Number(ticket.cost || 0),
      scheduledDate: ticket.scheduledDate || ticket.scheduled_date || '',
      notes: Array.isArray(ticket.notes) ? ticket.notes : []
    });

    const payload: any = {
      property_id: ticket.property_id || ticket.propertyId,
      owner_id: ticket.owner_id || ticket.ownerId,
      tenant_id: ticket.tenant_id || ticket.tenantId,
      title: ticket.title || `Incident ${ticket.category || 'Général'}`,
      description: richDescription,
      priority: (ticket.priority || 'normale').toLowerCase(),
      status: 'ouvert',
      photos: Array.isArray(ticket.photos) ? ticket.photos : (ticket.mediaUrl ? [ticket.mediaUrl] : [])
    };

    if (ticket.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket.id)) {
      payload.id = ticket.id;
    }

    const { data, error } = await supabase
      .from('maintenance_tickets')
      .insert(payload)
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
