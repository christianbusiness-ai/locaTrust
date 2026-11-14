/**
 * LocaTrust Chronological Rent Allocation Engine
 *
 * Conforme aux règles métier LocaTrust, Loi ivoirienne n° 2019-576 & AUDCG OHADA :
 * 1. Calendrier généré mois par mois à partir de la date de début du contrat de bail.
 * 2. Affectation strictement chronologique (FIFO) :
 *    - Échéances impayées les plus anciennes PRIORITAIRES.
 *    - Complément d'un mois partiellement payé.
 *    - Échéance courante.
 *    - Prochaines échéances (paiement de plusieurs mois à l'avance).
 *    - Surplus restant éventuel non multiple -> consigné en Crédit locatif / Avance.
 * 3. Évite formellement les doublons de mois déjà réglés.
 * 4. Aucune modification rétroactive de l'historique comptable existant.
 */

import { formatFCFA } from '@/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { computeOwnerFinancialMetrics } from '@/lib/financial/rentCalculationEngine';

export interface MonthlyScheduleItem {
  id: string;
  contract_id: string;
  tenant_id: string;
  target_month: string; // ex: "Mars 2026", "Octobre 2027"
  due_date: string; // ex: "2026-03-05"
  amount_due: number;
  amount_paid: number;
  status: 'impaye' | 'a_payer' | 'partiel' | 'paye';
  status_label?: string;
  payment_date?: string;
  receipt_number?: string;
  reference_txn?: string;
  is_past_unpaid?: boolean;
  is_current_month?: boolean;
  is_advance?: boolean;
}

export interface PaymentAllocationItem {
  target_month: string;        // ex: "Octobre 2027"
  month_index: number;         // 1, 2, 3...
  due_date: string;            // ISO date
  amount_due: number;          // Montant dû contractuel (ex: 30000)
  amount_already_paid: number; // Montant déjà réglé auparavant (ex: 0 ou 20000)
  amount_allocated: number;    // Montant affecté par CE paiement
  remaining_balance: number;   // Solde restant dû pour ce mois après allocation
  status_after: 'paye' | 'partiel';
  status_type: 'retard_regularise' | 'mois_en_cours' | 'avance' | 'partiel';
  status_label: 'Retard régularisé' | 'Payé' | 'Avance' | 'Paiement partiel';
  is_past_unpaid: boolean;     // Était-ce un retard / impayé ancien ?
  is_current_month: boolean;   // Était-ce l'échéance courante ?
  is_advance: boolean;         // Est-ce une avance sur un mois futur ?
}

export interface CalculateAllocationOptions {
  contract: any;
  paymentAmount: number;
  paymentDate?: string | Date;
  existingPayments?: any[];
  includePendingDeclarations?: boolean;
  compensations?: any[];
}

export interface RentAllocationResult {
  contract_id: string;
  contract_number: string;
  monthly_rent: number;
  payment_amount: number;
  allocations: PaymentAllocationItem[];
  periods_covered_text: string;
  periods_covered_list: string[];
  total_allocated: number;
  remaining_credit: number;
  total_unpaid_before: number;
  total_unpaid_after: number;
  unpaid_months_before: string[];
  unpaid_months_after: string[];
  next_due_month?: string;
  is_ambiguous: boolean;
  ambiguity_reason?: string;
}

export interface AllocationResult {
  updatedSchedule: MonthlyScheduleItem[];
  allocatedPeriods: {
    target_month: string;
    amount_allocated: number;
    receipt_number: string;
  }[];
  generatedReceipt: {
    receipt_number: string;
    contract_number: string;
    tenant_name: string;
    property_title: string;
    total_amount_paid: number;
    periods_covered_text: string;
    payment_date: string;
    payment_method: string;
    reference: string;
    qr_code_verification: string;
  };
  totalRemainingUnpaid: number;
  isAdvancePayment?: boolean;
  partialRemaining?: number;
  monthsFullyCovered?: string[];
}

export const FRENCH_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const MOCK_TENANT_RENT_SCHEDULE: MonthlyScheduleItem[] = [];

/**
 * Formate un mois et une année en français (ex: "Octobre 2027")
 */
export function formatMonthYear(date: Date): string {
  const m = date.getMonth();
  const y = date.getFullYear();
  return `${FRENCH_MONTHS[m]} ${y}`;
}

/**
 * Parse n'importe quel format de date de manière sécurisée (sans décalage UTC)
 */
export function parseDateSafe(input?: any): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  const str = String(input).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) return dt;
    }
  }
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

/**
 * Ramène une date à minuit (00:00:00.000) en heure locale pour comparaison stricte au jour près.
 * Un loyer payable le 07 décembre n'est en retard qu'à partir du 08 décembre (toDayMidnight(now) > toDayMidnight(dueDate)).
 */
export function toDayMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Résout la date de prise d'effet contractuelle réelle d'un bail :
 * RÈGLE FONDAMENTALE : Les calculs des montants et des échéances doivent obligatoirement
 * partir de la DATE DE SIGNATURE DU CONTRAT (signed_date, signed_at, tenant_signed_at).
 * Aucun loyer attendu, retard ou allocation ne peut précéder la date de signature effective.
 */
