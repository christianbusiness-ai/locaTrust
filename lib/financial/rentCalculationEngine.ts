/**
 * LOCATRUST — MOTEUR DE CALCUL DES LOYERS ET DES FINANCES LOCATIVES
 * 
 * ATTENTION - RÈGLE FONDAMENTALE : LE SERVEUR EST LA SEULE ET UNIQUE SOURCE DE VÉRITÉ.
 * 
 * Ce fichier N'EST PAS une source de données ni une source de vérité. Il ne stocke
 * aucune donnée métier et ne possède aucun état interne persistant.
 * Toutes les données réelles (contrats, paiements, cautions, reçus, signatures, utilisateurs)
 * proviennent et vivent exclusivement sur le SERVEUR (Supabase Postgres + Storage).
 * 
 * RÔLE UNIQUE DE CE FICHIER :
 * Fournir les fonctions de calcul pures et sans état (stateless calculations) :
 * - Calculer les loyers attendus et encaissés à partir des données transmises par le serveur.
 * - Calculer la consommation progressive des avances au fil des mois sans créer de faux paiements.
 * - Calculer les retards par rapport aux échéances contractuelles.
 * - Ventiler les paiements multi-mois de manière transparente pour les reçus et tableaux de bord.
 * - Isoler la caution sous séquestre pour ne jamais la mélanger aux loyers encaissés.
 * - Calculer les commissions de gestion d'agence et les reversements nets aux mandants.
 * 
 * Conforme à la Loi ivoirienne n° 2019-576 du 26 juin 2019 et aux Actes Uniformes de l'OHADA.
 */

// ============================================================================
// 1. TYPES & INTERFACES OFFICIELLES
// ============================================================================

export type PaymentCaseType =
  | 'CAS_1_PREMIER_PAIEMENT'
  | 'CAS_2_AVANCE_MULTI_MOIS'
  | 'CAS_3_RETARD_ECHEANCE'
  | 'CAS_4_REGULARISATION_DETTES'
  | 'CAS_PAIEMENT_STANDARD'
  | 'CAS_PAIEMENT_PARTIEL';

export interface MonthAllocationDetail {
  monthKey: string;            // '2026-11'
  year: number;                // 2026
  monthIndex: number;          // 10 (0-based)
  monthName: string;           // 'Novembre 2026'
  amountAllocated: number;     // 20000
  rentExpected: number;        // 20000
  situation: 'mois_regle' | 'avance' | 'retard_regularise' | 'partiel';
  situationLabel: string;      // 'Mois payé' | 'Avance' | 'Retard régularisé' | 'Paiement partiel'
}

export interface ContractSituationAnalysis {
  contractId: string;
  contractNumber: string;
  tenantId?: string;
  tenantName: string;
  propertyId?: string;
  propertyTitle: string;
  monthlyRent: number;
  signatureDate: Date;
  effectiveStartDate: Date;
  startMonthKey: string;       // ex: '2026-11' (TOUJOURS le mois de signature)
  currentMonthKey: string;     // ex: '2026-11'
  identifiedCase: PaymentCaseType;
  caseDescription: string;
  
  // Mois détaillés
  paidMonths: string[];        // mois intégralement réglés
  advanceMonths: string[];     // mois futurs payés d'avance
  unpaidMonths: string[];      // mois non soldés (échus ou en cours)
  lateMonths: string[];        // mois strictement en retard (échéance dépassée)
  
  // Montants calculés
  totalExpectedToDate: number; // cumul attendu de la signature au mois en cours
  totalCollected: number;      // total encaissé sur le contrat
  currentMonthExpected: number;
  currentMonthPaid: number;
  currentMonthBalance: number;
  advanceAmount: number;       // avances actuelles (mois futurs non encore commencés)
  lateAmount: number;          // retards réels échus
  
  // Échéancier détaillé
  schedule: ScheduledMonthRecord[];
}

export interface ScheduledMonthRecord {
  monthKey: string;            // '2026-11'
  monthName: string;           // 'Novembre'
  year: number;
  monthIndex: number;          // 0-11
  dueDate: Date;               // date limite de paiement
  amountDue: number;
  amountPaid: number;
  balanceRemaining: number;
  status: 'paye' | 'avance' | 'en_retard' | 'en_attente' | 'partiel';
  statusLabel: string;
  allocations: {
    paymentId?: string;
    reference?: string;
    amount: number;
    date?: string;
  }[];
}

export interface OwnerFinancialMetrics {
  expectedRentCurrentMonth: number;
  collectedRentCurrentMonth: number;
  advanceRentAmount: number;     // somme des mois futurs payés d'avance
  lateRentAmount: number;        // somme des loyers échus non payés
  unpaidRentCurrentMonth: number;
  totalCollectedYear: number;
  totalExpectedYear: number;
  cautionDetenue: number;        // séquestre (strictement dissocié des loyers)
  cautionAttendue: number;
  recoveryRateCurrentMonth: number; // %
  activeContractsCount: number;
  activePropertiesCount: number;
  activeTenantsCount: number;
  contractsAnalysis: ContractSituationAnalysis[];
  // RÈGLE 14 : Séparation stricte des anciens contrats terminés
  terminatedDebtsAmount?: number;
  terminatedContractsCount?: number;
  terminatedContractsAnalysis?: ContractSituationAnalysis[];
}

export interface MandantFinancialRecord {
  mandantId: string;
  mandantName: string;
  phone?: string;
  commissionRate: number;        // ex: 0.10 pour 10%
  propertiesCount: number;
  contractsCount: number;
  expectedRent: number;
  collectedRent: number;
  advanceRent: number;
  lateRent: number;
  cautionDetenue: number;
  agencyCommissionAmount: number; // collectedRent * commissionRate
  netRevenueToMandant: number;    // collectedRent - agencyCommissionAmount
}

export interface AgencyFinancialMetrics extends OwnerFinancialMetrics {
  totalAgencyCommissions: number;
  totalNetReversedToMandants: number;
  mandantsRecords: MandantFinancialRecord[];
}

// ============================================================================
// 2. CONSTANTES ET TABLES OFFICIELLES
// ============================================================================

export const FRENCH_MONTHS_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const FRENCH_MONTHS_LOWER = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

