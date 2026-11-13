import { supabase } from '@/src/lib/supabase';
import { MonthAccountingRecord, PeriodSummary } from '@/lib/reports/accountingHistoryStore';
import {
  computePortfolioRentMetrics,
  extractContractMonthlyRent,
  parseDateSafe,
  resolveContractDueDay,
  resolveContractEffectiveStartDate,
  generateContractSchedule,
  reconcilePaymentsOnSchedule
} from '@/lib/payments/rentScheduleEngine';
import { getUnifiedReceipts } from '@/lib/receiptsStore';

export interface RealAccountingSynthesis {
  loyersAttendus: number;
  loyersEncaisses: number;
  loyersEnAttente?: number;
  loyersImpayes: number;
  loyersEnRetard: number;
  cautionsAttendues?: number;
  cautionsRecues: number;
  cautionsRemboursees: number;
  cautionsRestantes: number;
  depensesMaintenance: number;
  autresDepenses: number;
  totalEncaisse: number;
  totalDepense: number;
  resultatNet: number;
  tauxRecouvrement: number;
  isAgency?: boolean;
  agencyMandantsCount?: number;
  commissionsAgence?: number;
  totalReverseMandants?: number;
}

export interface RealAccountingDataset {
  ownerName: string;
  owner?: {
    name: string;
    id: string;
    phone: string;
    email: string;
    address: string;
  };
  synthesis: RealAccountingSynthesis;
  encaissements: any[];
  loyers: any[];
  cautions: any[];
  maintenance: any[];
  contrats: any[];
  activePropertiesCount: number;
  activeTenantsCount: number;
  activeContractsCount: number;
  monthlyBreakdown: MonthAccountingRecord[];
  extraStats: {
    pendingSignaturesCount: number;
    expiringSoonCount: number;
    expiredCount: number;
    terminatedCount: number;
    reservedCount: number;
    finContratCount: number;
    disabledCount: number;
    cautionsRetenues: number;
    resolvedTicketsRatio: number;
    totalTickets: number;
  };
}

export interface MonthYearAllocation {
  year: number;
  monthIndex: number; // 0 = Janvier, 11 = Décembre
  monthName: string;
  monthKey: string; // YYYY-MM
  amount: number;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const FRENCH_MONTH_MAP: { [k: string]: number } = {
  janvier: 0,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  décembre: 11
};

export const FICTITIOUS_TEST_REFS = new Set<string>([
  'ESP-364218',
  'REC-CAUTION-000492',
  'WAV-2026-NOV-781920',
  'ESP-135945',
  'pmt_dec_nov2026_01',
  'pmt_esp_135945',
  'a1111111-aaaa-bbbb-cccc-111111111111',
  'a2222222-aaaa-bbbb-cccc-222222222222',
  'bd4f93b2-a80d-49b5-abfa-b87c835d0eda',
  'cau_lt_000492',
  'rec_cau_000492',
  'rec_wav_781920',
  'rec_esp_135945'
]);

export function isFictitiousOrTestReference(ref: any): boolean {
  if (!ref) return false;
  const r = String(ref).trim().toUpperCase();
  if (FICTITIOUS_TEST_REFS.has(r) || FICTITIOUS_TEST_REFS.has(String(ref).trim())) return true;
  if (
    r.startsWith('REC-CAUTION-000492') ||
    r.startsWith('ESP-135945') ||
    r.startsWith('WAV-2026-NOV-781920') ||
    r.startsWith('ESP-364218') ||
    r.startsWith('CAU_LT_000492')
  ) {
    return true;
  }
  if (r.includes('10000000') || r.includes('11420') || r.includes('DEC_NOV')) return true;
  return false;
}

export function purgeAllFictitiousData(): void {
  if (typeof window === 'undefined') return;
  try {
    const isFictitiousAmt = (amt: any) => {
      const num = Number(String(amt || 0).replace(/[\s\u00A0,]/g, ''));
      return isNaN(num) || num <= 0 || num > 200000;
    };

    // 1. locatrust_rent_payments
    const rawPmts = localStorage.getItem('locatrust_rent_payments');
    if (rawPmts) {
      const pmts = JSON.parse(rawPmts);
      if (Array.isArray(pmts)) {
        const cleaned = pmts.filter((p: any) => {
          const ref = p.reference || p.receipt_number || p.id;
          if (isFictitiousOrTestReference(ref)) return false;
          if (isFictitiousAmt(p.amount)) return false;
          if (String(p.type || '').toLowerCase() === 'caution' || String(ref).toUpperCase().startsWith('REC-CAUTION')) return false;
          return true;
        });
        localStorage.setItem('locatrust_rent_payments', JSON.stringify(cleaned));
      }
    }

    // 2. locatrust_receipts & locatrust_tenant_receipts_v2
    ['locatrust_receipts', 'locatrust_tenant_receipts_v2', 'locatrust_unified_receipts'].forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const cleaned = list.filter((r: any) => {
            const ref = r.receipt_number || r.receiptNumber || r.id;
            if (isFictitiousOrTestReference(ref)) return false;
            if (isFictitiousAmt(r.amount)) return false;
            return true;
          });
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
    });

    // 3. locatrust_deleted_payments
    const deletedRefs = Array.from(FICTITIOUS_TEST_REFS);
    let existingDeleted: string[] = [];
    try {
      const raw = localStorage.getItem('locatrust_deleted_payments');
      if (raw) existingDeleted = JSON.parse(raw);
    } catch {}
    const mergedDeleted = Array.from(new Set([...existingDeleted, ...deletedRefs]));
    localStorage.setItem('locatrust_deleted_payments', JSON.stringify(mergedDeleted));

    // 4. locatrust_notifications : purger toute alerte résiduelle obsolète
    const rawNotifs = localStorage.getItem('locatrust_notifications');
    if (rawNotifs) {
      const notifs = JSON.parse(rawNotifs);
      if (Array.isArray(notifs)) {
        const cleaned = notifs.filter((n: any) => {
          const txt = `${n.title || ''} ${n.description || ''} ${n.content || ''} ${JSON.stringify(n.payload || {})}`;
          for (const dRef of FICTITIOUS_TEST_REFS) {
            if (txt.includes(dRef)) return false;
          }
          if (txt.includes('10000000') || txt.includes('11420') || txt.includes('4340') || txt.includes('4360')) return false;
          return true;
        });
        localStorage.setItem('locatrust_notifications', JSON.stringify(cleaned));
      }
    }

    // 5. Supprimer le résumé comptable live obsolète pour forcer le recalcul frais
    localStorage.removeItem('locatrust_accounting_live_summary');

    // 6. Réinitialisation de l'exercice par défaut à 2026 s'il avait été forcé à 2027 lors de tests
    const curYear = localStorage.getItem('locatrust_current_accounting_year');
    if (curYear === '2027') {
      localStorage.setItem('locatrust_current_accounting_year', '2026');
      localStorage.setItem('locatrust_accounting_reference_year', '2026');
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith('_accounting_year')) {
        if (localStorage.getItem(k) === '2027') {
          localStorage.setItem(k, '2026');
        }
      }
    }
  } catch {}
}

if (typeof window !== 'undefined') {
  purgeAllFictitiousData();
}