export function resolveContractEffectiveStartDate(contract: any): Date {
  if (!contract) return new Date();

  // 1. Priorité absolue : date effective de signature du bail
  const rawSignature =
    contract.signed_date ||
    contract.signed_at ||
    contract.tenant_signed_at ||
    contract.owner_signed_at ||
    contract.documents?.signed_date ||
    contract.documents?.signed_at ||
    contract.documents?.tenant_signed_at ||
    contract.documents?.owner_signed_at;

  if (rawSignature) {
    const dt = parseDateSafe(rawSignature);
    if (!isNaN(dt.getTime())) return dt;
  }

  // 2. Date de début formellement stipulée au bail ou date d'entrée
  const rawStart =
    contract.start_date ||
    contract.lease_start_date ||
    contract.entry_date ||
    contract.entryDate ||
    contract.documents?.start_date;

  if (rawStart) {
    const dt = parseDateSafe(rawStart);
    if (!isNaN(dt.getTime())) return dt;
  }

  // 3. Fallback sur la création du contrat ou la date courante
  return parseDateSafe(contract.created_at || new Date());
}

/**
 * Résout le jour mensuel d'échéance réel du contrat :
 * Par défaut, si le contrat est signé / prend effet le 07 novembre, l'échéance mensuelle est le 07 de chaque mois
 * (1ère échéance le 07 décembre).
 */
export function resolveContractDueDay(contract: any, fallbackStartDate?: Date): number {
  const startDt = fallbackStartDate || resolveContractEffectiveStartDate(contract);
  const startDay = startDt.getDate() || 7;
  const rawDue = Number(contract?.due_day || contract?.payment_due_day || 0);
  if (rawDue >= 1 && rawDue <= 31 && rawDue !== 5) {
    return rawDue;
  }
  return startDay;
}

/**
 * Extrait de façon dynamique et robuste le loyer mensuel réel prévu au contrat ou au bien depuis la base de données
 */
export function extractContractMonthlyRent(contract: any): number {
  if (!contract) return 0;
  const raw =
    contract.monthly_rent ??
    contract.rent ??
    contract.rent_amount ??
    contract.property?.rent ??
    contract.property?.monthly_rent ??
    contract.property?.price ??
    contract.pricing?.rent ??
    contract.amount ??
    0;
  const num = Number(raw);
  return !isNaN(num) && num > 0 ? num : 0;
}

/**
 * Génère l'échéancier mensuel prévisionnel pour un contrat de bail donné,
 * partant obligatoirement de la date de signature effective du contrat.
 */