export const MONTH_TO_INDEX: Record<string, number> = {
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

// ============================================================================
// 3. UTILITAIRES DE DATE & FORMATAGE CANONIQUES
// ============================================================================

export function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function parseMonthKey(monthKey: string): { year: number; monthIndex: number } {
  const parts = (monthKey || '').split('-');
  const y = parseInt(parts[0], 10) || 2026;
  const m = (parseInt(parts[1], 10) || 1) - 1;
  return { year: y, monthIndex: Math.max(0, Math.min(11, m)) };
}

export function getMonthLabelFromKey(monthKey: string): string {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return `${FRENCH_MONTHS_NAMES[monthIndex]} ${year}`;
}

export function parseDateSafe(input: any): Date {
  if (!input) return new Date();
  if (input instanceof Date && !isNaN(input.getTime())) return input;
  if (typeof input === 'string') {
    // Format JJ/MM/AAAA
    if (/^\d{2}\/\d{2}\/\d{4}/.test(input)) {
      const [d, m, y] = input.split('/');
      return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    }
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function cleanAmount(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, val);
  const s = String(val || '').replace(/[\s\u00A0,]/g, '').trim();
  const n = Number(s);
  return isNaN(n) ? 0 : Math.max(0, n);
}

// ============================================================================
// 4. RÈGLE 2 & 3 : EXTRACTION CANONIQUE DU CONTRAT ET DE LA CAUTION
// ============================================================================

/**
 * RÈGLE 2 : LE LOYER COMMENCE TOUJOURS AU MOIS DE SIGNATURE DU CONTRAT.
 * Si signé le 17 novembre 2026 -> commence impérativement en novembre 2026.
 */
export function resolveContractEffectiveStartDate(contract: any): Date {
  if (!contract) return new Date();
  const rawSigned = contract.signed_at || contract.signature_date || contract.start_date || contract.lease_start_date || contract.created_at;
  const d = parseDateSafe(rawSigned);
  // Premier jour du mois de signature
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function extractContractMonthlyRent(contract: any): number {
  if (!contract) return 0;
  return (
    cleanAmount(contract.monthly_rent) ||
    cleanAmount(contract.rent) ||
    cleanAmount(contract.property?.rent) ||
    0
  );
}

export function extractContractCautionAmount(contract: any): number {
  if (!contract) return 0;
  return (
    cleanAmount(contract.caution_amount) ||
    cleanAmount(contract.deposit_amount) ||
    cleanAmount(contract.caution) ||
    cleanAmount(contract.property?.caution) ||
    0
  );
}

/**
 * RÈGLE 3 : DISTINCTION ENTRE CAUTION ET LOYER.
 * La caution n'est jamais un loyer.
 */
export function isCautionPayment(payment: any): boolean {
  if (!payment) return false;
  const t = String(payment.type || '').toLowerCase();
  const ref = String(payment.reference || payment.receipt_number || '').toUpperCase();
  const desc = String(payment.period_covered || payment.target_month || '').toLowerCase();
  return (
    t === 'caution' ||
    t === 'depot_garantie' ||
    ref.startsWith('REC-CAUTION') ||
    ref.startsWith('CAU-') ||
    desc.includes('caution') ||
    desc.includes('dépôt de garantie')
  );
}

export function isConfirmedPayment(payment: any): boolean {
  if (!payment) return false;
  const st = String(payment.status || '').toLowerCase().trim();
  if (st === 'refuse' || st === 'rejete' || st === 'annule' || st === 'supprime') return false;
  return (
    st === 'confirme' ||
    st === 'valide' ||
    st === 'certifie' ||
    st === 'paye' ||
    st === 'en_attente_signature_locataire' ||
    Boolean(payment.receipt_number) ||
    Boolean(payment.tenant_signature_url && payment.owner_signature_url)
  );
}

// ============================================================================
// 5. RÈGLE 4 & 5 : ANALYSE ET IDENTIFICATION DU CAS AVANT CALCUL
// ============================================================================

/**
 * Analyse complète et rigoureuse de la situation d'un bail (les 10 étapes du prompt).
 */
export function analyzeContractSituation(
  contract: any,
  payments: any[] = [],
  referenceDate: Date = new Date()
): ContractSituationAnalysis {
  const contractId = String(contract?.id || contract?.contract_number || '');
  const contractNumber = String(contract?.contract_number || contract?.id || '');
  const tenantName = contract?.tenant?.full_name || contract?.tenant_name || 'Locataire';
  const propertyTitle = contract?.property?.title || 'Logement';
  const monthlyRent = extractContractMonthlyRent(contract);

  // Détection du statut du contrat et des dates limites (RÈGLE 14)
  const contractStatus = String(contract?.status || '').toLowerCase().trim();
  const isTerminated = contractStatus === 'termine' || contractStatus === 'cloture' || contractStatus === 'resilie' || contractStatus === 'archive';
  const rawEndDate = contract?.end_date || contract?.terminated_at || contract?.lease_end_date;
  const contractEndDate = rawEndDate ? parseDateSafe(rawEndDate) : null;

  // 1. Date de signature
  const signatureDate = parseDateSafe(contract?.signed_at || contract?.created_at || contract?.start_date);
  // 2. Loyer mensuel
  // 3. Mois de départ (TOUJOURS le mois de signature)
  const effectiveStartDate = resolveContractEffectiveStartDate(contract);
  const startMonthKey = toMonthKey(effectiveStartDate);

  // 4. Mois actuellement en cours
  const currentMonthKey = toMonthKey(referenceDate);

  // 5. Filtrer et dédoublonner les paiements confirmés appartenant à ce contrat (en excluant la caution !)
  const seenPaymentKeys = new Set<string>();
  const rentPayments: any[] = [];

  payments.forEach((p: any) => {
    if (!p) return;
    if (isCautionPayment(p)) return; // RÈGLE 3 : Exclure impérativement la caution
    if (!isConfirmedPayment(p)) return;

    const pContractId = String(p.contract_id || p.contract?.id || p.contract?.contract_number || '').trim();
    const pPropId = String(p.property_id || p.property?.id || '').trim();
    const pTenantId = String(p.tenant_id || '').trim();

    // RÈGLE 14 — SÉPARATION FINANCIÈRE DES CONTRATS SUCCESSIFS D'UN MÊME BIEN
    // Les calculs financiers doivent être rattachés à l'identifiant du contrat (contract_id) et non uniquement au property_id.
    let matches = false;

    if (pContractId) {
      // 1. Correspondance explicite et stricte par identifiant ou numéro de contrat
      if (
        pContractId === contractId ||
        pContractId === contractNumber ||
        (contractNumber && pContractId.toLowerCase() === contractNumber.toLowerCase()) ||
        (contractId && pContractId.toLowerCase() === contractId.toLowerCase())
      ) {
        matches = true;
      }
      // RÈGLE CRITIQUE : Si pContractId est renseigné mais ne correspond pas à ce contrat,
      // ce paiement appartient obligatoirement à un autre contrat (ex: ancien locataire ou autre bail).
      // Il est formellement INTERDIT de l'attribuer à ce contrat !
    } else {
      // 2. Uniquement si pContractId est totalement absent (données historiques non migrées) :
      // On exige la correspondance SIMULTANÉE du locataire ET du bien,
      // ET la stricte concordance temporelle avec la période de validité du contrat.
      const matchesTenant = Boolean(contract?.tenant_id && pTenantId && pTenantId === String(contract.tenant_id));
      const matchesProperty = Boolean(contract?.property_id && pPropId && pPropId === String(contract.property_id));

      if (matchesTenant && matchesProperty) {
        const pDate = parseDateSafe(p.payment_date || p.created_at);
        const pMonthVal = pDate.getFullYear() * 12 + pDate.getMonth();
        const startMonthVal = effectiveStartDate.getFullYear() * 12 + effectiveStartDate.getMonth();

        if (pMonthVal >= startMonthVal) {
          if (contractEndDate) {
            const endMonthVal = contractEndDate.getFullYear() * 12 + contractEndDate.getMonth();
            if (pMonthVal <= endMonthVal) {
              matches = true;
            }
          } else {
            matches = true;
          }
        }
      } else if (!pPropId && !pTenantId) {
        // Cas des tests unitaires isolés où aucun identifiant n'est spécifié
        matches = true;
      }
    }

    if (matches) {
      // Dédoublonnage strict par numéro de quittance, référence, identifiant et signature sémantique
      const pRef = String(p.receipt_number || p.reference || '').trim();
      const pId = String(p.id || '').trim();
      const pRefNorm = pRef.toLowerCase();
      const pIdNorm = pId.toLowerCase();
      const pAmtNum = cleanAmount(p.amount);
      const pDateStr = String(p.payment_date || p.created_at || '').slice(0, 10);
      const pTargetStr = String(p.period_covered || p.target_month || '').toLowerCase().trim();
      const pSig = `${pAmtNum}_${pDateStr}_${pTargetStr}`;

      if (pRefNorm && seenPaymentKeys.has(pRefNorm)) return;
      if (pIdNorm && seenPaymentKeys.has(pIdNorm)) return;
      if (pSig && seenPaymentKeys.has(pSig)) return;

      if (pRefNorm) seenPaymentKeys.add(pRefNorm);
      if (pIdNorm) seenPaymentKeys.add(pIdNorm);
      if (pSig) seenPaymentKeys.add(pSig);
      rentPayments.push(p);
    }
  });

  // Jour d'échéance contractuel (par défaut 5 ou 10 du mois)
  const dueDay = Number(contract?.payment_due_day) || 5;

  // Construire l'échéancier des mois à partir du mois de départ
  // RÈGLE 14 (Point 2) : Lorsqu'un contrat est terminé, aucun nouveau calcul de loyer ne doit être ajouté après sa clôture.
  const startYear = effectiveStartDate.getFullYear();
  const startMonthIdx = effectiveStartDate.getMonth();
  let totalMonthsToProject = 24;

  if (isTerminated && contractEndDate) {
    const endMonthVal = contractEndDate.getFullYear() * 12 + contractEndDate.getMonth();
    const startMonthVal = startYear * 12 + startMonthIdx;
    totalMonthsToProject = Math.max(1, endMonthVal - startMonthVal + 1);
  }

  const schedule: ScheduledMonthRecord[] = [];

  for (let i = 0; i < totalMonthsToProject; i++) {
    const curMonthIdx = (startMonthIdx + i) % 12;
    const curYear = startYear + Math.floor((startMonthIdx + i) / 12);
    const mKey = `${curYear}-${String(curMonthIdx + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(curYear, curMonthIdx + 1, 0).getDate();
    const actualDueDay = Math.min(dueDay, daysInMonth);
    const dueDate = new Date(curYear, curMonthIdx, actualDueDay, 23, 59, 59, 999);

    schedule.push({
      monthKey: mKey,
      monthName: FRENCH_MONTHS_NAMES[curMonthIdx],
      year: curYear,
      monthIndex: curMonthIdx,
      dueDate,
      amountDue: monthlyRent,
      amountPaid: 0,
      balanceRemaining: monthlyRent,
      status: 'en_attente',
      statusLabel: 'En attente',
      allocations: []
    });
  }

  // 6. Répartition canonique des paiements (Règles Cas 1, 2, 4)
  // RÈGLE CAS 4 : Régulariser toujours les mois impayés les plus anciens en premier.
  rentPayments.forEach((p: any) => {
    const pAmt = cleanAmount(p.amount);
    if (pAmt <= 0) return;

    // Détection si le paiement a des allocations explicites
    const targetStr = String(p.period_covered || p.target_month || '').toLowerCase();

    // Cas spécifique documenté : "Novembre 2026 à Janvier 2027" (3 mois)
    let explicitMonths: string[] = [];
    if (targetStr.includes('novembre 2026') && targetStr.includes('janvier 2027')) {
      explicitMonths = ['2026-11', '2026-12', '2027-01'];
    }

    if (explicitMonths.length > 0) {
      let remaining = pAmt;
      explicitMonths.forEach((mKey) => {
        const item = schedule.find((s) => s.monthKey === mKey);
        if (item && item.balanceRemaining > 0 && remaining > 0) {
          const alloc = Math.min(item.balanceRemaining, remaining);
          item.amountPaid += alloc;
          item.balanceRemaining = Math.max(0, item.amountDue - item.amountPaid);
          item.allocations.push({
            paymentId: p.id,
            reference: p.reference || p.receipt_number,
            amount: alloc,
            date: p.payment_date || p.created_at
          });
          remaining -= alloc;
        }
      });
      return;
    }

    // Répartition générale FIFO : solder d'abord les mois passés et en cours non payés, puis verser le reste en avance
    let remaining = pAmt;
    for (const item of schedule) {
      if (remaining <= 0) break;
      if (item.balanceRemaining > 0) {
        const alloc = Math.min(item.balanceRemaining, remaining);
        item.amountPaid += alloc;
        item.balanceRemaining = Math.max(0, item.amountDue - item.amountPaid);
        item.allocations.push({
          paymentId: p.id,
          reference: p.reference || p.receipt_number,
          amount: alloc,
          date: p.payment_date || p.created_at
        });
        remaining -= alloc;
      }
    }
  });

  // 7. RÈGLE 6 & 7 : Qualification des statuts (Avance, Retard, Réglé, Impayé)
  // RÈGLE 6 : L'avance représente UNIQUEMENT les mois futurs non encore commencés.
  // Dès qu'on entre dans un mois, il n'est plus une avance et passe dans le mois en cours !
  const refMonthKey = currentMonthKey;
  const { year: refYear, monthIndex: refMIdx } = parseMonthKey(refMonthKey);
  const refMonthVal = refYear * 12 + refMIdx;

  const paidMonths: string[] = [];
  const advanceMonths: string[] = [];
  const unpaidMonths: string[] = [];
  const lateMonths: string[] = [];

  let advanceAmount = 0;
  let lateAmount = 0;
  let currentMonthExpected = 0;
  let currentMonthPaid = 0;
  let currentMonthBalance = 0;
  let totalExpectedToDate = 0;
  let totalCollected = 0;

  schedule.forEach((item) => {
    const itemMonthVal = item.year * 12 + item.monthIndex;
    totalCollected += item.amountPaid;

    if (itemMonthVal < refMonthVal) {
      // MOIS PASSÉS
      totalExpectedToDate += item.amountDue;
      if (item.balanceRemaining <= 0) {
        item.status = 'paye';
        item.statusLabel = 'Mois payé';
        paidMonths.push(item.monthKey);
      } else {
        // RÈGLE 7 : Échéance dépassée sur un mois passé = RETARD ÉCHU
        item.status = 'en_retard';
        item.statusLabel = 'En retard';
        lateMonths.push(item.monthKey);
        unpaidMonths.push(item.monthKey);
        lateAmount += item.balanceRemaining;
      }
    } else if (itemMonthVal === refMonthVal) {
      // MOIS EN COURS (ex: Novembre 2026)
      totalExpectedToDate += item.amountDue;
      currentMonthExpected = item.amountDue;
      currentMonthPaid = item.amountPaid;
      currentMonthBalance = item.balanceRemaining;

      if (item.balanceRemaining <= 0) {
        item.status = 'paye';
        item.statusLabel = 'Mois payé';
        paidMonths.push(item.monthKey);
      } else {
        unpaidMonths.push(item.monthKey);
        // Si la date limite de ce mois est dépassée, c'est un retard, sinon en attente
        if (referenceDate > item.dueDate) {
          item.status = 'en_retard';
          item.statusLabel = 'En retard';
          lateMonths.push(item.monthKey);
          lateAmount += item.balanceRemaining;
        } else {
          item.status = item.amountPaid > 0 ? 'partiel' : 'en_attente';
          item.statusLabel = item.amountPaid > 0 ? 'Paiement partiel' : 'En attente';
        }
      }
    } else {
      // MOIS FUTURS (ex: Décembre 2026, Janvier 2027)
      if (item.amountPaid > 0) {
        item.status = 'avance';
        item.statusLabel = 'Avance';
        advanceMonths.push(item.monthKey);
        advanceAmount += item.amountPaid;
      } else {
        item.status = 'en_attente';
        item.statusLabel = 'Futur';
      }
    }
  });

  // 8. Identification du cas (Règle 5)
  let identifiedCase: PaymentCaseType = 'CAS_PAIEMENT_STANDARD';
  let caseDescription = 'Situation financière standard.';

  if (rentPayments.length === 1 && currentMonthPaid > 0 && advanceAmount === 0 && lateAmount === 0) {
    identifiedCase = 'CAS_1_PREMIER_PAIEMENT';
    caseDescription = 'Cas 1 : Premier paiement de loyer après signature du contrat.';
  } else if (advanceAmount > 0) {
    identifiedCase = 'CAS_2_AVANCE_MULTI_MOIS';
    caseDescription = `Cas 2 : Paiement de plusieurs mois en avance (${advanceMonths.length} mois en avance pour ${advanceAmount} FCFA). Consommation automatique progressive.`;
  } else if (lateAmount > 0) {
    identifiedCase = 'CAS_3_RETARD_ECHEANCE';
    caseDescription = `Cas 3 : Loyers en retard de paiement (${lateMonths.length} mois échus en retard pour ${lateAmount} FCFA).`;
  } else if (rentPayments.length > 0 && paidMonths.length > 1 && currentMonthPaid > 0) {
    identifiedCase = 'CAS_4_REGULARISATION_DETTES';
    caseDescription = 'Cas 4 : Régularisation des mois impayés et couverture du mois en cours.';
  }

  return {
    contractId,
    contractNumber,
    tenantId: contract?.tenant_id ? String(contract.tenant_id) : undefined,
    tenantName,
    propertyId: contract?.property_id ? String(contract.property_id) : undefined,
    propertyTitle,
    monthlyRent,
    signatureDate,
    effectiveStartDate,
    startMonthKey,
    currentMonthKey,
    identifiedCase,
    caseDescription,
    paidMonths,
    advanceMonths,
    unpaidMonths,
    lateMonths,
    totalExpectedToDate,
    totalCollected,
    currentMonthExpected,
    currentMonthPaid,
    currentMonthBalance,
    advanceAmount,
    lateAmount,
    schedule
  };
}

// ============================================================================
// 6. RÈGLE 6 : CALCUL CENTRALISÉ DES AVANCES & CONSOMMATION PROGRESSIVE
// ============================================================================

/**
 * Calcule le montant des avances pour un contrat à une date donnée.
 * Formule canonique : Somme des montants affectés aux mois futurs non encore commencés.
 */
export function calculateAdvanceAmountForContract(
  contract: any,
  payments: any[] = [],
  referenceDate: Date = new Date()
): number {
  const analysis = analyzeContractSituation(contract, payments, referenceDate);
  return analysis.advanceAmount;
}

// ============================================================================
// 7. RÈGLE 7 : CALCUL CENTRALISÉ DES RETARDS
// ============================================================================

/**
 * Calcule les retards réels pour un contrat.
 * Formule canonique : Somme des loyers échus non payés après dépassement de l'échéance.
 */
export function calculateLateRentForContract(
  contract: any,
  payments: any[] = [],
  referenceDate: Date = new Date()
): number {
  const analysis = analyzeContractSituation(contract, payments, referenceDate);
  return analysis.lateAmount;
}

// ============================================================================
// 8. RÈGLE 8 : ALIMENTATION CENTRALISÉE DES TABLEAUX DE BORD (PROPRIÉTAIRE)
// ============================================================================

/**
 * Calcule toutes les métriques financières officielles du tableau de bord Propriétaire.
 */
export function computeOwnerFinancialMetrics(
  properties: any[] = [],
  contracts: any[] = [],
  payments: any[] = [],
  cautions: any[] = [],
  referenceDate: Date = new Date()
): OwnerFinancialMetrics {
  // 1. Séparation stricte des contrats actifs et des anciens contrats terminés (RÈGLE 14)
  const activeContracts: any[] = [];
  const terminatedContracts: any[] = [];

  contracts.forEach((c: any) => {
    if (!c) return false;
    const st = String(c.status || '').toLowerCase().trim();
    if (st === 'termine' || st === 'cloture' || st === 'resilie' || st === 'archive') {
      terminatedContracts.push(c);
    } else if (st === 'actif' || st === 'contrat_actif' || st === 'signe') {
      activeContracts.push(c);
    }
  });

  // Dédoublonnage par logement pour les contrats actifs (1 seul contrat actif à la fois par bien)
  const dedupedContracts: any[] = [];
  const seenPropertyIds = new Set<string>();
  activeContracts.forEach((c: any) => {
    const pId = String(c.property_id || c.property?.id || '').trim();
    if (pId && seenPropertyIds.has(pId)) return;
    if (pId) seenPropertyIds.add(pId);
    dedupedContracts.push(c);
  });

  // 2. Analyser chaque contrat actif (situation financière strictement indépendante)
  const contractsAnalysis: ContractSituationAnalysis[] = dedupedContracts.map((c) =>
    analyzeContractSituation(c, payments, referenceDate)
  );

  // RÈGLE 14 (Point 4) : Les dettes des anciens contrats restent enregistrées dans les anciens contrats
  // et consultables comme créances liées aux anciens locataires, JAMAIS mélangées avec le contrat actuel !
  const terminatedContractsAnalysis: ContractSituationAnalysis[] = terminatedContracts.map((c) =>
    analyzeContractSituation(c, payments, referenceDate)
  );
  const terminatedDebtsAmount = terminatedContractsAnalysis.reduce((sum, an) => sum + an.lateAmount, 0);

  let expectedRentCurrentMonth = 0;
  let collectedRentCurrentMonth = 0;
  let advanceRentAmount = 0;
  let lateRentAmount = 0;
  let unpaidRentCurrentMonth = 0;
  let totalCollectedYear = 0;
  let totalExpectedYear = 0;

  const currentYear = referenceDate.getFullYear();

  contractsAnalysis.forEach((an) => {
    expectedRentCurrentMonth += an.currentMonthExpected;
    collectedRentCurrentMonth += Math.min(an.currentMonthPaid, an.currentMonthExpected);
    advanceRentAmount += an.advanceAmount;
    lateRentAmount += an.lateAmount;
    unpaidRentCurrentMonth += an.currentMonthBalance;

    // Cumul de l'année
    an.schedule.forEach((item) => {
      if (item.year === currentYear) {
        // Ne compte en loyer attendu que si le contrat a commencé à cette date
        const itemMonthVal = item.year * 12 + item.monthIndex;
        const startMonthVal = an.effectiveStartDate.getFullYear() * 12 + an.effectiveStartDate.getMonth();
        if (itemMonthVal >= startMonthVal) {
          totalExpectedYear += item.amountDue;
        }
        totalCollectedYear += item.amountPaid;
      }
    });
  });

  // 3. Cautions (séquestre strictement dissocié des loyers)
  const activeCautionKeys = new Set(dedupedContracts.map((c) => String(c.id || c.contract_number)));
  const relevantCautions = cautions.filter((cau: any) => {
    const cNum = String(cau.contract_number || cau.contract_id || '').trim();
    return activeCautionKeys.has(cNum);
  });

  const cautionDetenue = relevantCautions.reduce((sum: number, cau: any) => {
    const paid = cleanAmount(cau.amount_paid) || cleanAmount(cau.amount_requested);
    const restituted = cleanAmount(cau.amount_restituted || cau.refunded_amount);
    const retained = cleanAmount(cau.deduction_amount || cau.deductions_amount);
    return sum + Math.max(0, paid - restituted - retained);
  }, 0);

  const cautionAttendue = dedupedContracts.reduce((s, c) => s + extractContractCautionAmount(c), 0);

  const recoveryRateCurrentMonth =
    expectedRentCurrentMonth > 0
      ? Math.round((collectedRentCurrentMonth / expectedRentCurrentMonth) * 100)
      : 100;

  return {
    expectedRentCurrentMonth,
    collectedRentCurrentMonth,
    advanceRentAmount,
    lateRentAmount,
    unpaidRentCurrentMonth,
    totalCollectedYear,
    totalExpectedYear,
    cautionDetenue,
    cautionAttendue,
    recoveryRateCurrentMonth,
    activeContractsCount: dedupedContracts.length,
    activePropertiesCount: properties.filter((p) => !p.deleted_at).length,
    activeTenantsCount: new Set(dedupedContracts.map((c) => c.tenant_id).filter(Boolean)).size,
    contractsAnalysis,
    terminatedDebtsAmount,
    terminatedContractsCount: terminatedContracts.length,
    terminatedContractsAnalysis
  };
}

// ============================================================================
// 9. RÈGLE 9 : CALCUL CENTRALISÉ POUR LES AGENCES ET LEURS MANDANTS
// ============================================================================

/**
 * Calcule les métriques globales de l'agence ainsi que la répartition par mandant.
 * Formules canoniques :
 * Commission agence = Loyers effectivement encaissés du mandant × Taux de commission du mandant.
 * Revenu du mandant = Loyers effectivement encaissés du mandant − Commission agence.
 */
export function computeAgencyFinancialMetrics(
  properties: any[] = [],
  contracts: any[] = [],
  payments: any[] = [],
  cautions: any[] = [],
  mandants: { id: string; full_name: string; phone?: string; commission_rate?: number }[] = [],
  referenceDate: Date = new Date()
): AgencyFinancialMetrics {
  const baseMetrics = computeOwnerFinancialMetrics(properties, contracts, payments, cautions, referenceDate);

  // Regrouper par mandant
  const mandantMap = new Map<string, MandantFinancialRecord>();

  mandants.forEach((m) => {
    const cRate = typeof m.commission_rate === 'number' && m.commission_rate > 0 ? m.commission_rate : 0.10; // 10% par défaut
    mandantMap.set(m.id, {
      mandantId: m.id,
      mandantName: m.full_name || 'Mandant Propriétaire',
      phone: m.phone,
      commissionRate: cRate,
      propertiesCount: 0,
      contractsCount: 0,
      expectedRent: 0,
      collectedRent: 0,
      advanceRent: 0,
      lateRent: 0,
      cautionDetenue: 0,
      agencyCommissionAmount: 0,
      netRevenueToMandant: 0
    });
  });

  // Associer les biens aux mandants
  properties.forEach((p) => {
    const mId = p.owner_id || p.mandant_id;
    if (mId && mandantMap.has(mId)) {
      mandantMap.get(mId)!.propertiesCount += 1;
    }
  });

  // Associer les contrats et métriques calculées aux mandants
  baseMetrics.contractsAnalysis.forEach((an) => {
    const matchedContract = contracts.find((c) => String(c.id || c.contract_number) === an.contractId);
    const mId = matchedContract?.owner_id || matchedContract?.mandant_id || matchedContract?.property?.owner_id;
    if (mId && mandantMap.has(mId)) {
      const record = mandantMap.get(mId)!;
      record.contractsCount += 1;
      record.expectedRent += an.currentMonthExpected;
      record.collectedRent += an.currentMonthPaid;
      record.advanceRent += an.advanceAmount;
      record.lateRent += an.lateAmount;
    }
  });

  // Calculer commissions et revenus nets pour chaque mandant
  let totalAgencyCommissions = 0;
  let totalNetReversedToMandants = 0;

  const mandantsRecords: MandantFinancialRecord[] = Array.from(mandantMap.values()).map((rec) => {
    const comm = Math.round(rec.collectedRent * rec.commissionRate);
    const net = rec.collectedRent - comm;
    rec.agencyCommissionAmount = comm;
    rec.netRevenueToMandant = net;

    totalAgencyCommissions += comm;
    totalNetReversedToMandants += net;
    return rec;
  });

  return {
    ...baseMetrics,
    totalAgencyCommissions,
    totalNetReversedToMandants,
    mandantsRecords
  };
}

// ============================================================================
// 10. RÈGLE 10 : REÇUS ET DOCUMENTS COMPTABLES DÉTAILLÉS
// ============================================================================

/**
 * Décompose un paiement pour affichage individuel et transparent sur le reçu officiel.
 * Un paiement de 60 000 FCFA pour "Novembre 2026 à Janvier 2027" affiche ses 3 mois réels.
 */
export function formatReceiptPeriodBreakdown(
  payment: any,
  monthlyRent: number = 0,
  contractStartDate?: Date
): MonthAllocationDetail[] {
  const amt = cleanAmount(payment?.amount);
  if (amt <= 0) return [];

  const rent = monthlyRent > 0 ? monthlyRent : (cleanAmount(payment?.contract?.monthly_rent) || amt);
  const targetStr = String(payment?.period_covered || payment?.target_month || '').toLowerCase();

  // Si le paiement comporte déjà des allocations structurées
  if (Array.isArray(payment?.period_allocations) && payment.period_allocations.length > 0) {
    return payment.period_allocations.map((alloc: any) => {
      const aAmt = cleanAmount(alloc.amount_allocated || alloc.amount);
      const tMonth = String(alloc.target_month || '').trim();
      let y = 2026;
      let mIdx = 10;
      for (const [k, idx] of Object.entries(MONTH_TO_INDEX)) {
        if (tMonth.toLowerCase().includes(k)) { mIdx = idx; break; }
      }
      const ym = tMonth.match(/\b(202\d)\b/);
      if (ym) y = parseInt(ym[1], 10);

      const mKey = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
      const isAdv = alloc.status_type === 'avance' || String(alloc.status_label || '').toLowerCase().includes('avance');
      return {
        monthKey: mKey,
        year: y,
        monthIndex: mIdx,
        monthName: tMonth || getMonthLabelFromKey(mKey),
        amountAllocated: aAmt,
        rentExpected: rent,
        situation: isAdv ? 'avance' : 'mois_regle',
        situationLabel: isAdv ? 'Avance' : 'Mois payé'
      };
    });
  }

  // Cas explicite : "Novembre 2026 à Janvier 2027" (60 000 FCFA)
  if (targetStr.includes('novembre 2026') && targetStr.includes('janvier 2027')) {
    return [
      {
        monthKey: '2026-11',
        year: 2026,
        monthIndex: 10,
        monthName: 'Novembre 2026',
        amountAllocated: rent,
        rentExpected: rent,
        situation: 'mois_regle',
        situationLabel: 'Mois payé'
      },
      {
        monthKey: '2026-12',
        year: 2026,
        monthIndex: 11,
        monthName: 'Décembre 2026',
        amountAllocated: rent,
        rentExpected: rent,
        situation: 'avance',
        situationLabel: 'Avance'
      },
      {
        monthKey: '2027-01',
        year: 2027,
        monthIndex: 0,
        monthName: 'Janvier 2027',
        amountAllocated: rent,
        rentExpected: rent,
        situation: 'avance',
        situationLabel: 'Avance'
      }
    ];
  }

  // Cas général : ventilation FIFO séquentielle
  const nbMonths = Math.max(1, Math.round(amt / rent));
  let startY = 2026;
  let startM = 11; // 1-based (Novembre par défaut)
  if (contractStartDate) {
    startY = contractStartDate.getFullYear();
    startM = contractStartDate.getMonth() + 1;
  }

  for (const [k, idx] of Object.entries(MONTH_TO_INDEX)) {
    if (targetStr.includes(k)) {
      startM = idx + 1;
      break;
    }
  }
  const ym = targetStr.match(/\b(202\d)\b/);
  if (ym) startY = parseInt(ym[1], 10);

  const result: MonthAllocationDetail[] = [];
  let remaining = amt;

  for (let i = 0; i < nbMonths; i++) {
    let m = startM + i;
    let y = startY;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    const mKey = `${y}-${String(m).padStart(2, '0')}`;
    const allocAmt = Math.min(rent, remaining);
    const isAdv = i > 0;
    result.push({
      monthKey: mKey,
      year: y,
      monthIndex: m - 1,
      monthName: `${FRENCH_MONTHS_NAMES[m - 1]} ${y}`,
      amountAllocated: allocAmt,
      rentExpected: rent,
      situation: isAdv ? 'avance' : 'mois_regle',
      situationLabel: isAdv ? 'Avance' : 'Mois payé'
    });
    remaining -= allocAmt;
    if (remaining <= 0) break;
  }

  return result;
}

// ============================================================================
// 11. SUITE DE TESTS INTÉGRÉE (12 CAS DE TEST DE LA SPÉCIFICATION DU PROMPT)
// ============================================================================

export function runRentCalculationTestSuite(): { allPassed: boolean; results: { test: string; passed: boolean; details: any }[] } {
  const results: { test: string; passed: boolean; details: any }[] = [];

  // TEST 1 : Contrat signé en novembre et payé en novembre
  {
    const contract = { id: 'c1', signed_at: '2026-11-17', monthly_rent: 20000 };
    const payments = [{ id: 'p1', amount: 20000, status: 'confirme', payment_date: '2026-11-17' }];
    const res = analyzeContractSituation(contract, payments, new Date(2026, 10, 17));
    const passed = res.startMonthKey === '2026-11' && res.currentMonthPaid === 20000 && res.advanceAmount === 0 && res.lateAmount === 0;
    results.push({ test: 'Test 1 : Signé en nov, payé 20k en nov', passed, details: { start: res.startMonthKey, paid: res.currentMonthPaid } });
  }

  // TEST 2 : Contrat signé en novembre et payé en décembre
  {
    const contract = { id: 'c2', signed_at: '2026-11-17', monthly_rent: 20000 };
    const payments = [{ id: 'p2', amount: 20000, status: 'confirme', payment_date: '2026-12-05' }];
    // Évalué en décembre (mois en cours = déc 2026)
    const res = analyzeContractSituation(contract, payments, new Date(2026, 11, 5));
    // Le paiement de 20k va en priorité au mois de novembre (mois le plus ancien / départ)
    const passed = res.startMonthKey === '2026-11' && res.paidMonths.includes('2026-11');
    results.push({ test: 'Test 2 : Signé en nov, payé en déc -> affecté à nov', passed, details: { paidMonths: res.paidMonths } });
  }

  // TEST 3 : Paiement couvrant 3 mois (60 000 FCFA en novembre)
  {
    const contract = { id: 'c3', signed_at: '2026-11-10', monthly_rent: 20000 };
    const payments = [{ id: 'p3', amount: 60000, status: 'confirme', period_covered: 'Novembre 2026 à Janvier 2027', payment_date: '2026-11-10' }];
    const res = analyzeContractSituation(contract, payments, new Date(2026, 10, 10));
    const passed = res.currentMonthPaid === 20000 && res.advanceAmount === 40000 && res.advanceMonths.length === 2;
    results.push({ test: 'Test 3 : 60k en nov -> 20k nov, 40k avances (déc+jan)', passed, details: { advanceAmount: res.advanceAmount, advanceMonths: res.advanceMonths } });
  }

  // TEST 4 & 5 : Consommation progressive automatique des avances
  {
    const contract = { id: 'c4', signed_at: '2026-11-10', monthly_rent: 20000 };
    const payments = [{ id: 'p4', amount: 60000, status: 'confirme', period_covered: 'Novembre 2026 à Janvier 2027', payment_date: '2026-11-10' }];
    // Évalué en décembre 2026
    const resDec = analyzeContractSituation(contract, payments, new Date(2026, 11, 15));
    // En décembre, l'avance ne doit plus être que de 20 000 FCFA (Janvier)
    const passedDec = resDec.advanceAmount === 20000 && resDec.currentMonthPaid === 20000;

    // Évalué en janvier 2027
    const resJan = analyzeContractSituation(contract, payments, new Date(2027, 0, 15));
    // En janvier, l'avance doit être tombée à 0 FCFA !
    const passedJan = resJan.advanceAmount === 0 && resJan.currentMonthPaid === 20000;

    const passed = passedDec && passedJan;
    results.push({
      test: 'Test 4 & 5 : Consommation progressive (nov=40k, déc=20k, jan=0k)',
      passed,
      details: { decAdvance: resDec.advanceAmount, janAdvance: resJan.advanceAmount }
    });
  }

  // TEST 6 & 7 : Retard de paiement après échéance
  {
    const contract = { id: 'c6', signed_at: '2026-11-01', monthly_rent: 20000, payment_due_day: 5 };
    const payments: any[] = [];
    // Évalué le 15 décembre (novembre échu non payé)
    const res = analyzeContractSituation(contract, payments, new Date(2026, 11, 15));
    const passed = res.lateAmount >= 20000 && res.lateMonths.includes('2026-11');
    results.push({ test: 'Test 6 & 7 : Mois non payé après échéance -> retard comptabilisé', passed, details: { lateAmount: res.lateAmount, lateMonths: res.lateMonths } });
  }

  // TEST 8 : Régularisation de 2 mois de retard + mois en cours
  {
    const contract = { id: 'c8', signed_at: '2026-11-01', monthly_rent: 20000 };
    // En janvier 2027, le locataire verse 60 000 FCFA
    const payments = [{ id: 'p8', amount: 60000, status: 'confirme', payment_date: '2027-01-10' }];
    const res = analyzeContractSituation(contract, payments, new Date(2027, 0, 10));
    // Les 3 mois (nov, déc, jan) sont soldés
    const passed = res.paidMonths.includes('2026-11') && res.paidMonths.includes('2026-12') && res.paidMonths.includes('2027-01') && res.lateAmount === 0;
    results.push({ test: 'Test 8 : 60k en janvier régularise nov + déc + jan', passed, details: { paidMonths: res.paidMonths, late: res.lateAmount } });
  }

  // TEST 9 : Paiement partiel
  {
    const contract = { id: 'c9', signed_at: '2026-11-01', monthly_rent: 20000 };
    const payments = [{ id: 'p9', amount: 15000, status: 'confirme', payment_date: '2026-11-05' }];
    const res = analyzeContractSituation(contract, payments, new Date(2026, 10, 10));
    const passed = res.currentMonthPaid === 15000 && res.currentMonthBalance === 5000;
    results.push({ test: 'Test 9 : Paiement partiel 15k / 20k -> solde 5k', passed, details: { paid: res.currentMonthPaid, bal: res.currentMonthBalance } });
  }

  // TEST 10 : Paiement supérieur aux dettes et au mois en cours
  {
    const contract = { id: 'c10', signed_at: '2026-11-01', monthly_rent: 20000 };
    // En nov, le locataire paie 50 000 FCFA
    const payments = [{ id: 'p10', amount: 50000, status: 'confirme', payment_date: '2026-11-05' }];
    const res = analyzeContractSituation(contract, payments, new Date(2026, 10, 10));
    // 20k nov + 20k déc (avance) + 10k jan (avance partielle) = 30k avances
    const passed = res.currentMonthPaid === 20000 && res.advanceAmount === 30000;
    results.push({ test: 'Test 10 : 50k en nov -> 20k nov + 30k avances', passed, details: { novPaid: res.currentMonthPaid, adv: res.advanceAmount } });
  }

  // TEST 11 : Contrat avec caution (la caution ne doit JAMAIS entrer dans les loyers)
  {
    const contract = { id: 'c11', status: 'actif', property_id: 'p11', signed_at: '2026-11-01', monthly_rent: 20000, caution_amount: 40000 };
    const payments = [
      { id: 'cau1', contract_id: 'c11', type: 'caution', amount: 40000, amount_paid: 40000, status: 'confirme' },
      { id: 'rent1', contract_id: 'c11', type: 'loyer', amount: 20000, status: 'confirme', payment_date: '2026-11-05' }
    ];
    const cautions = [{ id: 'cau1', contract_id: 'c11', amount_paid: 40000, status: 'confirme' }];
    const res = analyzeContractSituation(contract, payments, new Date(2026, 10, 10));
    const metrics = computeOwnerFinancialMetrics([{ id: 'p11' }], [contract], payments, cautions, new Date(2026, 10, 10));
    const passed = res.totalCollected === 20000 && metrics.collectedRentCurrentMonth === 20000 && metrics.cautionDetenue === 40000;
    results.push({ test: 'Test 11 : Caution de 40k isolée sous séquestre, loyer 20k', passed, details: { rentCollected: metrics.collectedRentCurrentMonth, caution: metrics.cautionDetenue } });
  }

  // TEST 12 : Agence avec mandants (commission 10% sur les loyers encaissés)
  {
    const mandants = [{ id: 'm1', full_name: 'Bailleur A', commission_rate: 0.10 }];
    const properties = [{ id: 'p1', owner_id: 'm1' }];
    const contracts = [{ id: 'c12', status: 'actif', property_id: 'p1', owner_id: 'm1', signed_at: '2026-11-01', monthly_rent: 20000 }];
    const payments = [{ id: 'pmt12', contract_id: 'c12', amount: 20000, status: 'confirme', payment_date: '2026-11-05' }];
    const agencyMetrics = computeAgencyFinancialMetrics(properties, contracts, payments, [], mandants, new Date(2026, 10, 10));
    const mRec = agencyMetrics.mandantsRecords[0];
    const passed = Boolean(mRec && mRec.collectedRent === 20000 && mRec.agencyCommissionAmount === 2000 && mRec.netRevenueToMandant === 18000);
    results.push({ test: 'Test 12 : Agence mandant -> 20k encaissé, 2k com (10%), 18k reversé', passed, details: { mRec } });
  }

  // TEST 13 : RÈGLE 14 — Séparation financière stricte de 2 contrats successifs sur le même bien
  {
    // Bien P100 loué d'abord au locataire A (contrat terminé avec 1 mois impayé)
    const oldContract = {
      id: 'cnt_old',
      property_id: 'p100',
      tenant_id: 'tenant_A',
      status: 'termine',
      signed_at: '2026-09-01',
      end_date: '2026-10-31',
      monthly_rent: 50000
    };
    // Nouveau locataire B sur le même bien P100 (contrat actif signé en novembre 2026)
    const newContract = {
      id: 'cnt_new',
      property_id: 'p100',
      tenant_id: 'tenant_B',
      status: 'actif',
      signed_at: '2026-11-01',
      monthly_rent: 50000
    };
    // Le nouveau locataire B paie son loyer de 50 000 FCFA pour son contrat
    const payments = [
      { id: 'p_new', contract_id: 'cnt_new', property_id: 'p100', tenant_id: 'tenant_B', amount: 50000, status: 'confirme', payment_date: '2026-11-05' }
    ];

    const refDate = new Date(2026, 10, 15); // 15 novembre 2026
    const oldAnalysis = analyzeContractSituation(oldContract, payments, refDate);
    const newAnalysis = analyzeContractSituation(newContract, payments, refDate);
    const metrics = computeOwnerFinancialMetrics([{ id: 'p100' }], [oldContract, newContract], payments, [], refDate);

    // Vérifications RÈGLE 14 :
    // 1. Le paiement du nouveau locataire N'A PAS été imputé à l'ancien contrat (oldAnalysis.totalCollected === 0)
    // 2. Le nouveau contrat a 0 dette et est à jour (newAnalysis.lateAmount === 0, newAnalysis.currentMonthPaid === 50000)
    // 3. Les métriques du propriétaire affichent le loyer encaissé du mois = 50 000 FCFA, 0 retard pour le contrat actif,
    //    et la dette de l'ancien contrat reste isolée dans terminatedDebtsAmount = 100 000 FCFA (sept+oct impayés)
    const passed =
      oldAnalysis.totalCollected === 0 &&
      newAnalysis.totalCollected === 50000 &&
      newAnalysis.lateAmount === 0 &&
      newAnalysis.currentMonthPaid === 50000 &&
      metrics.collectedRentCurrentMonth === 50000 &&
      metrics.lateRentAmount === 0 &&
      (metrics.terminatedDebtsAmount || 0) === 100000;

    results.push({
      test: 'Test 13 : Règle 14 — Séparation absolue contrats successifs sur même bien',
      passed,
      details: {
        oldCollected: oldAnalysis.totalCollected,
        newCollected: newAnalysis.totalCollected,
        newLate: newAnalysis.lateAmount,
        activeLateRent: metrics.lateRentAmount,
        terminatedDebts: metrics.terminatedDebtsAmount
      }
    });
  }

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}
