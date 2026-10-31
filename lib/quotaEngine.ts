/**
 * lib/quotaEngine.ts
 * Moteur centralisé et source unique de vérité du calcul des quotas et de la facturation SaaS LocaTrust.
 *
 * RÈGLE FONDAMENTALE :
 * Nombre de biens facturables = nombre de biens distincts possédant actuellement un contrat de location ACTIF.
 * - Un bien vacant (sans contrat actif) ne génère aucun quota (0 FCFA).
 * - Un bien avec plusieurs contrats historiques et 1 contrat actif compte pour 1 seul bien facturable.
 * - Un contrat expiré, résilié, annulé, refusé ou en attente de signature ne génère aucun quota.
 */

import { supabase } from '@/src/lib/supabase';

export type QuotaTierCode = '0_bien' | '1_bien' | '2_10_biens' | '11_20_biens' | '20plus_biens';

export interface QuotaPriceInfo {
  tier: QuotaTierCode;
  price: number;
  amount: number;
  tierName: string;
  label: string;
  rangeLabel: string;
  hasActiveQuota: boolean;
}

export interface QuotaComputationResult {
  ownerOrAgencyId: string;
  role: 'proprietaire' | 'agence';
  managedPropertiesCount: number;
  activeContractsCount: number;
  billablePropertiesCount: number;
  vacantPropertiesCount: number;
  billablePropertyIds: string[];
  activeContractIds: string[];
  quotaPrice: number;
  tier: QuotaTierCode;
  tierName: string;
  label: string;
  rangeLabel: string;
  hasActiveQuota: boolean;
  calculatedAt: string;
}

const INACTIVE_CONTRACT_STATUSES = new Set([
  'brouillon',
  'draft',
  'en_attente',
  'en_attente_signature',
  'en_attente_locataire',
  'en_attente_proprietaire',
  'en_attente_validation',
  'refuse',
  'refusee',
  'rejete',
  'annule',
  'annulee',
  'cancelled',
  'canceled',
  'resilie',
  'resiliee',
  'terminated',
  'termine',
  'terminee',
  'expire',
  'expired',
  'cloture',
  'archive',
  'inactif',
  'suspendu'
]);

const ACTIVE_CONTRACT_STATUSES = new Set([
  'actif',
  'contrat_actif',
  'active',
  'bail_actif',
  'en_cours'
]);

/**
 * Calcule le tarif mensuel officiel LocaTrust à partir du nombre de biens facturables
 * (c'est-à-dire le nombre de biens distincts possédant actuellement un contrat actif).
 *
 * Tarifs officiels :
 * - 0 bien actif         -> 0 FCFA / mois
 * - 1 bien actif         -> 500 FCFA / mois
 * - 2 à 10 biens actifs  -> 2 000 FCFA / mois
 * - 11 à 20 biens actifs -> 5 000 FCFA / mois
 * - > 20 biens actifs    -> 10 000 FCFA / mois
 */
export function getQuotaPrice(billablePropertyCount: number): QuotaPriceInfo {
  const count = Math.max(0, Math.floor(Number(billablePropertyCount) || 0));

  if (count === 0) {
    return {
      tier: '0_bien',
      price: 0,
      amount: 0,
      tierName: 'Aucun quota actif',
      label: 'Aucun bien actif (0 FCFA)',
      rangeLabel: '0 bien actif',
      hasActiveQuota: false
    };
  }

  if (count === 1) {
    return {
      tier: '1_bien',
      price: 500,
      amount: 500,
      tierName: 'Formule 1 Bien Actif',
      label: 'Starter (1 bien actif)',
      rangeLabel: '1 bien actif',
      hasActiveQuota: true
    };
  }

  if (count <= 10) {
    return {
      tier: '2_10_biens',
      price: 2000,
      amount: 2000,
      tierName: 'Formule 2 à 10 Biens Actifs',
      label: 'Standard (2 à 10 biens actifs)',
      rangeLabel: '2 à 10 biens actifs',
      hasActiveQuota: true
    };
  }

  if (count <= 20) {
    return {
      tier: '11_20_biens',
      price: 5000,
      amount: 5000,
      tierName: 'Formule 11 à 20 Biens Actifs',
      label: 'Pro (11 à 20 biens actifs)',
      rangeLabel: '11 à 20 biens actifs',
      hasActiveQuota: true
    };
  }

  return {
    tier: '20plus_biens',
    price: 10000,
    amount: 10000,
    tierName: 'Formule Plus de 20 Biens Actifs',
    label: 'Entreprise (+20 biens actifs)',
    rangeLabel: 'Plus de 20 biens actifs',
    hasActiveQuota: true
  };
}