export function generateContractSchedule(
  contract: any,
  referenceDate: Date = new Date(),
  horizonMonths: number = 24
): MonthlyScheduleItem[] {
  const monthlyRent = extractContractMonthlyRent(contract);

  // RÈGLE ABSOLUE : L'échéancier débute strictement à la date de signature du contrat
  const startDate = resolveContractEffectiveStartDate(contract);
  const contractId = contract?.id || contract?.contract_number || 'cnt_default';
  const tenantId = contract?.tenant_id || contract?.tenant?.id || 'usr_tenant';

  // Jour contractuel d'exigibilité (ex: si signé le 07 novembre, échéance le 07 du mois suivant : 07 décembre)
  const dueDay = resolveContractDueDay(contract, startDate);

  const schedule: MonthlyScheduleItem[] = [];

  // Débuter strictement au mois de signature / prise d'effet du contrat
  const curDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  // Horizon : au moins jusqu'à referenceDate + horizonMonths mois
  const targetEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + horizonMonths, 1);

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const nowMonthIndex = refYear * 12 + refMonth;

  while (curDate <= targetEnd) {
    const year = curDate.getFullYear();
    const month = curDate.getMonth();
    const monthIndex = year * 12 + month;
    const monthLabel = `${FRENCH_MONTHS[month]} ${year}`;

    // Règle officielle LocaTrust (Gestion des loyers) :
    // 1. L'échéance d'un mois M est fixée au jour contractuel de ce même mois M (ex: 05 novembre pour novembre).
    // 2. Un loyer n'est en retard QUE lorsque le mois concerné est terminé sans avoir été payé (monthIndex < nowMonthIndex).
    // 3. Le mois en cours (monthIndex === nowMonthIndex) n'est JAMAIS en retard tant que le mois n'est pas terminé.
    // 4. Tout paiement d'un mois futur non encore commencé (monthIndex > nowMonthIndex) est une avance.
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const actualDueDay = Math.min(dueDay, daysInMonth);
    const dueDate = new Date(year, month, actualDueDay);
    const dueDateIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(actualDueDay).padStart(2, '0')}`;

    // Arrêter si la date de début de période dépasse la fin de contrat contractuelle
    if (contract?.end_date) {
      const endDate = parseDateSafe(contract.end_date);
      if (toDayMidnight(curDate) > toDayMidnight(endDate) && schedule.length > 0) {
        break;
      }
    }

    const isPast = monthIndex < nowMonthIndex;
    const isCurrent = monthIndex === nowMonthIndex;
    const isAdvance = monthIndex > nowMonthIndex;

    schedule.push({
      id: `sch_${contractId}_${year}_${month + 1}`,
      contract_id: contractId,
      tenant_id: tenantId,
      target_month: monthLabel,
      due_date: dueDateIso,
      amount_due: monthlyRent,
      amount_paid: 0,
      status: isPast ? 'impaye' : 'a_payer',
      status_label: isPast ? 'Retard' : isCurrent ? 'Mois en cours' : 'À venir',
      is_past_unpaid: isPast,
      is_current_month: isCurrent,
      is_advance: isAdvance
    });

    // Mois suivant
    curDate.setMonth(curDate.getMonth() + 1);
  }

  return schedule;
}

/**
 * Réconcilie l'historique des paiements existants sur l'échéancier
 */
export function reconcilePaymentsOnSchedule(
  schedule: MonthlyScheduleItem[],
  existingPayments: any[] = [],
  includePending: boolean = false,
  compensations: any[] = []
): MonthlyScheduleItem[] {
  const updatedSchedule = schedule.map((item) => ({ ...item }));
  const targetContractId = schedule[0]?.contract_id ? String(schedule[0].contract_id).trim() : null;

  // SCÉNARIO C : Imputer d'abord les compensations autorisées sur l'échéancier
  if (Array.isArray(compensations) && compensations.length > 0) {
    compensations.forEach((c: any) => {
      const isAuthorized =
        c.compensation_authorized === true ||
        c.validation_status === 'APPROUVEE' ||
        c.validation_status === 'COMPENSEE_PARTIELLEMENT' ||
        c.validation_status === 'COMPENSEE_TOTALEMENT';
      if (!isAuthorized) return;

      const cContractId = String(c.contract_id || '').trim();
      if (targetContractId && cContractId && cContractId !== targetContractId) return;

      const compAmt = Number(c.amount_deducted || c.amount || 0);
      if (compAmt <= 0) return;

      const targetMonthStr = String(c.target_month || c.deduction_month || '').toLowerCase();
      let matched = updatedSchedule.find((s) => s.target_month.toLowerCase().includes(targetMonthStr));
      if (!matched) {
        matched = updatedSchedule.find((s) => s.amount_paid < s.amount_due);
      }

      if (matched) {
        const needed = matched.amount_due - matched.amount_paid;
        const alloc = Math.min(needed, compAmt);
        matched.amount_paid += alloc;
      }
    });
  }

  const validPayments = existingPayments.filter((p) => {
    if (!p) return false;
    if (p.status === 'refuse' || p.status === 'rejete' || p.status === 'annule' || p.status === 'supprime') return false;
    const isConf =
      p.status === 'confirme' ||
      p.status === 'valide' ||
      p.status === 'certifie' ||
      p.status === 'paye' ||
      Boolean(p.receipt_number) ||
      Boolean(p.tenant_signature_url && p.owner_signature_url);
    if (!includePending && !isConf) {
      // Pour les calculs officiels validés, on n'inclut que les confirmés
      return false;
    }
    // Filtrage STRICT par contrat : un paiement d'un autre contrat ne doit jamais solder ce contrat
    if (targetContractId) {
      const pContractId = String(p.contract_id || p.contractId || p.contract?.id || '').trim();
      const pContractNum = String(p.contract_number || p.contractNumber || p.contract?.contract_number || '').trim();

      if (pContractId || pContractNum) {
        const matchesId = pContractId && (pContractId === targetContractId || targetContractId.includes(pContractId) || pContractId.includes(targetContractId));
        const matchesNum = pContractNum && (pContractNum === targetContractId || targetContractId.includes(pContractNum) || pContractNum.includes(targetContractId));
        if (!matchesId && !matchesNum) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  });

  // Trier les paiements par date de paiement / création
  validPayments.sort((a, b) => {
    const da = new Date(a.payment_date || a.created_at || 0).getTime();
    const db = new Date(b.payment_date || b.created_at || 0).getTime();
    return da - db;
  });

  for (const payment of validPayments) {
    // 1. Si le paiement cible une plage textuelle multi-mois explicite (ex: "Novembre 2026 à Janvier 2027"),
    // la plage textuelle prime rigoureusement pour éviter toute désynchronisation d'allocations
    const target = String(payment.target_month || payment.month || '').trim();
    const rangeRegex = /(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)\s*(\d{4})?\s*(?:à|au|-|–|to)\s*(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)\s*(\d{4})/i;
    const rangeMatch = target.match(rangeRegex);

    if (rangeMatch) {
      const FRENCH_MONTH_MAP: { [k: string]: number } = {
        janvier: 0, fevrier: 1, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
        juillet: 6, aout: 7, août: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, décembre: 11
      };
      const sM = FRENCH_MONTH_MAP[rangeMatch[1].toLowerCase()] ?? 10;
      const eM = FRENCH_MONTH_MAP[rangeMatch[3].toLowerCase()] ?? 0;
      const eY = parseInt(rangeMatch[4], 10);
      const sY = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : (sM <= eM ? eY : eY - 1);
      const startIdx = sY * 12 + sM;
      const endIdx = eY * 12 + eM;

      const rangeItems = updatedSchedule.filter(item => {
        const d = parseDateSafe(item.due_date);
        const idx = d.getFullYear() * 12 + d.getMonth();
        return idx >= startIdx && idx <= endIdx;
      });

      if (rangeItems.length > 0) {
        let money = Number(payment.amount || 0);
        for (const item of rangeItems) {
          const needed = item.amount_due - item.amount_paid;
          if (needed > 0 && money > 0) {
            const alloc = Math.min(money, needed);
            item.amount_paid += alloc;
            money -= alloc;
          }
        }

        if (money > 0) {
          const lastRangeIdx = updatedSchedule.indexOf(rangeItems[rangeItems.length - 1]);
          for (let i = lastRangeIdx + 1; i < updatedSchedule.length; i++) {
            if (money <= 0) break;
            const nextItem = updatedSchedule[i];
            const needed = nextItem.amount_due - nextItem.amount_paid;
            if (needed > 0) {
              const alloc = Math.min(money, needed);
              nextItem.amount_paid += alloc;
              money -= alloc;
            }
          }
        }
        continue;
      }
    }

    // 1b. Si le paiement possède des allocations explicites conformes
    if (Array.isArray(payment.allocations) && payment.allocations.length > 0) {
      for (const alloc of payment.allocations) {
        const item = updatedSchedule.find((s) => s.target_month.toLowerCase() === (alloc.target_month || '').toLowerCase());
        if (item) {
          item.amount_paid += Number(alloc.amount_allocated || 0);
        }
      }
      continue;
    }

    // 2. Si le paiement cible un mois direct ou contient des mois
    if (target) {
      // Chercher si un mois exact correspond
      const directItem = updatedSchedule.find((s) => s.target_month.toLowerCase() === target.toLowerCase());
      if (directItem) {
        const needed = directItem.amount_due - directItem.amount_paid;
        const pmtAmt = Number(payment.amount || 0);
        if (needed > 0 && pmtAmt <= needed) {
          directItem.amount_paid += pmtAmt;
          continue;
        } else if (pmtAmt > needed) {
          directItem.amount_paid += Math.max(0, needed);
          let surplus = pmtAmt - Math.max(0, needed);
          const directIdx = updatedSchedule.indexOf(directItem);
          for (let i = directIdx + 1; i < updatedSchedule.length; i++) {
            if (surplus <= 0) break;
            const nextItem = updatedSchedule[i];
            const nextNeeded = nextItem.amount_due - nextItem.amount_paid;
            if (nextNeeded > 0) {
              const alloc = Math.min(surplus, nextNeeded);
              nextItem.amount_paid += alloc;
              surplus -= alloc;
            }
          }
          continue;
        }
      }



      // Si le texte contient plusieurs mois par inclusion directe (ex: "Octobre 2027 – Novembre 2027")
      let matchedCount = 0;
      const matchedItems = updatedSchedule.filter((s) => target.toLowerCase().includes(s.target_month.toLowerCase()));
      if (matchedItems.length > 0) {
        let money = Number(payment.amount || 0);
        for (const mItem of matchedItems) {
          const needed = mItem.amount_due - mItem.amount_paid;
          if (needed > 0 && money > 0) {
            const alloc = Math.min(money, needed);
            mItem.amount_paid += alloc;
            money -= alloc;
            matchedCount++;
          }
        }
        if (matchedCount > 0) continue;
      }
    }

    // 3. Fallback : allocation chronologique sur le premier mois non soldé
    let remaining = Number(payment.amount || 0);
    for (const item of updatedSchedule) {
      if (remaining <= 0) break;
      const needed = item.amount_due - item.amount_paid;
      if (needed > 0) {
        const alloc = Math.min(remaining, needed);
        item.amount_paid += alloc;
        remaining -= alloc;
      }
    }
  }

  // Mettre à jour les statuts finaux de chaque mois
  for (const item of updatedSchedule) {
    if (item.amount_paid >= item.amount_due) {
      item.status = 'paye';
    } else if (item.amount_paid > 0) {
      item.status = 'partiel';
    } else {
      item.status = item.is_past_unpaid ? 'impaye' : 'a_payer';
    }
  }

  return updatedSchedule;
}

/**
 * Traite un paiement de loyer en affectation strictement chronologique (FIFO)
 * - Règle les mois les plus anciens en premier
 * - Si montant > loyer: avance sur les mois futurs
 * - Si montant < loyer: solde partiel rattaché à l'échéance
 */
export function processChronologicalRentPayment(
  schedule: MonthlyScheduleItem[],
  amountToPay: number,
  paymentMethod: string = 'Wave',
  reference: string = `TXN-${Date.now()}`,
  tenantName: string = 'Locataire',
  contractNumber: string = 'LT-CONTRAT',
  propertyTitle: string = 'Logement'
): AllocationResult {
  const updatedSchedule = schedule.map((item) => ({ ...item }));
  let moneyRemaining = Number(amountToPay) || 0;
  const allocatedPeriods: {
    target_month: string;
    amount_allocated: number;
    receipt_number: string;
  }[] = [];
  const monthsFullyCovered: string[] = [];
  let partialRemaining = 0;
  let isAdvancePayment = false;

  for (const item of updatedSchedule) {
    if (moneyRemaining <= 0) break;
    const needed = item.amount_due - item.amount_paid;
    if (needed > 0) {
      if (item.is_advance) {
        isAdvancePayment = true;
      }
      const alloc = Math.min(moneyRemaining, needed);
      item.amount_paid += alloc;
      moneyRemaining -= alloc;
      item.receipt_number = reference;
      item.reference_txn = reference;
      item.payment_date = new Date().toISOString().split('T')[0];

      if (item.amount_paid >= item.amount_due) {
        item.status = 'paye';
        monthsFullyCovered.push(item.target_month);
      } else {
        item.status = 'partiel';
        partialRemaining = item.amount_due - item.amount_paid;
      }

      allocatedPeriods.push({
        target_month: item.target_month,
        amount_allocated: alloc,
        receipt_number: reference
      });
    }
  }

  // Format periods covered text
  let periodsText = '';
  if (allocatedPeriods.length === 0) {
    periodsText = `Avance / Crédit (${amountToPay.toLocaleString('fr-FR')} FCFA)`;
  } else if (allocatedPeriods.length === 1) {
    const single = allocatedPeriods[0];
    const item = updatedSchedule.find(s => s.target_month === single.target_month);
    if (item && item.status === 'partiel') {
      periodsText = `${single.target_month} (Partiel: ${single.amount_allocated.toLocaleString('fr-FR')} FCFA / Solde: ${partialRemaining.toLocaleString('fr-FR')} FCFA)`;
    } else {
      periodsText = single.target_month;
    }
  } else {
    periodsText = `${allocatedPeriods[0].target_month} à ${allocatedPeriods[allocatedPeriods.length - 1].target_month}`;
  }

  const totalRemainingUnpaid = updatedSchedule
    .filter(s => s.status !== 'paye')
    .reduce((sum, s) => sum + Math.max(0, s.amount_due - s.amount_paid), 0);

  return {
    updatedSchedule,
    allocatedPeriods,
    generatedReceipt: {
      receipt_number: reference,
      contract_number: contractNumber,
      tenant_name: tenantName,
      property_title: propertyTitle,
      total_amount_paid: amountToPay,
      periods_covered_text: periodsText,
      payment_date: new Date().toLocaleDateString('fr-FR'),
      payment_method: paymentMethod,
      reference,
      qr_code_verification: `https://locatrust.ci/verify/receipt/${reference}`
    },
    totalRemainingUnpaid,
    isAdvancePayment,
    partialRemaining,
    monthsFullyCovered
  };
}