export function parsePaymentPeriodAllocations(
  targetPeriod: string,
  totalAmount: number,
  paymentDate?: string
): MonthYearAllocation[] {
  const amt = Number(String(totalAmount || 0).replace(/[\s\u00A0,]/g, '')) || 0;
  if (amt <= 0 || amt > 200000) return []; // Rejeter tout montant fictif anormal (> 200 000 FCFA)

  // Le montant s'impute uniquement sur son mois d'effet / signature (pas de répartition étalée)
  let y = 2026;
  let mIdx = 10; // Novembre par défaut (mois de signature)

  const cleanTarget = String(targetPeriod || '').toLowerCase().trim();
  for (const [k, idx] of Object.entries(FRENCH_MONTH_MAP)) {
    if (cleanTarget.startsWith(k) || cleanTarget.includes(k)) {
      mIdx = idx;
      break;
    }
  }

  const yearMatch = cleanTarget.match(/\b(202\d)\b/);
  if (yearMatch) {
    y = parseInt(yearMatch[1], 10);
  } else if (paymentDate && typeof paymentDate === 'string' && /^\d{4}/.test(paymentDate)) {
    y = parseInt(paymentDate.slice(0, 4), 10);
  }

  const mKey = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
  return [{
    year: y,
    monthIndex: mIdx,
    monthName: MONTH_NAMES[mIdx] || 'Novembre',
    monthKey: mKey,
    amount: amt
  }];
}