/**
 * Parse une date de contrat (ISO YYYY-MM-DD ou DD/MM/YYYY) en timestamp de fin de journée locale.
 */
function parseContractDateEndOfDay(dateInput: any): number | null {
  if (!dateInput || typeof dateInput !== 'string') return null;
  const trimmed = dateInput.trim();
  if (!trimmed) return null;

  // Format DD/MM/YYYY
  const frMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (frMatch) {
    const day = Number(frMatch[1]);
    const month = Number(frMatch[2]) - 1;
    const year = Number(frMatch[3]);
    const d = new Date(year, month, day, 23, 59, 59, 999);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  // Format YYYY-MM-DD (sans heure)
  const isoDateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const year = Number(isoDateOnly[1]);
    const month = Number(isoDateOnly[2]) - 1;
    const day = Number(isoDateOnly[3]);
    const d = new Date(year, month, day, 23, 59, 59, 999);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

/**
 * Extrait l'identifiant unique du bien lié à un contrat.
 */
export function extractContractPropertyId(contract: any): string | null {
  if (!contract || typeof contract !== 'object') return null;
  const rawId =
    contract.property_id ||
    contract.propertyId ||
    contract.property?.id ||
    contract.property_uuid ||
    null;

  if (rawId && typeof rawId === 'string' && rawId.trim().length > 0) {
    return rawId.trim();
  }
  return null;
}

/**
 * Vérifie strictement si un contrat de location est actuellement ACTIF.
 *
 * Conditions cumulatives :
 * 1. Le contrat possède un bien associé (`property_id`).
 * 2. Son statut est actif (`actif`, `contrat_actif`, `active`) et n'est ni brouillon, ni en attente, ni refusé, ni annulé, ni résilié, ni expiré.
 * 3. S'il comporte des indicateurs explicites de signature (`tenant_signed` / `owner_signed`), aucun des deux ne doit être `false`.
 * 4. Il n'est pas résilié ou annulé (`terminated_at`, `cancelled_at`, `resiliated_at`, `deleted_at`).
 * 5. Sa date de fin (`end_date` / `endDate`) n'est pas dépassée par rapport à la date de référence.
 */
export function isContractCurrentlyActive(contract: any, referenceDate: Date = new Date()): boolean {
  if (!contract || typeof contract !== 'object') return false;

  // Exclusion immédiate si supprimé, résilié ou annulé
  if (contract.deleted_at || contract.terminated_at || contract.cancelled_at || contract.resiliated_at) {
    return false;
  }

  // Doit être rattaché à un bien identifié
  const propertyId = extractContractPropertyId(contract);
  if (!propertyId) {
    return false;
  }

  const rawStatus = String(contract.status || contract.contract_status || '').trim().toLowerCase();
  if (!rawStatus) return false;

  if (INACTIVE_CONTRACT_STATUSES.has(rawStatus)) {
    return false;
  }

  // Si l'une des parties a explicitement non-signé (ex: contrat envoyé mais non signé par le locataire)
  if (contract.tenant_signed === false || contract.owner_signed === false) {
    return false;
  }

  // Statut 'signe' toléré uniquement si finalisé par les deux parties
  const isStatusActive =
    ACTIVE_CONTRACT_STATUSES.has(rawStatus) ||
    (rawStatus === 'signe' && Boolean(contract.tenant_signed || contract.tenant_signature_url) && Boolean(contract.owner_signed || contract.owner_signature_url));

  if (!isStatusActive) {
    return false;
  }

  // Vérification de la date de fin / expiration
  const endDateVal = contract.end_date || contract.endDate || contract.expiration_date || contract.expires_at;
  if (endDateVal) {
    const endTimestamp = parseContractDateEndOfDay(endDateVal);
    if (endTimestamp !== null && endTimestamp < referenceDate.getTime()) {
      return false;
    }
  }

  return true;
}

export interface CalculateQuotaDatasetInput {
  properties: any[];
  contracts: any[];
  applications?: any[];
  ownerId?: string;
  agencyId?: string;
  referenceDate?: Date;
}

/**
 * Calcule de manière pure et déterministe l'ensemble des métriques de quota
 * pour un propriétaire ou une agence immobilière.
 */
export function calculateQuotaFromDataset(input: CalculateQuotaDatasetInput): QuotaComputationResult {
  const {
    properties = [],
    contracts = [],
    applications = [],
    ownerId,
    agencyId,
    referenceDate = new Date()
  } = input;

  const targetId = (agencyId || ownerId || '').trim();
  const role: 'proprietaire' | 'agence' = agencyId ? 'agence' : 'proprietaire';

  const belongsToTarget = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    if (!targetId) return true;
    return (
      item.owner_id === targetId ||
      item.ownerId === targetId ||
      item.agency_id === targetId ||
      item.agencyId === targetId ||
      item.mandant_id === targetId ||
      item.owner?.id === targetId ||
      item.agency?.id === targetId
    );
  };

  // 1. Filtrer les biens gérés (hors corbeille / supprimés)
  const validPropertiesMap = new Map<string, any>();
  for (const prop of properties) {
    if (!prop || typeof prop !== 'object') continue;
    if (prop.deleted_at || prop.status === 'corbeille' || prop.status === 'supprime') continue;
    if (!belongsToTarget(prop)) continue;
    const pid = String(prop.id || '').trim();
    if (pid) {
      validPropertiesMap.set(pid, prop);
    }
  }

  // 2. Assembler les contrats (table contracts + candidatures finalisées avec statut contrat_actif)
  const unifiedContractsMap = new Map<string, any>();

  for (const c of contracts) {
    if (!c || typeof c !== 'object') continue;
    const propId = extractContractPropertyId(c);
    const isMyContract = belongsToTarget(c) || (propId !== null && validPropertiesMap.has(propId));
    if (!isMyContract) continue;

    const cid = String(c.id || c.contract_number || c.contractNumber || `${propId}_${c.tenant_id || ''}`).trim();
    if (!cid) continue;
    unifiedContractsMap.set(cid, c);
  }

  for (const app of applications) {
    if (!app || typeof app !== 'object') continue;
    const appStatus = String(app.status || '').trim().toLowerCase();
    if (appStatus !== 'contrat_actif') continue;

    const propId = extractContractPropertyId(app);
    const isMyApp = belongsToTarget(app) || (propId !== null && validPropertiesMap.has(propId));
    if (!isMyApp || !propId) continue;

    const contractNumber = String(app.contract_number || app.contractNumber || '').trim();
    const alreadyExists = Array.from(unifiedContractsMap.values()).some(
      (existing) =>
        (contractNumber && (existing.contract_number === contractNumber || existing.contractNumber === contractNumber)) ||
        existing.id === app.id ||
        existing.application_id === app.id
    );

    if (!alreadyExists) {
      const syntheticId = contractNumber || String(app.id || `app_active_${propId}`);
      unifiedContractsMap.set(syntheticId, {
        id: syntheticId,
        contract_number: contractNumber || syntheticId,
        property_id: propId,
        tenant_id: app.tenant_id || app.tenantId,
        owner_id: app.owner_id || ownerId,
        agency_id: app.agency_id || agencyId,
        status: 'contrat_actif',
        end_date: app.end_date || app.endDate || null,
        owner_signed: true,
        tenant_signed: true
      });
    }
  }

  // 3. Filtrer uniquement les contrats actuellement ACTIFS et dédupliquer par property_id
  const activeContractIds: string[] = [];
  const billablePropertyIdSet = new Set<string>();

  for (const [cid, contract] of unifiedContractsMap.entries()) {
    if (isContractCurrentlyActive(contract, referenceDate)) {
      const propId = extractContractPropertyId(contract);
      if (propId) {
        activeContractIds.push(cid);
        billablePropertyIdSet.add(propId);
      }
    }
  }

  // Si un contrat actif référence un bien appartenant au bailleur/agence qui n'était pas encore dans validPropertiesMap,
  // le nombre total de biens gérés est au moins égal au nombre de biens distincts (incluant ceux avec contrat actif).
  const allManagedPropertyIds = new Set<string>([
    ...Array.from(validPropertiesMap.keys()),
    ...Array.from(billablePropertyIdSet)
  ]);

  const managedPropertiesCount = allManagedPropertyIds.size;
  const activeContractsCount = activeContractIds.length;
  const billablePropertiesCount = billablePropertyIdSet.size;
  const vacantPropertiesCount = Math.max(0, managedPropertiesCount - billablePropertiesCount);

  const priceInfo = getQuotaPrice(billablePropertiesCount);

  return {
    ownerOrAgencyId: targetId,
    role,
    managedPropertiesCount,
    activeContractsCount,
    billablePropertiesCount,
    vacantPropertiesCount,
    billablePropertyIds: Array.from(billablePropertyIdSet),
    activeContractIds,
    quotaPrice: priceInfo.price,
    tier: priceInfo.tier,
    tierName: priceInfo.tierName,
    label: priceInfo.label,
    rangeLabel: priceInfo.rangeLabel,
    hasActiveQuota: priceInfo.hasActiveQuota,
    calculatedAt: referenceDate.toISOString()
  };
}

/**
 * Nettoie l'ancien marqueur localStorage obsolète qui verrouillait le palier au pic de biens enregistrés.
 */
function purgeLegacyPeakWatermark(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('locatrust_peak_registered_properties');
  } catch {}
}