/**
 * FONCTION MÉTIER PRINCIPALE : calculateRentPaymentAllocation
 *
 * Calcule l'affectation automatique d'un paiement selon les 31 règles officielles de LocaTrust :
 * - Détecte les impayés et leur donne une PRIORITÉ ABSOLUE.
 * - Gère les compléments de mois partiels sans créer de doublon.
 * - Gère les paiements de 1, 2, 3, 4 mois et plus à l'avance.
 * - Préserve tout surplus non multiple sous forme de crédit locatif / avance.
 * - Indique clairement si le calcul est ambigu pour vérification bailleur.
 */
export function calculateRentPaymentAllocation(
  options: CalculateAllocationOptions
): RentAllocationResult {
  const {
    contract,
    paymentAmount,
    paymentDate,
    existingPayments = [],
    includePendingDeclarations = false,
    compensations = []
  } = options;

  const monthlyRent = Number(
    contract?.monthly_rent ||
    contract?.rent ||
    contract?.rent_amount ||
    extractContractMonthlyRent(contract) ||
    0
  );

  const contractNumber =
    contract?.contract_number ||
    contract?.contractNumber ||
    contract?.id ||
    'LT-CONTRAT';

  const contractId = contract?.id || contractNumber;

  // Cas ambigu : données de contrat manquantes ou invalides
  if (!contract || monthlyRent <= 0) {
    return {
      contract_id: contractId,
      contract_number: contractNumber,
      monthly_rent: monthlyRent,
      payment_amount: paymentAmount,
      allocations: [],
      periods_covered_text: 'Données de contrat insuffisantes',
      periods_covered_list: [],
      total_allocated: 0,
      remaining_credit: paymentAmount,
      total_unpaid_before: 0,
      total_unpaid_after: 0,
      unpaid_months_before: [],
      unpaid_months_after: [],
      is_ambiguous: true,
      ambiguity_reason: 'Loyer mensuel non défini ou contrat inexistant.'
    };
  }

  const pDate = paymentDate ? parseDateSafe(paymentDate) : new Date();

  // 1. Génération de l'échéancier complet (horizon 36 mois pour supporter les avances)
  let schedule = generateContractSchedule(contract, pDate, 36);

  // 2. Réconciliation avec l'historique existant (et compensations autorisées)
  schedule = reconcilePaymentsOnSchedule(schedule, existingPayments, includePendingDeclarations, compensations);

  // 3. Calcul de la situation avant le paiement
  const unpaidBefore = schedule.filter(
    (item) => item.status === 'impaye' || item.status === 'partiel'
  );
  const totalUnpaidBefore = unpaidBefore.reduce(
    (sum, item) => sum + (item.amount_due - item.amount_paid),
    0
  );
  const unpaidMonthsBefore = unpaidBefore.map((item) => item.target_month);

  // 4. Sélection chronologique stricte des mois à solder (FIFO)
  // Tous les mois où amount_paid < amount_due, triés par due_date
  const payableItems = schedule
    .filter((item) => item.amount_due > item.amount_paid)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  let availableMoney = Math.max(0, paymentAmount);
  const allocations: PaymentAllocationItem[] = [];
  let monthIdx = 1;

  for (const item of payableItems) {
    if (availableMoney <= 0) break;

    const remainingDue = item.amount_due - item.amount_paid;
    if (remainingDue <= 0) continue;

    if (availableMoney >= remainingDue) {
      // Ce mois est intégralement soldé par ce paiement
      const isPast = Boolean(item.is_past_unpaid);
      const isAdv = Boolean(item.is_advance);
      const isCurr = Boolean(item.is_current_month);

      const statusType: 'retard_regularise' | 'mois_en_cours' | 'avance' =
        isPast ? 'retard_regularise' : isAdv ? 'avance' : 'mois_en_cours';
      const statusLabel: 'Retard régularisé' | 'Payé' | 'Avance' =
        isPast ? 'Retard régularisé' : isAdv ? 'Avance' : 'Payé';

      allocations.push({
        target_month: item.target_month,
        month_index: monthIdx++,
        due_date: item.due_date,
        amount_due: item.amount_due,
        amount_already_paid: item.amount_paid,
        amount_allocated: remainingDue,
        remaining_balance: 0,
        status_after: 'paye',
        status_type: statusType,
        status_label: statusLabel,
        is_past_unpaid: isPast,
        is_current_month: isCurr,
        is_advance: isAdv
      });
      availableMoney -= remainingDue;
      item.amount_paid = item.amount_due;
      item.status = 'paye';
    } else {
      // Paiement partiel pour ce mois
      const isPast = Boolean(item.is_past_unpaid);
      const isAdv = Boolean(item.is_advance);
      const isCurr = Boolean(item.is_current_month);

      allocations.push({
        target_month: item.target_month,
        month_index: monthIdx++,
        due_date: item.due_date,
        amount_due: item.amount_due,
        amount_already_paid: item.amount_paid,
        amount_allocated: availableMoney,
        remaining_balance: remainingDue - availableMoney,
        status_after: 'partiel',
        status_type: 'partiel',
        status_label: 'Paiement partiel',
        is_past_unpaid: isPast,
        is_current_month: isCurr,
        is_advance: isAdv
      });
      item.amount_paid += availableMoney;
      item.status = 'partiel';
      availableMoney = 0;
    }
  }

  // 5. Si après avoir parcouru l'échéancier il reste de l'argent (avance très longue)
  while (availableMoney >= monthlyRent) {
    const lastItem = schedule[schedule.length - 1];
    const lastDate = parseDateSafe(lastItem?.due_date || pDate);
    const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate() || 5);
    const nextMonthLabel = formatMonthYear(nextDate);

    const newItem: MonthlyScheduleItem = {
      id: `sch_${contractId}_future_${nextDate.getFullYear()}_${nextDate.getMonth() + 1}`,
      contract_id: contractId,
      tenant_id: contract?.tenant_id || 'usr_tenant',
      target_month: nextMonthLabel,
      due_date: nextDate.toISOString().split('T')[0],
      amount_due: monthlyRent,
      amount_paid: monthlyRent,
      status: 'paye',
      status_label: 'Avance',
      is_past_unpaid: false,
      is_current_month: false,
      is_advance: true
    };
    schedule.push(newItem);

    allocations.push({
      target_month: nextMonthLabel,
      month_index: monthIdx++,
      due_date: newItem.due_date,
      amount_due: monthlyRent,
      amount_already_paid: 0,
      amount_allocated: monthlyRent,
      remaining_balance: 0,
      status_after: 'paye',
      status_type: 'avance',
      status_label: 'Avance',
      is_past_unpaid: false,
      is_current_month: false,
      is_advance: true
    });

    availableMoney -= monthlyRent;
  }

  // Tout surplus inférieur à un mois devient du crédit locatif
  const remainingCredit = availableMoney;
  const totalAllocated = paymentAmount - remainingCredit;

  // 6. Situation après ce paiement
  const unpaidAfter = schedule.filter(
    (item) => item.status === 'impaye' || item.status === 'partiel'
  );
  const totalUnpaidAfter = unpaidAfter.reduce(
    (sum, item) => sum + (item.amount_due - item.amount_paid),
    0
  );
  const unpaidMonthsAfter = unpaidAfter.map((item) => item.target_month);

  // Prochaine échéance non payée
  const nextItem = schedule.find((item) => item.status !== 'paye');
  const nextDueMonth = nextItem?.target_month;

  // 7. Formatage de la période couverte
  const periodsCoveredList = allocations.map((a) => a.target_month);
  const periodsCoveredText = formatAllocationPeriodsText(allocations, remainingCredit);

  return {
    contract_id: contractId,
    contract_number: contractNumber,
    monthly_rent: monthlyRent,
    payment_amount: paymentAmount,
    allocations,
    periods_covered_text: periodsCoveredText,
    periods_covered_list: periodsCoveredList,
    total_allocated: totalAllocated,
    remaining_credit: remainingCredit,
    total_unpaid_before: totalUnpaidBefore,
    total_unpaid_after: totalUnpaidAfter,
    unpaid_months_before: unpaidMonthsBefore,
    unpaid_months_after: unpaidMonthsAfter,
    next_due_month: nextDueMonth,
    is_ambiguous: false
  };
}