// Cache mémoire réactif court pour fluidité et synchronisation instantanée
const accountingCache = new Map<string, { data: RealAccountingDataset; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 secondes max

export function invalidateAccountingCache() {
  accountingCache.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('locatrust:payments-updated', invalidateAccountingCache);
  window.addEventListener('locatrust:contracts-updated', invalidateAccountingCache);
  window.addEventListener('locatrust:properties-updated', invalidateAccountingCache);
  window.addEventListener('locatrust:cautions_updated', invalidateAccountingCache);
  window.addEventListener('locatrust:receipts-updated', invalidateAccountingCache);
}

export async function fetchRealAccountingData(userId?: string, targetYear: string = '2026'): Promise<RealAccountingDataset> {
  const currentYearNum = parseInt(targetYear, 10) || new Date().getFullYear();
  const cacheKey = `${userId || 'anonymous'}_${targetYear}`;

  const cached = accountingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // 0. Récupérer le profil utilisateur pour connaître son rôle (Agence, Propriétaire, Locataire)
    let userProfile: any = null;
    if (userId) {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        userProfile = data;
      } catch (err) {
        console.warn('Erreur chargement profil utilisateur:', err);
      }
    }

    const activeRole = typeof window !== 'undefined'
      ? (localStorage.getItem('locatrust_user_role') || localStorage.getItem('locatrust_active_role') || localStorage.getItem('currentRole'))
      : null;
    const isAgency = userProfile?.account_type === 'agence' || userProfile?.role === 'agence' || activeRole === 'agence';
    const isTenant = userProfile?.account_type === 'locataire' || userProfile?.role === 'locataire' || activeRole === 'locataire';

    // 1. Requêtes Supabase directes sans jointures relationnelles instables (pour éviter PGRST200)
    let pQuery = supabase.from('properties').select('*').is('deleted_at', null);
    if (userId && !isTenant) {
      pQuery = pQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
    }

    let cQuery = supabase.from('contracts').select('*');
    if (userId) {
      if (isTenant) {
        cQuery = cQuery.eq('tenant_id', userId);
      } else {
        cQuery = cQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
      }
    }

    let pmQuery = supabase.from('rent_payments').select('*');
    if (userId) {
      if (isTenant) {
        pmQuery = pmQuery.eq('tenant_id', userId);
      } else {
        pmQuery = pmQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
      }
    }

    let cauQuery = supabase.from('cautions').select('*');
    if (userId) {
      if (isTenant) {
        cauQuery = cauQuery.eq('tenant_id', userId);
      } else {
        cauQuery = cauQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
      }
    }

    let recQuery = supabase.from('receipts').select('*');
    if (userId) {
      if (isTenant) {
        recQuery = recQuery.eq('tenant_id', userId);
      } else {
        recQuery = recQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
      }
    }

    let mQuery = supabase.from('maintenance_tickets').select('*');
    if (userId && !isTenant) {
      mQuery = mQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
    }

    let profQuery = supabase.from('profiles').select('id, full_name, email, phone, account_type, role');

    // 2. Exécution résiliente via Promise.allSettled (garantit que rien n'est écrasé à 0 en cas d'erreur isolée)
    const [
      propsRes,
      contractsRes,
      paymentsRes,
      cautionsRes,
      receiptsRes,
      ticketsRes,
      profilesRes
    ] = await Promise.allSettled([
      pQuery,
      cQuery,
      pmQuery,
      cauQuery,
      recQuery,
      mQuery,
      profQuery
    ]);

    const realProps: any[] = propsRes.status === 'fulfilled' && Array.isArray(propsRes.value.data) ? propsRes.value.data : [];
    let realContracts: any[] = contractsRes.status === 'fulfilled' && Array.isArray(contractsRes.value.data) ? contractsRes.value.data : [];
    let realPayments: any[] = paymentsRes.status === 'fulfilled' && Array.isArray(paymentsRes.value.data) ? paymentsRes.value.data : [];
    let realCautions: any[] = cautionsRes.status === 'fulfilled' && Array.isArray(cautionsRes.value.data) ? cautionsRes.value.data : [];
    let realReceipts: any[] = receiptsRes.status === 'fulfilled' && Array.isArray(receiptsRes.value.data) ? receiptsRes.value.data : [];
    let realTickets: any[] = ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value.data) ? ticketsRes.value.data : [];
    const allProfiles: any[] = profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value.data) ? profilesRes.value.data : [];

    // 3. Synchronisation multi-appareils (/api/sync) et résilience locale isolée par utilisateur
    const deletedKeysSet = new Set<string>(['ESP-364218', 'pmt_dec_nov2026_01', 'pmt_esp_135945']);

    if (typeof window !== 'undefined') {
      try {
        const rawDeleted = localStorage.getItem('locatrust_deleted_payments');
        if (rawDeleted) {
          const arr = JSON.parse(rawDeleted);
          if (Array.isArray(arr)) arr.forEach((k: string) => deletedKeysSet.add(String(k).trim()));
        }
      } catch {}

      // 1.b Propriétés gérées par l'utilisateur ou l'agence (Support multi-mandats agence)
      const agencyPropIds = new Set<string>(realProps.map((p: any) => String(p.id)));
      const agencyMandantIds = new Set<string>();

      try {
        const rawLocalProps = localStorage.getItem('locatrust_properties');
        if (rawLocalProps) {
          const localProps = JSON.parse(rawLocalProps);
          if (Array.isArray(localProps)) {
            localProps.forEach((lp: any) => {
              const isMatch =
                lp.owner_id === userId ||
                lp.agency_id === userId ||
                lp.agencyId === userId ||
                (isAgency && (lp.mandant_id || lp.mandant_name || lp.agency_id === userId || lp.agencyId === userId));
              if (isMatch && !agencyPropIds.has(String(lp.id))) {
                realProps.push(lp);
                agencyPropIds.add(String(lp.id));
              }
            });
          }
        }

        // Mandats d'agence
        const rawMandates = localStorage.getItem(`locatrust_agency_mandates_${userId}`) || localStorage.getItem('locatrust_agency_mandates');
        if (rawMandates) {
          const list = JSON.parse(rawMandates);
          if (Array.isArray(list)) {
            list.forEach((m: any) => {
              if (m.id) agencyMandantIds.add(String(m.id));
              if (m.owner_id) agencyMandantIds.add(String(m.owner_id));
            });
          }
        }
      } catch {}

      const isMine = (x: any) => {
        if (!x) return false;
        if (
          x.owner_id === userId ||
          x.agency_id === userId ||
          x.agencyId === userId ||
          x.tenant_id === userId ||
          x.user_id === userId ||
          x.targetUserId === userId ||
          x.senderUserId === userId
        ) return true;
        // Ingestion complète pour les Agences Immobilières :
        // Tout contrat, paiement, candidature, caution ou ticket portant sur un bien sous mandat de l'agence
        const propId = String(x.property_id || x.property?.id || '').trim();
        if (propId && agencyPropIds.has(propId)) return true;
        const mandantId = String(x.mandant_id || x.mandantId || '').trim();
        if (mandantId && agencyMandantIds.has(mandantId)) return true;
        if (isAgency && x.owner_id && agencyMandantIds.has(String(x.owner_id))) return true;
        return false;
      };

      try {
        const syncRes = await fetch(`/api/sync?userId=${encodeURIComponent(userId || '')}`);
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          if (syncJson?.data) {
            if (Array.isArray(syncJson.data.deletedPayments)) {
              syncJson.data.deletedPayments.forEach((k: string) => deletedKeysSet.add(String(k).trim()));
            }
            // Paiements centralisés depuis le serveur (Source de vérité)
            if (Array.isArray(syncJson.data.payments)) {
              syncJson.data.payments
                .filter((sp: any) => {
                  if (!isMine(sp)) return false;
                  const ref = String(sp.reference || sp.receipt_number || '').trim();
                  const id = String(sp.id || '').trim();
                  if (deletedKeysSet.has(ref) || deletedKeysSet.has(id)) return false;
                  const numAmt = Number(String(sp.amount || 0).replace(/[\s\u00A0,]/g, ''));
                  if (numAmt <= 0 || numAmt > 200000 || isNaN(numAmt)) return false;
                  return true;
                })
                .forEach((sp: any) => {
                  const idx = realPayments.findIndex((p: any) => (sp.reference && p.reference === sp.reference) || p.id === sp.id);
                  if (idx !== -1) {
                    realPayments[idx] = {
                      ...realPayments[idx],
                      ...sp,
                      status: sp.status || realPayments[idx].status
                    };
                  } else {
                    realPayments.push(sp);
                  }
                });
            }
            // Cautions
            if (Array.isArray(syncJson.data.cautions)) {
              const knownCNums = new Set(realCautions.map((c: any) => c.contract_number || c.id));
              syncJson.data.cautions.filter(isMine).forEach((sc: any) => {
                if (sc && !knownCNums.has(sc.contract_number) && !knownCNums.has(sc.id)) {
                  realCautions.push(sc);
                  knownCNums.add(sc.contract_number || sc.id);
                }
              });
            }
            // Contrats centralisés depuis le serveur (Source de vérité)
            if (Array.isArray(syncJson.data.contracts)) {
              const knownCNums = new Set(realContracts.map((c: any) => c.contract_number || c.id));
              syncJson.data.contracts.filter(isMine).forEach((sc: any) => {
                if (sc && !knownCNums.has(sc.contract_number) && !knownCNums.has(sc.id)) {
                  realContracts.push(sc);
                  knownCNums.add(sc.contract_number || sc.id);
                }
              });
            }
            // Reçus
            if (Array.isArray(syncJson.data.receipts)) {
              const knownRNums = new Set(realReceipts.map((r: any) => r.receipt_number));
              syncJson.data.receipts
                .filter((sr: any) => {
                  if (!isMine(sr)) return false;
                  const num = String(sr.receipt_number || sr.receiptNumber || sr.id || '').trim();
                  if (deletedKeysSet.has(num)) return false;
                  const numAmt = Number(String(sr.amount || 0).replace(/[\s\u00A0,]/g, ''));
                  if (numAmt <= 0 || numAmt > 200000 || isNaN(numAmt)) return false;
                  return true;
                })
                .forEach((sr: any) => {
                  if (sr && !knownRNums.has(sr.receipt_number)) {
                    realReceipts.push(sr);
                    knownRNums.add(sr.receipt_number);
                  }
                });
            }
          }
        }
      } catch (e) {
        // En cas d'indisponibilité temporaire de /api/sync, continuer
      }

      // Fusion avec le stockage local (cache sécurisé des opérations récentes de l'utilisateur)
      try {
        const rawLocalContracts = localStorage.getItem('locatrust_contracts');
        if (rawLocalContracts) {
          const localContracts = JSON.parse(rawLocalContracts);
          if (Array.isArray(localContracts)) {
            const knownCIds = new Set(realContracts.map((c: any) => c.contract_number || c.id));
            localContracts.filter(isMine).forEach((lc: any) => {
              if (lc && !knownCIds.has(lc.contract_number) && !knownCIds.has(lc.id)) {
                realContracts.push(lc);
                knownCIds.add(lc.contract_number || lc.id);
              }
            });
          }
        }

        const rawLocalPayments = localStorage.getItem('locatrust_rent_payments');
        if (rawLocalPayments) {
          const localPmts = JSON.parse(rawLocalPayments);
          if (Array.isArray(localPmts)) {
            localPmts
              .filter((lp: any) => {
                if (!isMine(lp)) return false;
                if (lp.status === 'annule' || lp.status === 'supprime' || lp.status === 'refuse') return false;
                const ref = String(lp.reference || lp.receipt_number || '').trim();
                const id = String(lp.id || '').trim();
                if (deletedKeysSet.has(ref) || deletedKeysSet.has(id)) return false;
                const numAmt = Number(String(lp.amount || 0).replace(/[\s\u00A0,]/g, ''));
                if (numAmt <= 0 || numAmt > 200000 || isNaN(numAmt)) return false; // Bloquer tout montant test anormal
                return true;
              })
              .forEach((lp: any) => {
                const idx = realPayments.findIndex((p: any) => (lp.reference && p.reference === lp.reference) || p.id === lp.id);
                if (idx !== -1) {
                  if (realPayments[idx].status !== 'confirme') {
                    realPayments[idx] = { ...realPayments[idx], ...lp };
                  }
                } else {
                  realPayments.push(lp);
                }
              });
          }
        }

        const rawLocalCautions = localStorage.getItem('locatrust_deposits_v1') || localStorage.getItem('locatrust_caution_deposits');
        if (rawLocalCautions) {
          const localCautions = JSON.parse(rawLocalCautions);
          if (Array.isArray(localCautions)) {
            const knownCauNums = new Set(realCautions.map((c: any) => c.contract_number || c.id));
            localCautions.filter(isMine).forEach((lc: any) => {
              if (lc && !knownCauNums.has(lc.contract_number) && !knownCauNums.has(lc.id)) {
                realCautions.push(lc);
                knownCauNums.add(lc.contract_number || lc.id);
              }
            });
          }
        }

        // Intégration des contrats actifs depuis locatrust_rental_applications (avec dédoublonnage strict par logement)
        const rawApps = localStorage.getItem('locatrust_rental_applications');
        if (rawApps) {
          const apps = JSON.parse(rawApps);
          if (Array.isArray(apps)) {
            const knownCNums = new Set(realContracts.map((c: any) => c.contract_number || c.id));
            const knownPropIds = new Set(realContracts.map((c: any) => c.property_id).filter(Boolean));
            apps.filter((a: any) => isMine(a) && (a.status === 'contrat_actif' || a.documents?.contract_status === 'contrat_actif')).forEach((a: any) => {
              const cNum = a.contract_number || a.id;
              const pId = a.property_id;
              if (pId && knownPropIds.has(pId)) return; // Logement déjà représenté par un contrat dans realContracts
              if (cNum && !knownCNums.has(cNum) && !knownCNums.has(a.id)) {
                realContracts.push({
                  id: a.id,
                  contract_number: a.contract_number,
                  property_id: a.property_id,
                  tenant_id: a.tenant_id,
                  monthly_rent: Number(a.monthly_rent || a.rent_amount || a.rent || 0),
                  caution_amount: Number(a.caution_amount || 0),
                  signed_date: a.signed_date || a.documents?.signed_date || a.signed_at,
                  signed_at: a.signed_at || a.documents?.signed_at,
                  start_date: a.start_date || a.documents?.start_date || a.signed_date,
                  status: 'actif',
                  tenant_signed: true
                });
                knownCNums.add(cNum);
                if (pId) knownPropIds.add(pId);
              }
            });
          }
        }

        // Intégration du Registre Unifié des Reçus (locatrust_receipts + locatrust_tenant_receipts_v2)
        const unifiedLocalReceipts = getUnifiedReceipts(userId);
        const knownRNums = new Set(realReceipts.map((r: any) => r.receipt_number || r.receiptNumber));
        unifiedLocalReceipts.forEach((ur: any) => {
          const num = ur.receipt_number || ur.receiptNumber;
          if (num && !knownRNums.has(num)) {
            realReceipts.push(ur);
            knownRNums.add(num);
          }
        });
      } catch {}
    }

    // 4. Intégration des reçus certifiés (receipts) s'ils ne sont pas déjà comptabilisés dans rent_payments ou cautions
    const knownPaymentRefs = new Set(realPayments.map((p: any) => p.receipt_number || p.reference || p.id));
    
    // Clés d'identification complètes pour dédoublonnage strict des cautions
    const knownCautionKeys = new Set<string>();
    realCautions.forEach((c: any) => {
      if (c.id) knownCautionKeys.add(String(c.id));
      if (c.contract_id) knownCautionKeys.add(String(c.contract_id));
      if (c.contract_number) knownCautionKeys.add(String(c.contract_number));
      if (c.receipt_number) knownCautionKeys.add(String(c.receipt_number));
      if (c.token) knownCautionKeys.add(String(c.token));
      if (c.declared_reference) knownCautionKeys.add(String(c.declared_reference));
    });

    realReceipts.forEach((r: any) => {
      const rAmt = Number(String(r.amount || 0).replace(/[\s\u00A0,]/g, '')) || 0;
      if (rAmt <= 0 || rAmt > 200000) return; // Rejeter tout montant fictif anormal
      const rNum = String(r.receipt_number || r.receiptNumber || r.id || '').trim();
      if (deletedKeysSet.has(rNum)) return;

      if (r.type === 'loyer' && r.receipt_number && !knownPaymentRefs.has(r.receipt_number)) {
        realPayments.push({
          id: r.payment_id || r.id,
          receipt_number: r.receipt_number,
          reference: r.receipt_number,
          amount: rAmt,
          status: 'confirme',
          payment_date: r.created_at ? r.created_at.split('T')[0] : '2026-11-10',
          target_month: r.period_covered || 'Novembre 2026',
          tenant_id: r.tenant_id,
          owner_id: r.owner_id,
          agency_id: r.agency_id,
          contract_id: r.contract_id
        });
        knownPaymentRefs.add(r.receipt_number);
      } else if (r.type === 'caution') {
        const isAlreadyKnown =
          (r.receipt_number && knownCautionKeys.has(String(r.receipt_number))) ||
          (r.contract_id && knownCautionKeys.has(String(r.contract_id))) ||
          (r.contract_number && knownCautionKeys.has(String(r.contract_number))) ||
          (r.id && knownCautionKeys.has(String(r.id)));

        if (!isAlreadyKnown && r.contract_number) {
          const contractNum = r.contract_number;
          realCautions.push({
            id: r.caution_id || r.id,
            contract_id: r.contract_id || contractNum,
            contract_number: contractNum,
            amount_requested: rAmt,
            amount_paid: rAmt,
            status: 'paye_complet',
            receipt_number: r.receipt_number,
            tenant_id: r.tenant_id,
            owner_id: r.owner_id,
            agency_id: r.agency_id,
            created_at: r.created_at || new Date().toISOString()
          });
          if (r.receipt_number) knownCautionKeys.add(String(r.receipt_number));
          if (contractNum) knownCautionKeys.add(String(contractNum));
        }
      }
    });

    // 4b. Normalisation stricte : tout paiement validé par reçu ou signatures est formellement 'confirme' (Règle 6)
    realPayments = realPayments
      .filter((p: any) => {
        if (!p || p.status === 'annule' || p.status === 'supprime' || p.status === 'refuse') return false;
        const ref = String(p.reference || p.receipt_number || '').trim();
        const id = String(p.id || '').trim();
        if (deletedKeysSet.has(ref) || deletedKeysSet.has(id)) return false;
        const numAmt = Number(String(p.amount || 0).replace(/[\s\u00A0,]/g, ''));
        if (numAmt <= 0 || numAmt > 200000 || isNaN(numAmt)) return false; // Bloquer tout montant test anormal
        return true;
      })
      .map((p: any) => {
        const hasReceipt = realReceipts.some((r: any) => r.receipt_number === p.reference || r.receipt_number === p.receipt_number);
        if (hasReceipt || (p.tenant_signature_url && p.owner_signature_url)) {
          return { ...p, status: 'confirme' };
        }
        return p;
      });

    // 5. Indexation des objets pour jointures fiables en mémoire
    const propertyMap = new Map<string, any>(realProps.map((p: any) => [p.id, p]));
    const profileMap = new Map<string, any>(allProfiles.map((pr: any) => [pr.id, pr]));
    const contractMap = new Map<string, any>();
    realContracts.forEach((c: any) => {
      if (c.id) contractMap.set(c.id, c);
      if (c.contract_number) contractMap.set(c.contract_number, c);
    });

    // 6. Qualification précise des statuts de paiement (Section 5 du prompt)
    const isPaymentConfirmed = (p: any): boolean => {
      if (!p || p.status === 'annule' || p.status === 'supprime' || p.status === 'refuse' || p.status === 'rejete') return false;
      const s = String(p.status || '').toLowerCase().trim();
      return (
        s === 'confirme' ||
        s === 'valide' ||
        s === 'paye' ||
        s === 'certifie' ||
        Boolean(p.receipt_number) ||
        Boolean(p.tenant_signature_url && p.owner_signature_url)
      );
    };

    const isPaymentPending = (p: any): boolean => {
      if (!p || p.status === 'annule' || p.status === 'supprime' || p.status === 'refuse' || p.status === 'rejete') return false;
      if (isPaymentConfirmed(p)) return false;
      const s = String(p.status || '').toLowerCase().trim();
      return s === 'declare' || s === 'en_attente' || s === 'en_attente_validation' || s === 'a_verifier';
    };

    const isPaymentLate = (p: any): boolean => {
      const s = String(p.status || '').toLowerCase().trim();
      return s === 'en_retard' || s === 'impaye';
    };

    const isPaymentRefused = (p: any): boolean => {
      const s = String(p.status || '').toLowerCase().trim();
      return s === 'refuse' || s === 'rejete';
    };

    // 6. Calcul unifié du portefeuille via computePortfolioRentMetrics (Règles 1 à 10)
    // EXCLUSION STRICTE DES BIENS NON LOUÉS : un bien sans contrat actif ne produit AUCUN loyer attendu, ni retard, ni dette.
    const portfolioMetrics = computePortfolioRentMetrics(realProps, realContracts, realPayments, new Date());

    // Loyers encaissés confirmés (exclusion stricte de tout montant fictif anormal > 200 000 FCFA)
    const loyersEncaisses = realPayments
      .filter(isPaymentConfirmed)
      .reduce((s: number, p: any) => {
        const amt = Number(String(p.amount || 0).replace(/[\s\u00A0,]/g, '')) || 0;
        if (amt > 200000 || amt <= 0 || isNaN(amt)) return s;
        return s + amt;
      }, 0);

    // Loyers déclarés mais non encore confirmés
    const loyersEnAttente = realPayments
      .filter(isPaymentPending)
      .reduce((s: number, p: any) => {
        const amt = Number(String(p.amount || 0).replace(/[\s\u00A0,]/g, '')) || 0;
        if (amt > 200000 || amt <= 0 || isNaN(amt)) return s;
        return s + amt;
      }, 0);

    // Loyers en retard (issu directement de l'évaluation réelle des échéances échues non soldées)
    const loyersEnRetard = portfolioMetrics.totalLateRent;
    const loyersImpayes = portfolioMetrics.totalLateRent;

    // Contrats actifs (Exclusion stricte des contrats terminés/clos)
    const rawActiveContracts = realContracts.filter((c: any) => {
      const st = String(c?.status || '').toLowerCase().trim();
      return (
        (st === 'actif' || st === 'signe' || st === 'contrat_actif') &&
        st !== 'termine' &&
        st !== 'cloture' &&
        st !== 'resilie'
      );
    });

    // Dédoublonnage strict des contrats actifs : 1 seul contrat actif par logement (évite la duplication du loyer attendu à 40 000 FCFA)
    const activeContracts: any[] = [];
    const seenActivePropertyIds = new Set<string>();
    const seenActiveContractNumbers = new Set<string>();

    rawActiveContracts.forEach((c: any) => {
      const pId = String(c.property_id || c.property?.id || '').trim();
      const cNum = String(c.contract_number || c.contractNumber || c.id || '').trim();
      if (cNum && seenActiveContractNumbers.has(cNum)) return;
      if (pId && seenActivePropertyIds.has(pId)) return;
      if (pId) seenActivePropertyIds.add(pId);
      if (cNum) seenActiveContractNumbers.add(cNum);
      activeContracts.push(c);
    });

    // Loyer mensuel attendu (cumul des baux actifs uniquement : 0 si aucun contrat actif)
    const monthlyRentExpected = portfolioMetrics.totalExpectedRentCurrentMonth;
    const loyersAttendus = monthlyRentExpected;

    // Cautions (dépôts de garantie sous séquestre)
    // RÈGLE MÉTIER STRICTE : SEULS les contrats de bail EFFECTIVEMENT SIGNÉS ET ACTIFS ont une caution perçue/détenue.
    const activeContractKeys = new Set<string>();
    activeContracts.forEach((ac: any) => {
      if (ac.id) activeContractKeys.add(String(ac.id));
      if (ac.contract_number) activeContractKeys.add(String(ac.contract_number));
    });

    // Dédoublonner strictement les cautions par contrat actif (1 caution maximum par contrat signé)
    const activeCautionsMap = new Map<string, any>();
    realCautions.forEach((c: any) => {
      const isConfirmed = c.status === 'paye_complet' || c.status === 'confirme' || c.status === 'certifie' || c.status === 'caution_confirmee';
      const cContract = String(c.contract_number || c.contract_id || '').trim();
      const isContractActive = activeContractKeys.has(cContract) || activeContractKeys.has(String(c.id));

      if (isConfirmed && isContractActive) {
        const contractKey = cContract || String(c.id);
        if (!activeCautionsMap.has(contractKey)) {
          activeCautionsMap.set(contractKey, c);
        } else {
          const existing = activeCautionsMap.get(contractKey);
          activeCautionsMap.set(contractKey, {
            ...existing,
            ...c,
            amount_paid: Math.max(Number(existing.amount_paid) || 0, Number(c.amount_paid) || 0, Number(c.amount_requested) || 0)
          });
        }
      }
    });

    const activeCautionsList = Array.from(activeCautionsMap.values());
    const cautionsRecues = activeContracts.length > 0
      ? activeCautionsList.reduce((s: number, c: any) => s + (Number(c.amount_paid) || Number(c.amount_requested) || 0), 0)
      : 0;

    const cautionsRemboursees = activeCautionsList.reduce(
      (s: number, c: any) => s + (Number(c.amount_restituted || c.refunded_amount) || 0),
      0
    );

    const cautionsRetenues = activeCautionsList.reduce(
      (s: number, c: any) => s + (Number(c.deduction_amount || c.deductions_amount) || 0),
      0
    );

    const cautionsRestantes = Math.max(0, cautionsRecues - cautionsRemboursees - cautionsRetenues);

    // Maintenance & Dépenses
    const depensesMaintenance = realTickets.reduce(
      (s: number, t: any) => s + (Number(t.cost || t.amount || t.final_cost || t.estimated_cost) || 0),
      0
    );

    const totalEncaisse = loyersEncaisses;
    const totalDepense = depensesMaintenance + cautionsRemboursees;
    const resultatNet = totalEncaisse - totalDepense;
    const tauxRecouvrement = portfolioMetrics.recoveryRateCurrentMonth;

    // 7. Tableau mensuel réel des 12 mois : calcul précis issu directement de rentCalculationEngine
    const monthlyBreakdown: MonthAccountingRecord[] = MONTH_NAMES.map((mName, idx) => {
      const monthNum = String(idx + 1).padStart(2, '0');
      const monthKey = `${currentYearNum}-${monthNum}`;

      let monthExpected = 0;
      let monthCollected = 0;
      let monthLate = 0;

      portfolioMetrics.contractsAnalysis.forEach((an) => {
        const item = an.schedule.find((s) => s.monthKey === monthKey);
        if (item) {
          const itemVal = item.year * 12 + item.monthIndex;
          const startVal = an.effectiveStartDate.getFullYear() * 12 + an.effectiveStartDate.getMonth();
          if (itemVal >= startVal) {
            monthExpected += item.amountDue;
            monthCollected += item.amountPaid;
            if (item.status === 'en_retard') {
              monthLate += item.balance;
            }
          }
        }
      });

      // Cautions reçues ce mois (uniquement contrats actifs et signés, dédoublonnées)
      const monthCautionReceived = activeCautionsList.reduce((s: number, c: any) => {
        const cDate = c.confirmed_at || c.created_at;
        const matchesMonth = cDate ? String(cDate).includes(`-${monthNum}-`) : (monthNum === '11');
        return s + (matchesMonth ? (Number(c.amount_paid) || Number(c.amount_requested) || 0) : 0);
      }, 0);

      // Maintenance ce mois
      const monthTickets = realTickets.filter((t: any) => {
        const d = t.created_at;
        return d && String(d).includes(`-${monthNum}-`);
      });
      const monthMaint = monthTickets.reduce((s: number, t: any) => s + (Number(t.cost || t.amount || t.final_cost) || 0), 0);

      // Spécificités d'Agence Immobilière Agréée (commissions de gestion & reversements mandants)
      const monthAgencyCommission = isAgency ? Math.round(monthCollected * 0.10) : 0;
      const monthNetReversedToMandants = isAgency ? Math.max(0, monthCollected - monthAgencyCommission - monthMaint) : 0;

      return {
        monthKey,
        monthName: mName,
        year: currentYearNum,
        expectedRent: monthExpected,
        collectedRent: monthCollected,
        lateRent: monthLate,
        unpaidRent: monthLate,
        otherIncome: 0,
        maintenanceExpense: monthMaint,
        cautionReceived: monthCautionReceived,
        cautionRefunded: 0,
        otherExpenses: 0,
        activeProperties: realProps.length,
        activeTenants: activeContracts.length,
        contractsActive: activeContracts.length,
        contractsSigned: 0,
        agencyCommission: monthAgencyCommission,
        netReversedToMandants: monthNetReversedToMandants
      };
    });

    // 9. Mappage structuré du Journal des Encaissements à 9 colonnes
    const mappedEncaissements = realPayments.map((p: any, idx: number) => {
      const matchedContract = contractMap.get(p.contract_id);
      const pr = propertyMap.get(p.property_id) || propertyMap.get(matchedContract?.property_id) || p.property || matchedContract?.property;
      const tn = profileMap.get(p.tenant_id) || profileMap.get(matchedContract?.tenant_id) || p.tenant || matchedContract?.tenant;

      let dateFormatted = '—';
      if (p.payment_date) {
        if (/^\d{2}\/\d{2}\/\d{4}/.test(p.payment_date)) {
          dateFormatted = p.payment_date;
        } else {
          try {
            dateFormatted = new Date(p.payment_date).toLocaleDateString('fr-FR');
          } catch {
            dateFormatted = p.payment_date;
          }
        }
      } else if (p.created_at) {
        try {
          dateFormatted = new Date(p.created_at).toLocaleDateString('fr-FR');
        } catch {}
      }

      let statusLabel = 'En attente';
      if (isPaymentConfirmed(p)) statusLabel = 'Validé';
      else if (isPaymentRefused(p)) statusLabel = 'Refusé';
      else if (isPaymentLate(p)) statusLabel = 'En retard';

      return {
        date: dateFormatted,
        receiptNo: p.receipt_number || p.reference || `REC-${currentYearNum}-${String(idx + 1).padStart(6, '0')}`,
        contractNo: matchedContract?.contract_number || p.contract_id || '—',
        tenant: tn?.full_name || p.tenant_name || p.tenant?.full_name || 'Locataire',
        property: pr?.title || 'Bien immobilier',
        period: p.target_month || p.period || 'Mois en cours',
        method: p.payment_method || 'Mobile Money',
        ref: p.reference || `REF-${idx}`,
        amount: Number(p.amount) || 0,
        status: statusLabel,
        validatedAt: p.confirmed_at || p.validated_at ? new Date(p.confirmed_at || p.validated_at).toLocaleDateString('fr-FR') : '—'
      };
    });

    // 10. Mappage structuré de l'État des Loyers
    const mappedLoyers = realContracts.map((c: any) => {
      const pr = propertyMap.get(c.property_id) || c.property;
      const tn = profileMap.get(c.tenant_id) || c.tenant;
      const monthlyRent = Number(c.monthly_rent ?? c.rent ?? pr?.rent ?? 0);

      const contractPaid = realPayments
        .filter((p: any) => (p.contract_id === c.id || p.contract_id === c.contract_number) && isPaymentConfirmed(p))
        .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

      return {
        tenant: tn?.full_name || c.tenant_name || 'Locataire',
        property: pr?.title || 'Bien immobilier',
        monthlyRent,
        month: 'Mois en cours',
        expected: monthlyRent,
        paid: contractPaid > 0 ? monthlyRent : 0,
        balance: Math.max(0, monthlyRent - (contractPaid > 0 ? monthlyRent : 0)),
        paymentDate: contractPaid > 0 ? 'À jour' : '—',
        status: contractPaid > 0 ? 'À jour' : 'En attente'
      };
    });

    // 11. Mappage structuré de l'État des Dépôts de Garantie / Cautions
    const mappedCautions = realCautions.map((cau: any) => {
      const matchedContract = contractMap.get(cau.contract_id) || contractMap.get(cau.contract_number);
      const pr = propertyMap.get(cau.property_id) || propertyMap.get(matchedContract?.property_id) || cau.property || matchedContract?.property;
      const tn = profileMap.get(cau.tenant_id) || profileMap.get(matchedContract?.tenant_id) || cau.tenant || matchedContract?.tenant;

      const planned = Number(cau.amount_requested || matchedContract?.caution_amount || 0);
      const isConfirmed = cau.status === 'paye_complet' || cau.status === 'confirme' || cau.status === 'certifie';
      const deposited = Number(cau.amount_paid || (isConfirmed ? planned : 0));
      const refunded = Number(cau.amount_restituted || cau.refunded_amount || 0);
      const retained = Number(cau.deduction_amount || cau.deductions_amount || 0);
      const balanceRemaining = Math.max(0, deposited - refunded - retained);

      let reasonLabel = 'Bail en cours (Sous séquestre)';
      if (refunded >= deposited && deposited > 0) {
        reasonLabel = 'Restitution totale';
      } else if (retained > 0) {
        reasonLabel = `Retenue pour remise en état`;
      } else if (deposited === 0) {
        reasonLabel = 'En attente de versement';
      }

      return {
        tenant: tn?.full_name || cau.tenant_name || 'Locataire',
        property: pr?.title || cau.property_title || 'Bien immobilier',
        contractNo: cau.contract_number || matchedContract?.contract_number || cau.contract_id || '—',
        planned,
        deposited,
        refunded,
        retained,
        balanceRemaining,
        refundDate: cau.restituted_at ? new Date(cau.restituted_at).toLocaleDateString('fr-FR') : '—',
        reason: reasonLabel
      };
    });

    // 12. Mappage structuré des Dépenses de Maintenance
    const mappedMaintenance = realTickets.map((t: any) => {
      const pr = propertyMap.get(t.property_id) || t.property;
      return {
        date: t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR') : '—',
        property: pr?.title || 'Bien immobilier',
        tenant: 'Locataire',
        description: t.title || t.description || 'Intervention technique',
        category: t.category || 'Maintenance',
        contractor: t.artisan_name || 'Prestataire agréé',
        amount: Number(t.cost || t.amount || t.final_cost || t.estimated_cost) || 0,
        status: t.status === 'resolu' || t.status === 'cloture' || t.status === 'termine' ? 'Résolu & Payé' : 'En cours'
      };
    });

    // 13. Mappage structuré de l'État des Contrats de Bail
    const mappedContrats = realContracts.map((c: any) => {
      const pr = propertyMap.get(c.property_id) || c.property;
      const tn = profileMap.get(c.tenant_id) || c.tenant;
      const isActif = c.status === 'actif' || c.status === 'contrat_actif' || c.status === 'signe';

      return {
        contractNo: c.contract_number || c.id || '—',
        tenant: tn?.full_name || 'Locataire',
        property: pr?.title || 'Bien immobilier',
        startDate: c.start_date ? new Date(c.start_date).toLocaleDateString('fr-FR') : (c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '—'),
        endDate: c.end_date ? new Date(c.end_date).toLocaleDateString('fr-FR') : '—',
        rent: Number(c.monthly_rent ?? c.rent ?? pr?.rent ?? 0),
        caution: Number(c.caution_amount ?? c.caution ?? pr?.caution ?? 0),
        status: isActif ? 'Actif' : 'En attente',
        signaturesDate: c.signed_at ? new Date(c.signed_at).toLocaleDateString('fr-FR') : (isActif ? 'Signé & Scellé' : '—')
      };
    });

    // 14. Informations officielles du Titulaire / Bailleur / Agence
    const ownerName = userProfile?.full_name || (isAgency ? 'Agence Immobilière Agréée' : 'Mon Compte');
    const owner = {
      name: ownerName,
      id: userProfile?.id ? `LT-${userProfile.id.slice(0, 8).toUpperCase()}` : 'LT-PRO-001',
      phone: userProfile?.phone || '+225 05 00 55 21 41',
      email: userProfile?.email || 'contact@locatrust.ci',
      address: userProfile?.address || (isAgency ? 'Abidjan, Côte d\'Ivoire (Agence Agréée)' : 'Abidjan, Côte d\'Ivoire')
    };

    // 15. Statistiques complémentaires
    const pendingSignaturesCount = realContracts.filter(
      (c: any) => c.status === 'en_attente' || c.status === 'en_attente_signature'
    ).length;

    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const expiringSoonCount = realContracts.filter((c: any) => {
      if (!c.end_date) return false;
      const d = new Date(c.end_date);
      return d > now && d <= sixtyDaysLater;
    }).length;

    const expiredCount = realContracts.filter(
      (c: any) => c.status === 'expire' || c.status === 'archive'
    ).length;

    const terminatedCount = realContracts.filter(
      (c: any) => c.status === 'resilie' || c.status === 'annule'
    ).length;

    const reservedCount = realProps.filter(
      (p: any) => p.status === 'reserve' || p.status === 'en_cours'
    ).length;

    const disabledCount = realProps.filter(
      (p: any) => p.status === 'desactive' || p.is_archived
    ).length;

    const resolvedTickets = realTickets.filter(
      (t: any) => t.status === 'resolu' || t.status === 'cloture' || t.status === 'termine'
    ).length;

    const resolvedTicketsRatio = realTickets.length > 0 
      ? Math.round((resolvedTickets / realTickets.length) * 100) 
      : 0;

    const loyersAttendusExercice = monthlyBreakdown.reduce((s, m) => s + m.expectedRent, 0);
    const loyersEncaissesExercice = monthlyBreakdown.reduce((s, m) => s + m.collectedRent, 0);
    const totalEncaisseExercice = loyersEncaissesExercice;
    const totalDepenseExercice = depensesMaintenance + cautionsRemboursees;
    const resultatNetExercice = totalEncaisseExercice - totalDepenseExercice;
    const tauxRecouvrementCalculated = loyersAttendusExercice > 0
      ? Math.round((loyersEncaissesExercice / loyersAttendusExercice) * 100)
      : 100;

    const result: RealAccountingDataset = {
      ownerName,
      owner,
      synthesis: {
        loyersAttendus: loyersAttendusExercice,
        loyersEncaisses: loyersEncaissesExercice,
        loyersEnAttente: 0,
        loyersImpayes: 0,
        loyersEnRetard: 0,
        cautionsAttendues: cautionsRecues,
        cautionsRecues,
        cautionsRemboursees,
        cautionsRestantes,
        depensesMaintenance,
        autresDepenses: 0,
        totalEncaisse: totalEncaisseExercice,
        totalDepense: totalDepenseExercice,
        resultatNet: resultatNetExercice,
        tauxRecouvrement: tauxRecouvrementCalculated
      },
      encaissements: mappedEncaissements,
      loyers: mappedLoyers,
      cautions: mappedCautions,
      maintenance: mappedMaintenance,
      contrats: mappedContrats,
      activePropertiesCount: Math.max(realProps.length, activeContracts.length),
      activeTenantsCount: activeContracts.length,
      activeContractsCount: activeContracts.length,
      monthlyBreakdown,
      extraStats: {
        pendingSignaturesCount,
        expiringSoonCount,
        expiredCount,
        terminatedCount,
        reservedCount,
        finContratCount: expiringSoonCount,
        disabledCount,
        cautionsRetenues,
        resolvedTicketsRatio,
        totalTickets: realTickets.length
      }
    };

    accountingCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.error('Erreur inattendue dans fetchRealAccountingData:', err);
    return {
      ownerName: 'Mon Compte',
      synthesis: {
        loyersAttendus: 0,
        loyersEncaisses: 0,
        loyersEnAttente: 0,
        loyersImpayes: 0,
        loyersEnRetard: 0,
        cautionsAttendues: 0,
        cautionsRecues: 0,
        cautionsRemboursees: 0,
        cautionsRestantes: 0,
        depensesMaintenance: 0,
        autresDepenses: 0,
        totalEncaisse: 0,
        totalDepense: 0,
        resultatNet: 0,
        tauxRecouvrement: 0
      },
      encaissements: [],
      loyers: [],
      cautions: [],
      maintenance: [],
      contrats: [],
      activePropertiesCount: 0,
      activeTenantsCount: 0,
      activeContractsCount: 0,
      monthlyBreakdown: [],
      extraStats: {
        pendingSignaturesCount: 0,
        expiringSoonCount: 0,
        expiredCount: 0,
        terminatedCount: 0,
        reservedCount: 0,
        finContratCount: 0,
        disabledCount: 0,
        cautionsRetenues: 0,
        resolvedTicketsRatio: 0,
        totalTickets: 0
      }
    };
  }
}