/**
 * Charge les données réelles d'un propriétaire ou d'une agence depuis :
 * 1. Le serveur `/api/sync`
 * 2. Supabase PostgreSQL (`properties`, `contracts`, `rental_applications`)
 * 3. Le stockage local synchronisé (`locatrust_properties`, `locatrust_contracts`, `locatrust_rental_applications`)
 * puis calcule le quota officiel basé sur les biens distincts ayant un contrat actif.
 */
async function computeLiveQuotaForEntity(
  entityId: string,
  role: 'proprietaire' | 'agence'
): Promise<QuotaComputationResult> {
  purgeLegacyPeakWatermark();

  const cleanId = (entityId || '').trim();
  if (!cleanId) {
    return calculateQuotaFromDataset({
      properties: [],
      contracts: [],
      applications: [],
      ownerId: role === 'proprietaire' ? '' : undefined,
      agencyId: role === 'agence' ? '' : undefined
    });
  }

  const propertiesMap = new Map<string, any>();
  const contractsMap = new Map<string, any>();
  const applicationsMap = new Map<string, any>();

  const isMine = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    return (
      item.owner_id === cleanId ||
      item.ownerId === cleanId ||
      item.agency_id === cleanId ||
      item.agencyId === cleanId ||
      item.mandant_id === cleanId ||
      item.owner?.id === cleanId ||
      item.agency?.id === cleanId
    );
  };

  // 1. Source Backend API (/api/sync)
  try {
    const syncRes = await fetch(
      `/api/sync?userId=${encodeURIComponent(cleanId)}&role=${encodeURIComponent(role)}`
    );
    if (syncRes.ok) {
      const syncJson = await syncRes.json();
      const data = syncJson?.data;
      if (data) {
        if (Array.isArray(data.properties)) {
          data.properties.filter(isMine).forEach((p: any) => {
            if (p?.id) propertiesMap.set(String(p.id), p);
          });
        }
        if (Array.isArray(data.contracts)) {
          data.contracts.filter(isMine).forEach((c: any) => {
            const key = String(c?.id || c?.contract_number || '');
            if (key) contractsMap.set(key, c);
          });
        }
        if (Array.isArray(data.applications)) {
          data.applications.filter(isMine).forEach((a: any) => {
            if (a?.id) applicationsMap.set(String(a.id), a);
          });
        }
      }
    }
  } catch {}

  // 2. Source Base de Données Supabase PostgreSQL
  try {
    const [propsQuery, contractsQuery, appsQuery] = await Promise.all([
      supabase
        .from('properties')
        .select('*')
        .or(`owner_id.eq.${cleanId},agency_id.eq.${cleanId}`)
        .is('deleted_at', null),
      supabase
        .from('contracts')
        .select('*')
        .or(`owner_id.eq.${cleanId},agency_id.eq.${cleanId}`),
      supabase
        .from('rental_applications')
        .select('*')
        .or(`owner_id.eq.${cleanId},agency_id.eq.${cleanId}`)
    ]);

    if (Array.isArray(propsQuery.data)) {
      propsQuery.data.forEach((p: any) => {
        if (p?.id) propertiesMap.set(String(p.id), p);
      });
    }

    if (Array.isArray(contractsQuery.data)) {
      contractsQuery.data.forEach((c: any) => {
        const key = String(c?.id || c?.contract_number || '');
        if (key) contractsMap.set(key, { ...(contractsMap.get(key) || {}), ...c });
      });
    }

    if (Array.isArray(appsQuery.data)) {
      appsQuery.data.forEach((a: any) => {
        if (a?.id) applicationsMap.set(String(a.id), { ...(applicationsMap.get(String(a.id)) || {}), ...a });
      });
    }
  } catch {}

  // 3. Synchronisation avec les états locaux signés en session courante
  if (typeof window !== 'undefined') {
    try {
      const rawProps = localStorage.getItem('locatrust_properties');
      if (rawProps) {
        const parsed = JSON.parse(rawProps);
        if (Array.isArray(parsed)) {
          parsed.filter(isMine).forEach((p: any) => {
            if (p?.id && !propertiesMap.has(String(p.id))) {
              propertiesMap.set(String(p.id), p);
            }
          });
        }
      }
    } catch {}

    try {
      const rawContracts = localStorage.getItem('locatrust_contracts');
      if (rawContracts) {
        const parsed = JSON.parse(rawContracts);
        if (Array.isArray(parsed)) {
          parsed.filter(isMine).forEach((c: any) => {
            const key = String(c?.id || c?.contract_number || '');
            if (key) {
              contractsMap.set(key, { ...(contractsMap.get(key) || {}), ...c });
            }
          });
        }
      }
    } catch {}

    try {
      const rawApps = localStorage.getItem('locatrust_rental_applications');
      if (rawApps) {
        const parsed = JSON.parse(rawApps);
        if (Array.isArray(parsed)) {
          parsed.filter(isMine).forEach((a: any) => {
            if (a?.id) {
              applicationsMap.set(String(a.id), { ...(applicationsMap.get(String(a.id)) || {}), ...a });
            }
          });
        }
      }
    } catch {}
  }

  const now = new Date();
  const expiredContractIds: string[] = [];

  for (const [key, contract] of contractsMap.entries()) {
    const rawStatus = String(contract?.status || contract?.contract_status || '').trim().toLowerCase();
    if (ACTIVE_CONTRACT_STATUSES.has(rawStatus) || rawStatus === 'signe') {
      const endDateVal = contract?.end_date || contract?.endDate || contract?.expiration_date || contract?.expires_at;
      if (endDateVal) {
        const endTs = parseContractDateEndOfDay(endDateVal);
        if (endTs !== null && endTs < now.getTime()) {
          // Expiration automatique en arrière-plan
          contractsMap.set(key, { ...contract, status: 'expire' });
          expiredContractIds.push(String(contract.id || contract.contract_number || key));
        }
      }
    }
  }

  // Persistance silencieuse en arrière-plan des contrats arrivés à expiration
  if (expiredContractIds.length > 0) {
    if (typeof window !== 'undefined') {
      try {
        const rawContracts = localStorage.getItem('locatrust_contracts');
        if (rawContracts) {
          const parsed = JSON.parse(rawContracts);
          if (Array.isArray(parsed)) {
            const expSet = new Set(expiredContractIds);
            const updated = parsed.map((c: any) => {
              if (c && (expSet.has(String(c.id)) || expSet.has(String(c.contract_number)))) {
                return { ...c, status: 'expire' };
              }
              return c;
            });
            localStorage.setItem('locatrust_contracts', JSON.stringify(updated));
          }
        }
      } catch {}
    }

    // Mise à jour asynchrone non bloquante vers Supabase et /api/sync
    expiredContractIds.forEach((cid) => {
      supabase
        .from('contracts')
        .update({ status: 'expire' })
        .or(`id.eq.${cid},contract_number.eq.${cid}`)
        .then(() => {})
        .catch(() => {});
    });
  }

  const computedResult = calculateQuotaFromDataset({
    properties: Array.from(propertiesMap.values()),
    contracts: Array.from(contractsMap.values()),
    applications: Array.from(applicationsMap.values()),
    ownerId: role === 'proprietaire' ? cleanId : undefined,
    agencyId: role === 'agence' ? cleanId : undefined,
    referenceDate: now
  });

  // Mise en cache silencieuse et notification d'arrière-plan si le quota a évolué
  if (typeof window !== 'undefined' && cleanId) {
    try {
      const cacheKey = `locatrust_quota_state_${cleanId}`;
      const prevRaw = localStorage.getItem(cacheKey);
      const prev = prevRaw ? JSON.parse(prevRaw) : null;
      localStorage.setItem(cacheKey, JSON.stringify(computedResult));

      const hasChanged =
        !prev ||
        prev.billablePropertiesCount !== computedResult.billablePropertiesCount ||
        prev.quotaPrice !== computedResult.quotaPrice ||
        prev.managedPropertiesCount !== computedResult.managedPropertiesCount ||
        prev.activeContractsCount !== computedResult.activeContractsCount;

      if (hasChanged) {
        window.dispatchEvent(new CustomEvent('locatrust:quota-updated', { detail: computedResult }));
      }
    } catch {}
  }

  return computedResult;
}