/**
 * Formate le texte lisible officiel des périodes couvertes pour l'UI, le reçu et la quittance
 */
export function formatAllocationPeriodsText(
  allocations: PaymentAllocationItem[],
  remainingCredit: number = 0
): string {
  if (allocations.length === 0) {
    if (remainingCredit > 0) {
      return `Crédit locatif / Avance (${remainingCredit.toLocaleString('fr-FR')} FCFA)`;
    }
    return 'Aucune période couverte';
  }

  // Cas d'un seul mois
  if (allocations.length === 1) {
    const single = allocations[0];
    if (single.status_after === 'partiel') {
      return `${single.target_month} (Paiement partiel : ${single.amount_allocated.toLocaleString('fr-FR')} FCFA / Solde dû : ${single.remaining_balance.toLocaleString('fr-FR')} FCFA)`;
    }
    let res = single.target_month;
    if (remainingCredit > 0) {
      res += ` (+ Crédit locatif : ${remainingCredit.toLocaleString('fr-FR')} FCFA)`;
    }
    return res;
  }

  // Cas de 2 mois consécutifs
  if (allocations.length === 2) {
    let res = `${allocations[0].target_month} – ${allocations[1].target_month}`;
    if (remainingCredit > 0) {
      res += ` (+ Crédit locatif : ${remainingCredit.toLocaleString('fr-FR')} FCFA)`;
    }
    return res;
  }

  // Cas de 3 mois ou plus consécutifs
  const first = allocations[0].target_month;
  const last = allocations[allocations.length - 1].target_month;
  let res = `${first} à ${last}`;
  if (remainingCredit > 0) {
    res += ` (+ Crédit locatif : ${remainingCredit.toLocaleString('fr-FR')} FCFA)`;
  }
  return res;
}