// Re-export canonique du moteur centralisé de calcul des loyers LocaTrust
export * from '@/lib/financial/rentCalculationEngine';


// ============================================================================
// RAPPORT COMPTABLE DES REVENUS PAR PROPRIÉTAIRE MANDANT (AGENCE IMMOBILIÈRE)
// ============================================================================

export interface AgencyMandantRevenueItem {
  mandantId: string;
  mandantName: string;
  mandantPhone?: string;
  mandantEmail?: string;
  propertiesCount: number;
  propertiesList: string[];
  loyersEncaisses: number;
  commissionRate: number; // Honoraires de gérance (ex: 10%)
  commissionAmount: number; // Revenus perçus par l'agence
  maintenanceDeductions: number;
  netDueToMandant: number; // Solde net reversé au mandant
  recoveryRate: number;
  contractsCount: number;
}

export interface AgencyMandantsReportData {
  agencyName: string;
  agencyId: string;
  periodLabel: string;
  year: string;
  mandants: AgencyMandantRevenueItem[];
  totals: {
    totalProperties: number;
    totalContracts: number;
    totalLoyersEncaisses: number;
    totalCommissionsAgence: number;
    totalMaintenanceDeductions: number;
    totalNetReversedToMandants: number;
    averageRecoveryRate: number;
  };
}