/**
 * Récupère instantanément (de manière synchrone) l'état du quota pré-calculé en arrière-plan
 * afin d'éviter tout chargement manuel ou latence d'affichage.
 */
export function getCachedQuotaState(
  entityId?: string,
  role: 'proprietaire' | 'agence' = 'proprietaire'
): QuotaComputationResult {
  purgeLegacyPeakWatermark();
  const cleanId = (entityId || '').trim();

  if (typeof window !== 'undefined' && cleanId) {
    try {
      const cachedRaw = localStorage.getItem(`locatrust_quota_state_${cleanId}`);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed && typeof parsed.billablePropertiesCount === 'number' && typeof parsed.quotaPrice === 'number') {
          return parsed as QuotaComputationResult;
        }
      }
    } catch {}

    // Calcul synchrone immédiat depuis les données locales en attendant le rafraîchissement réseau
    try {
      const props = JSON.parse(localStorage.getItem('locatrust_properties') || '[]');
      const contracts = JSON.parse(localStorage.getItem('locatrust_contracts') || '[]');
      const apps = JSON.parse(localStorage.getItem('locatrust_rental_applications') || '[]');
      return calculateQuotaFromDataset({
        properties: Array.isArray(props) ? props : [],
        contracts: Array.isArray(contracts) ? contracts : [],
        applications: Array.isArray(apps) ? apps : [],
        ownerId: role === 'proprietaire' ? cleanId : undefined,
        agencyId: role === 'agence' ? cleanId : undefined
      });
    } catch {}
  }

  return calculateQuotaFromDataset({
    properties: [],
    contracts: [],
    applications: [],
    ownerId: role === 'proprietaire' ? cleanId : undefined,
    agencyId: role === 'agence' ? cleanId : undefined
  });
}