export interface ContractRentDuesResult {
  contractId: string;
  contractNumber: string;
  propertyId?: string;
  propertyTitle: string;
  tenantId?: string;
  tenantName: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string;
  status: string;
  totalExpectedRentToDate: number;
  totalCollectedRent: number;
  totalAdvanceRent: number;
  totalLateRent: number;
  lateMonthsCount: number;
  lateMonthsList: string[];
  currentMonthDue: number;
  currentMonthPaid: number;
  currentMonthBalance: number;
  currentMonthStatus: 'paye' | 'partiel' | 'en_retard' | 'en_attente';
  schedule: MonthlyScheduleItem[];
}

export interface PortfolioRentMetrics {
  totalExpectedRentCurrentMonth: number;
  totalCollectedRentCurrentMonth: number;
  totalAdvanceRent: number;
  totalLateRent: number;
  totalLateMonthsCount: number;
  totalLateContractsCount: number;
  totalActiveContracts: number;
  totalRentedProperties: number;
  totalVacantProperties: number;
  totalTenantsCount: number;
  recoveryRateCurrentMonth: number;
  contractResults: ContractRentDuesResult[];
}

/**
 * MOTEUR UNIFIÉ DE CALCUL DES ÉCHÉANCES, RETARDS ET EXCLUSION STRICTE DES BIENS NON LOUÉS
 * Conforme aux règles d'or LocaTrust :
 * 1. Un bien vacant/disponible sans contrat actif ne produit AUCUN loyer attendu, ni retard, ni dette.
 * 2. Un bien entre dans les calculs UNIQUEMENT s'il possède un contrat actif, un locataire et une date de début.
 * 3. Les retards sont calculés en comparant les échéances échues avec les paiements réels Supabase (FIFO).
 * 4. Gestion native des paiements partiels, avances sur mois futurs et imputation au plus ancien.
 */
