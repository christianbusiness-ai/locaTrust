'use client';

import { supabase } from '@/src/lib/supabase';

export interface AgencyMandate {
  id: string;
  agency_id: string;
  full_name: string;
  email: string;
  phone: string;
  properties_count: number;
  active_tenants: number;
  total_monthly_rent: number;
  mandate_type: 'exclusif' | 'simple';
  joined_date: string;
}

/**
 * Récupère la liste des mandants appartenant STRICTEMENT à l'agence spécifiée.
 * Isole totalement chaque agence de sorte qu'aucune agence ne puisse voir les mandants d'une autre.
 */
export function getAgencyMandates(agencyId?: string | null): AgencyMandate[] {
  if (!agencyId) return [];

  if (typeof window === 'undefined') return [];

  try {
    // 1. Priorité au store isolé par agence
    const agencySpecificKey = `locatrust_agency_mandates_${agencyId}`;
    const specificStored = localStorage.getItem(agencySpecificKey);
    let list: AgencyMandate[] = [];

    if (specificStored) {
      try {
        const parsed = JSON.parse(specificStored);
        if (Array.isArray(parsed)) {
          list = parsed.filter((m: any) => m && (m.agency_id === agencyId || !m.agency_id));
        }
      } catch {}
    }

    // 2. Si le store spécifique est vide, vérifier dans le store global en filtrant strictement par agency_id
    if (list.length === 0) {
      const globalStored = localStorage.getItem('locatrust_agency_mandates');
      if (globalStored) {
        try {
          const parsed = JSON.parse(globalStored);
          if (Array.isArray(parsed)) {
            list = parsed.filter((m: any) => m && m.agency_id === agencyId);
          }
        } catch {}
      }
    }

    // 3. Nettoyer les faux mandants résiduels de démo
    const cleanList = list
      .filter((m) => {
        if (!m || !m.full_name) return false;
        const idLower = String(m.id).toLowerCase();
        const nameLower = String(m.full_name).toLowerCase();
        if (
          idLower.startsWith('owner_10') ||
          idLower.startsWith('mnd_') ||
          idLower === 'owner_1' ||
          nameLower.includes('touré aïcha') ||
          nameLower.includes('jean-baptiste') ||
          nameLower === 'bailleur démo'
        ) {
          return false;
        }
        return true;
      })
      .map((m) => ({
        ...m,
        agency_id: agencyId
      }));

    return cleanList;
  } catch (err) {
    console.warn('Erreur lecture mandants agence:', err);
    return [];
  }
}

/**
 * Enregistre ou met à jour un mandant pour une agence spécifique.
 */