/**
 * Calcule le nombre de biens facturables et le détail complet du quota pour un Propriétaire.
 */
export async function getBillablePropertyCount(ownerId: string): Promise<QuotaComputationResult> {
  return computeLiveQuotaForEntity(ownerId, 'proprietaire');
}

/**
 * Calcule le nombre de biens facturables et le détail complet du quota pour une Agence immobilière.
 */
export async function getAgencyBillablePropertyCount(agencyId: string): Promise<QuotaComputationResult> {
  return computeLiveQuotaForEntity(agencyId, 'agence');
}

/**
 * Exécute silencieusement le calcul et la synchronisation du quota en arrière-plan.
 */
export async function syncQuotaInBackground(
  entityId: string,
  role?: 'proprietaire' | 'agence' | string
): Promise<QuotaComputationResult | null> {
  if (!entityId) return null;
  const normalizedRole: 'proprietaire' | 'agence' = role === 'agence' ? 'agence' : 'proprietaire';
  try {
    return await computeLiveQuotaForEntity(entityId, normalizedRole);
  } catch {
    return null;
  }
}

let bgQuotaInterval: ReturnType<typeof setInterval> | null = null;
let bgQuotaListenerCleanup: (() => void) | null = null;
let bgActiveEntityId: string | null = null;

/**
 * Démarre le démon autonome de calcul du quota en arrière-plan.
 * Il surveille automatiquement les activations, résiliations et expirations de contrats
 * et met à jour le quota du propriétaire ou de l'agence en temps réel sans intervention manuelle.
 */