export function computePortfolioRentMetrics(
  properties: any[] = [],
  contracts: any[] = [],
  payments: any[] = [],
  referenceDate: Date | string = new Date()
): PortfolioRentMetrics {
  const refDate = typeof referenceDate === 'string' ? parseDateSafe(referenceDate) : (referenceDate || new Date());

  // Utiliser le moteur central unifié rentCalculationEngine (Règles 1 à 10)
  const metrics = computeOwnerFinancialMetrics(properties, contracts, payments, [], refDate);

  const activeContracts = (contracts || []).filter((c: any) => {
    if (!c) return false;
    const st = String(c.status || '').toLowerCase().trim();
    return (st === 'actif' || st === 'contrat_actif' || st === 'signe') && st !== 'termine' && st !== 'cloture' && st !== 'resilie';
  });

  const rentedPropertyIds = new Set<string>();
  activeContracts.forEach((c: any) => {
    const propId = c.property_id || c.property?.id;
    if (propId) rentedPropertyIds.add(String(propId));
  });

  const validProps = (properties || []).filter((p: any) => p && !p.deleted_at);
  const totalRentedProperties = rentedPropertyIds.size;
  const totalVacantProperties = Math.max(0, validProps.length - totalRentedProperties);

  return {
    totalExpectedRentCurrentMonth: metrics.expectedRentCurrentMonth,
    totalCollectedRentCurrentMonth: metrics.collectedRentCurrentMonth,
    totalAdvanceRent: metrics.advanceRentAmount,
    totalLateRent: metrics.lateRentAmount,
    totalLateMonthsCount: metrics.contractsAnalysis.reduce((s, an) => s + an.lateMonths.length, 0),
    totalLateContractsCount: metrics.contractsAnalysis.filter((an) => an.lateAmount > 0).length,
    totalActiveContracts: metrics.activeContractsCount,
    totalRentedProperties,
    totalVacantProperties,
    totalTenantsCount: metrics.activeTenantsCount,
    recoveryRateCurrentMonth: metrics.recoveryRateCurrentMonth,
    contractResults: []
  };
}

/**
 * RÈGLE FONDAMENTALE DES AVANCES DE LOYERS (Consommation progressive & Alerte d'épuisement) :
 * Vérifie l'ensemble des contrats actifs. Lorsque l'avance d'un locataire est totalement
 * consommée et qu'il entre dans un nouveau mois non couvert sans paiement effectué,
 * déclenche automatiquement une notification officielle invitant le preneur à régler le loyer.
 */