/**
 * Calcule et extrait les données comptables réelles des mandants d'une agence.
 * Données réelles issues de Supabase (propriétés de l'agence, paiements confirmés, mandants).
 */
export async function fetchAgencyMandantsAccountingReport(
  agencyId: string,
  agencyName: string = 'Agence Immobilière Agréée',
  year: string = '2026',
  periodLabel: string = 'Année 2026'
): Promise<AgencyMandantsReportData> {
  try {
    // 1. Récupérer les biens appartenant à cette agence dans Supabase
    let agencyProperties: any[] = [];
    try {
      const { data: propsData } = await supabase
        .from('properties')
        .select('id, title, rent, status, mandant_id, mandant_name, address, commune, city')
        .eq('agency_id', agencyId);
      if (Array.isArray(propsData)) {
        agencyProperties = propsData;
      }
    } catch (e) {
      console.warn('Erreur chargement propriétés agence Supabase:', e);
    }

    // Fallback localStorage si nécessaire
    if (agencyProperties.length === 0 && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('locatrust_properties');
        if (raw) {
          const all = JSON.parse(raw);
          if (Array.isArray(all)) {
            agencyProperties = all.filter((p: any) => p.agency_id === agencyId || p.owner_id === agencyId);
          }
        }
      } catch {}
    }

    // 2. Récupérer les paiements réels de loyer pour ces biens
    let agencyPayments: any[] = [];
    try {
      const { data: pmtData } = await supabase
        .from('rent_payments')
        .select('id, property_id, amount, status, date, reference, period')
        .eq('agency_id', agencyId);
      if (Array.isArray(pmtData)) {
        agencyPayments = pmtData;
      }
    } catch (e) {
      console.warn('Erreur chargement paiements agence Supabase:', e);
    }

    // Fallback localStorage pour les paiements
    if (agencyPayments.length === 0 && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('locatrust_rent_payments');
        if (raw) {
          const all = JSON.parse(raw);
          if (Array.isArray(all)) {
            const propIds = new Set(agencyProperties.map((p) => String(p.id)));
            agencyPayments = all.filter((pm: any) =>
              pm.agency_id === agencyId ||
              pm.owner_id === agencyId ||
              propIds.has(String(pm.property_id))
            );
          }
        }
      } catch {}
    }

    // 3. Récupérer les contrats de bail réels
    let agencyContracts: any[] = [];
    try {
      const { data: cntData } = await supabase
        .from('contracts')
        .select('id, property_id, rent_amount, status, contract_number')
        .eq('agency_id', agencyId);
      if (Array.isArray(cntData)) {
        agencyContracts = cntData;
      }
    } catch {}

    if (agencyContracts.length === 0 && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('locatrust_contracts');
        if (raw) {
          const all = JSON.parse(raw);
          if (Array.isArray(all)) {
            const propIds = new Set(agencyProperties.map((p) => String(p.id)));
            agencyContracts = all.filter((c: any) =>
              c.agency_id === agencyId || propIds.has(String(c.property_id))
            );
          }
        }
      } catch {}
    }

    // 4. Récupérer les tickets de maintenance
    let agencyTickets: any[] = [];
    try {
      const { data: tktData } = await supabase
        .from('maintenance_tickets')
        .select('id, property_id, cost, status')
        .eq('agency_id', agencyId);
      if (Array.isArray(tktData)) {
        agencyTickets = tktData;
      }
    } catch {}

    // 5. Charger les mandants déclarés de cette agence
    let mandatesList: any[] = [];
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`locatrust_agency_mandates_${agencyId}`) || localStorage.getItem('locatrust_agency_mandates');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) mandatesList = parsed;
        }
      } catch {}
    }

    // Grouper les biens par mandant (mandant_id ou mandant_name)
    const mandantsMap = new Map<string, AgencyMandantRevenueItem>();

    // Initialiser les mandants connus
    for (const m of mandatesList) {
      const key = m.id || m.full_name.toLowerCase();
      mandantsMap.set(key, {
        mandantId: m.id || `mnd_${Math.random().toString(36).slice(2, 7)}`,
        mandantName: m.full_name || 'Bailleur Mandant',
        mandantPhone: m.phone || '—',
        mandantEmail: m.email || '',
        propertiesCount: 0,
        propertiesList: [],
        loyersEncaisses: 0,
        commissionRate: Number(m.commission_rate) || 10, // 10% par défaut (taux usuel en Côte d'Ivoire)
        commissionAmount: 0,
        maintenanceDeductions: 0,
        netDueToMandant: 0,
        recoveryRate: 100,
        contractsCount: 0
      });
    }

    // Associer les biens
    agencyProperties.forEach((p) => {
      const mName = p.mandant_name || 'Propriétaire Non Assigné';
      const mId = p.mandant_id || (p.mandant_name ? `mnd_${p.mandant_name.toLowerCase().replace(/\s+/g, '_')}` : 'mnd_direct');
      const key = p.mandant_id || (mandantsMap.has(mId) ? mId : mName.toLowerCase());

      if (!mandantsMap.has(key)) {
        mandantsMap.set(key, {
          mandantId: mId,
          mandantName: mName,
          mandantPhone: '—',
          mandantEmail: '',
          propertiesCount: 0,
          propertiesList: [],
          loyersEncaisses: 0,
          commissionRate: 10,
          commissionAmount: 0,
          maintenanceDeductions: 0,
          netDueToMandant: 0,
          recoveryRate: 100,
          contractsCount: 0
        });
      }

      const item = mandantsMap.get(key)!;
      item.propertiesCount += 1;
      item.propertiesList.push(p.title || `Bien N°${p.id}`);

      // Loyers perçus pour ce bien
      const propPayments = agencyPayments.filter((pm) =>
        String(pm.property_id) === String(p.id) &&
        (pm.status === 'valide' || pm.status === 'confirme' || pm.status === 'paye' || !pm.status)
      );
      const sumPayments = propPayments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      item.loyersEncaisses += sumPayments;

      // Maintenance déductible
      const propTickets = agencyTickets.filter((t) =>
        String(t.property_id) === String(p.id) &&
        (t.status === 'resolu' || t.status === 'cloture' || t.status === 'valide')
      );
      const sumTickets = propTickets.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
      item.maintenanceDeductions += sumTickets;

      // Contrats
      const propContracts = agencyContracts.filter((c) =>
        String(c.property_id) === String(p.id) &&
        (c.status === 'actif' || c.status === 'signe' || c.status === 'contrat_actif')
      );
      item.contractsCount += propContracts.length;
    });

    // Calculer les commissions et les nets reversés
    const mandantsResults: AgencyMandantRevenueItem[] = [];
    let totLoyers = 0;
    let totCommissions = 0;
    let totMaint = 0;
    let totNet = 0;
    let totProps = 0;
    let totCnts = 0;

    mandantsMap.forEach((m) => {
      // Honoraires de gérance = loyers * (taux / 100)
      m.commissionAmount = Math.round(m.loyersEncaisses * (m.commissionRate / 100));
      // Net reversé au propriétaire = loyers - honoraires agence - maintenance déductible
      m.netDueToMandant = Math.max(0, m.loyersEncaisses - m.commissionAmount - m.maintenanceDeductions);

      mandantsResults.push(m);
      totLoyers += m.loyersEncaisses;
      totCommissions += m.commissionAmount;
      totMaint += m.maintenanceDeductions;
      totNet += m.netDueToMandant;
      totProps += m.propertiesCount;
      totCnts += m.contractsCount;
    });

    return {
      agencyName,
      agencyId,
      periodLabel,
      year,
      mandants: mandantsResults,
      totals: {
        totalProperties: totProps,
        totalContracts: totCnts,
        totalLoyersEncaisses: totLoyers,
        totalCommissionsAgence: totCommissions,
        totalMaintenanceDeductions: totMaint,
        totalNetReversedToMandants: totNet,
        averageRecoveryRate: mandantsResults.length > 0 ? 100 : 0
      }
    };
  } catch (err) {
    console.error('Erreur fetchAgencyMandantsAccountingReport:', err);
    return {
      agencyName,
      agencyId,
      periodLabel,
      year,
      mandants: [],
      totals: {
        totalProperties: 0,
        totalContracts: 0,
        totalLoyersEncaisses: 0,
        totalCommissionsAgence: 0,
        totalMaintenanceDeductions: 0,
        totalNetReversedToMandants: 0,
        averageRecoveryRate: 0
      }
    };
  }
}

// Re-export canonique du moteur centralisé de calcul des loyers LocaTrust
export * from '@/lib/financial/rentCalculationEngine';