export function saveAgencyMandate(
  agencyId: string,
  mandateData: Omit<AgencyMandate, 'id' | 'agency_id'> & { id?: string }
): AgencyMandate {
  if (!agencyId) {
    throw new Error("Impossible d'ajouter un mandant : identifiant d'agence manquant.");
  }

  const existingList = getAgencyMandates(agencyId);
  const mandateId = mandateData.id || `mnd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const newMandate: AgencyMandate = {
    id: mandateId,
    agency_id: agencyId,
    full_name: mandateData.full_name.trim(),
    email: mandateData.email?.trim() || '',
    phone: mandateData.phone?.trim() || '',
    properties_count: Number(mandateData.properties_count || 0),
    active_tenants: Number(mandateData.active_tenants || 0),
    total_monthly_rent: Number(mandateData.total_monthly_rent || 0),
    mandate_type: mandateData.mandate_type || 'exclusif',
    joined_date: mandateData.joined_date || new Date().toISOString().split('T')[0]
  };

  // Remplacement ou ajout en tête
  const filtered = existingList.filter(
    (m) => m.id !== mandateId && m.full_name.toLowerCase() !== newMandate.full_name.toLowerCase()
  );
  const updatedList = [newMandate, ...filtered];

  if (typeof window !== 'undefined') {
    // Stockage isolé par agence
    localStorage.setItem(`locatrust_agency_mandates_${agencyId}`, JSON.stringify(updatedList));

    // Mise à jour sécurisée du store global avec préservation des autres agences
    try {
      const globalRaw = localStorage.getItem('locatrust_agency_mandates');
      const globalList: AgencyMandate[] = globalRaw ? JSON.parse(globalRaw) : [];
      const others = Array.isArray(globalList) ? globalList.filter((m: any) => m && m.agency_id && m.agency_id !== agencyId) : [];
      localStorage.setItem('locatrust_agency_mandates', JSON.stringify([...updatedList, ...others]));
    } catch {}

    window.dispatchEvent(
      new CustomEvent('locatrust:agency_mandates-updated', {
        detail: { agencyId, mandates: updatedList }
      })
    );
  }

  return newMandate;
}

/**
 * Supprime un mandant pour l'agence spécifiée.
 */
export function deleteAgencyMandate(agencyId: string, mandateId: string): void {
  if (!agencyId || !mandateId) return;

  const currentList = getAgencyMandates(agencyId);
  const updatedList = currentList.filter((m) => m.id !== mandateId);

  if (typeof window !== 'undefined') {
    localStorage.setItem(`locatrust_agency_mandates_${agencyId}`, JSON.stringify(updatedList));

    try {
      const globalRaw = localStorage.getItem('locatrust_agency_mandates');
      const globalList: AgencyMandate[] = globalRaw ? JSON.parse(globalRaw) : [];
      const others = Array.isArray(globalList) ? globalList.filter((m: any) => m && m.agency_id && m.agency_id !== agencyId) : [];
      localStorage.setItem('locatrust_agency_mandates', JSON.stringify([...updatedList, ...others]));
    } catch {}

    window.dispatchEvent(
      new CustomEvent('locatrust:agency_mandates-updated', {
        detail: { agencyId, mandates: updatedList }
      })
    );
  }
}

/**
 * Synchronise les mandants de l'agence depuis ses biens enregistrés dans Supabase.
 * Extrait uniquement les mandants déclarés sur les biens appartenant à cette agence.
 */
export async function syncAgencyMandatesFromDb(agencyId: string): Promise<AgencyMandate[]> {
  if (!agencyId) return [];

  try {
    const { data: agencyProperties, error } = await supabase
      .from('properties')
      .select('id, title, rent, status, mandant_id, mandant_name, owner_phone')
      .eq('agency_id', agencyId);

    if (error || !agencyProperties) return getAgencyMandates(agencyId);

    const localList = getAgencyMandates(agencyId);
    const mandantsMap = new Map<string, AgencyMandate>();

    // 1. Initialiser avec les mandants locaux existants de cette agence
    localList.forEach((m) => {
      mandantsMap.set(m.id, { ...m });
      if (m.full_name) {
        mandantsMap.set(m.full_name.toLowerCase(), { ...m });
      }
    });

    // 2. Découvrir et recalculer les métriques à partir des biens Supabase de cette agence
    agencyProperties.forEach((p: any) => {
      if (!p.mandant_name && !p.mandant_id) return;

      const mId = p.mandant_id || `mnd_${p.mandant_name.toLowerCase().replace(/\s+/g, '_')}`;
      const mName = p.mandant_name || 'Bailleur Mandant';
      const existing = mandantsMap.get(mId) || mandantsMap.get(mName.toLowerCase());

      if (existing) {
        mandantsMap.set(existing.id, existing);
      } else {
        const newM: AgencyMandate = {
          id: mId,
          agency_id: agencyId,
          full_name: mName,
          email: '',
          phone: p.owner_phone || '',
          properties_count: 0,
          active_tenants: 0,
          total_monthly_rent: 0,
          mandate_type: 'exclusif',
          joined_date: new Date().toISOString().split('T')[0]
        };
        mandantsMap.set(mId, newM);
      }
    });

    // Dédupliquer par ID
    const uniqueMandates = Array.from(
      new Map(Array.from(mandantsMap.values()).map((m) => [m.id, m])).values()
    ).filter((m) => m.agency_id === agencyId);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`locatrust_agency_mandates_${agencyId}`, JSON.stringify(uniqueMandates));
    }

    return uniqueMandates;
  } catch (err) {
    console.warn('Erreur synchronisation mandants agence Supabase:', err);
    return getAgencyMandates(agencyId);
  }
}