export function checkAndNotifyExhaustedAdvances(
  contracts: any[] = [],
  payments: any[] = [],
  refDate: Date | string = new Date()
): { contractId: string; targetMonth: string; amountDue: number; notified: boolean }[] {
  if (typeof window === 'undefined') return [];
  const referenceDate = typeof refDate === 'string' ? parseDateSafe(refDate) : (refDate || new Date());
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const nowMonthIndex = refYear * 12 + refMonth;

  const results: { contractId: string; targetMonth: string; amountDue: number; notified: boolean }[] = [];

  const activeContracts = (contracts || []).filter((c: any) => {
    if (!c) return false;
    const st = String(c.status || '').toLowerCase().trim();
    return st === 'actif' || st === 'contrat_actif' || st === 'signe';
  });

  const validPayments = (payments || []).filter((p: any) => {
    if (!p) return false;
    const st = String(p.status || '').toLowerCase().trim();
    if (st === 'refuse' || st === 'rejete' || st === 'annule' || st === 'supprime') return false;
    return (
      st === 'confirme' ||
      st === 'valide' ||
      st === 'certifie' ||
      st === 'paye' ||
      Boolean(p.receipt_number) ||
      Boolean(p.tenant_signature_url && p.owner_signature_url)
    );
  });

  for (const contract of activeContracts) {
    const contractNum = contract.contract_number || contract.id || 'LT-CONTRAT';
    const contractId = contract.id || contractNum;
    const tenantId = contract.tenant_id || contract.tenant?.id;
    if (!tenantId) continue;

    const contractPayments = validPayments.filter((p: any) => {
      const pContractId = p.contract_id || p.contract?.id || p.contract?.contract_number;
      if (pContractId && (pContractId === contractId || pContractId === contractNum)) return true;
      if (tenantId && p.tenant_id === tenantId) return true;
      return false;
    });

    const schedule = generateContractSchedule(contract, referenceDate, 36);
    const reconciled = reconcilePaymentsOnSchedule(schedule, contractPayments, false);

    // Trouver le mois courant selon la date de référence
    const currentItem = reconciled.find((item) => {
      const d = parseDateSafe(item.due_date);
      return d.getFullYear() * 12 + d.getMonth() === nowMonthIndex;
    });

    if (!currentItem) continue;

    // Le mois en cours n'est pas soldé
    const isUnpaidThisMonth = currentItem.amount_paid < currentItem.amount_due;

    // Mois précédent soldé
    const prevItem = reconciled.find((item) => {
      const d = parseDateSafe(item.due_date);
      return d.getFullYear() * 12 + d.getMonth() === nowMonthIndex - 1;
    });

    const hadPreviousCoverage = prevItem ? prevItem.amount_paid >= prevItem.amount_due : false;

    // Détecter si le contrat a déjà bénéficié d'avances de loyer
    const hasAdvanceHistory = contractPayments.some((p: any) => {
      const target = String(p.target_month || p.period_covered || '').toLowerCase();
      return (
        target.includes(' à ') ||
        target.includes(' au ') ||
        target.includes(' - ') ||
        target.includes(' – ') ||
        (Array.isArray(p.allocations) && p.allocations.length > 1) ||
        Number(p.amount) > Number(contract.monthly_rent || contract.rent || 0)
      );
    });

    if (isUnpaidThisMonth && (hadPreviousCoverage || hasAdvanceHistory)) {
      const notifKey = `locatrust_adv_exhausted_${contractNum}_${currentItem.target_month}`;
      const alreadySent = localStorage.getItem(notifKey);

      if (!alreadySent) {
        const propTitle = contract.property?.title || contract.property_title || 'votre logement';
        const notifTitle = "Avance de loyer épuisée — Loyer dû";
        const notifDesc = `Votre avance de loyer est désormais épuisée. Le loyer de ${currentItem.target_month} (${formatFCFA(currentItem.amount_due)}) pour "${propTitle}" est maintenant exigible. Merci d'effectuer votre déclaration de paiement.`;

        try {
          const rawNotifs = localStorage.getItem('locatrust_notifications');
          let notifsList: any[] = [];
          if (rawNotifs) {
            try {
              notifsList = JSON.parse(rawNotifs);
            } catch {}
          }

          const newNotif = {
            id: `notif_adv_exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: notifTitle,
            description: notifDesc,
            timestamp: "À l'instant",
            category: 'paiement' as const,
            read: false,
            targetTab: 'paiements',
            userId: tenantId,
            contractNumber: contractNum,
            targetMonth: currentItem.target_month
          };

          notifsList.unshift(newNotif);
          localStorage.setItem('locatrust_notifications', JSON.stringify(notifsList));
          localStorage.setItem(notifKey, 'true');

          window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { newNotif } }));

          try {
            supabase
              .from('notifications')
              .insert([
                {
                  user_id: tenantId,
                  title: notifTitle,
                  message: notifDesc,
                  category: 'paiement',
                  read: false,
                  data: {
                    contractNumber: contractNum,
                    targetMonth: currentItem.target_month,
                    type: 'advance_exhausted'
                  }
                }
              ])
              .then(() => {})
              .catch(() => {});
          } catch {}

          results.push({
            contractId: String(contractId),
            targetMonth: currentItem.target_month,
            amountDue: currentItem.amount_due,
            notified: true
          });
        } catch (e) {
          console.warn('Erreur notification avance épuisée:', e);
        }
      }
    }
  }

  return results;
}

// Re-export canonique du moteur centralisé de calcul des loyers LocaTrust
export * from '@/lib/financial/rentCalculationEngine';