export function startBackgroundQuotaWorker(
  entityId: string,
  role?: 'proprietaire' | 'agence' | string
): void {
  if (typeof window === 'undefined' || !entityId) return;
  if (role === 'locataire') return;

  const cleanId = entityId.trim();
  if (!cleanId) return;

  if (bgActiveEntityId === cleanId && bgQuotaInterval !== null) {
    // Déclencher une synchronisation immédiate silencieuse
    syncQuotaInBackground(cleanId, role).catch(() => {});
    return;
  }

  stopBackgroundQuotaWorker();
  bgActiveEntityId = cleanId;

  // Exécution immédiate en arrière-plan
  syncQuotaInBackground(cleanId, role).catch(() => {});

  let debounceTimer: any = null;
  const handleDomainMutation = () => {
    if (bgActiveEntityId) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (bgActiveEntityId && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
          syncQuotaInBackground(bgActiveEntityId, role).catch(() => {});
        }
      }, 2500);
    }
  };

  window.addEventListener('locatrust:contracts-updated', handleDomainMutation);
  window.addEventListener('locatrust:applications-updated', handleDomainMutation);
  window.addEventListener('locatrust:properties-updated', handleDomainMutation);

  bgQuotaListenerCleanup = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    window.removeEventListener('locatrust:contracts-updated', handleDomainMutation);
    window.removeEventListener('locatrust:applications-updated', handleDomainMutation);
    window.removeEventListener('locatrust:properties-updated', handleDomainMutation);
  };

  // Vérification périodique silencieuse et allégée en arrière-plan (uniquement si l'onglet est actif)
  bgQuotaInterval = setInterval(() => {
    if (bgActiveEntityId && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
      syncQuotaInBackground(bgActiveEntityId, role).catch(() => {});
    }
  }, 90000);
}

/**
 * Arrête proprement le démon de calcul du quota lors de la déconnexion.
 */
export function stopBackgroundQuotaWorker(): void {
  if (bgQuotaInterval !== null) {
    clearInterval(bgQuotaInterval);
    bgQuotaInterval = null;
  }
  if (bgQuotaListenerCleanup) {
    bgQuotaListenerCleanup();
    bgQuotaListenerCleanup = null;
  }
  bgActiveEntityId = null;
}

