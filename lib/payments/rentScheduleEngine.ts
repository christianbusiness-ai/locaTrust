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

export interface MonthlyScheduleItem {
  id: string;
  contract_id: string;
  tenant_id: string;
  target_month: string; // ex: "Mars 2026", "Octobre 2027"
  due_date: string; // ex: "2026-03-05"
  amount_due: number;
  amount_paid: number;
  status: 'impaye' | 'a_payer' | 'partiel' | 'paye';
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
 * Parse n'importe quel format de date de manière sécurisée
 */
export function parseDateSafe(input?: any): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  const str = String(input).trim();
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
 * Génère l'échéancier mensuel complet d'un contrat de bail
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
 * depuis la date de début jusqu'à un horizon futur suffisant
 */
export function generateContractSchedule(
  contract: any,
  referenceDate: Date = new Date(),
  horizonMonths: number = 24
): MonthlyScheduleItem[] {
  const monthlyRent = extractContractMonthlyRent(contract);

  const rawStart =
    contract?.start_date ||
    contract?.lease_start_date ||
    contract?.signed_at ||
    contract?.tenant_signed_at ||
    contract?.created_at ||
    '2026-10-01';

  const startDate = parseDateSafe(rawStart);
  const contractId = contract?.id || contract?.contract_number || 'LT-2026-CI-000492';
  const tenantId = contract?.tenant_id || contract?.tenant?.id || 'usr_tenant';

  // Jour contractuel d'exigibilité (ex: 5 du mois ou jour du début de bail)
  const dueDay = contract?.due_day ? Number(contract.due_day) : (startDate.getDate() || 5);

  const schedule: MonthlyScheduleItem[] = [];

  // Débuter au 1er du mois de début de contrat
  const curDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  // Horizon : au moins jusqu'à referenceDate + horizonMonths mois
  const targetEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + horizonMonths, 1);

  const currentMonthKey = `${referenceDate.getFullYear()}-${referenceDate.getMonth()}`;

  while (curDate <= targetEnd) {
    const year = curDate.getFullYear();
    const month = curDate.getMonth();
    const monthLabel = `${FRENCH_MONTHS[month]} ${year}`;

    // Date d'échéance exacte
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const actualDueDay = Math.min(dueDay, daysInMonth);
    const dueDate = new Date(year, month, actualDueDay);
    const dueDateIso = dueDate.toISOString().split('T')[0];

    const monthKey = `${year}-${month}`;
    const isPast = dueDate < referenceDate && monthKey !== currentMonthKey;
    const isCurrent = monthKey === currentMonthKey;
    const isAdvance = dueDate > referenceDate && !isCurrent;

    schedule.push({
      id: `sch_${contractId}_${year}_${month + 1}`,
      contract_id: contractId,
      tenant_id: tenantId,
      target_month: monthLabel,
      due_date: dueDateIso,
      amount_due: monthlyRent,
      amount_paid: 0,
      status: isPast ? 'impaye' : (isCurrent ? 'a_payer' : 'a_payer'),
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
  includePending: boolean = false
): MonthlyScheduleItem[] {
  const updatedSchedule = schedule.map((item) => ({ ...item }));

  const validPayments = existingPayments.filter((p) => {
    if (!p) return false;
    if (p.status === 'refuse' || p.status === 'rejete') return false;
    if (!includePending && (p.status === 'declare' || p.status === 'en_attente')) {
      // Pour les calculs officiels validés, on n'inclut que les confirmés
      return false;
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
    // 1. Si le paiement possède des allocations explicites
    if (Array.isArray(payment.allocations) && payment.allocations.length > 0) {
      for (const alloc of payment.allocations) {
        const item = updatedSchedule.find((s) => s.target_month.toLowerCase() === (alloc.target_month || '').toLowerCase());
        if (item) {
          item.amount_paid += Number(alloc.amount_allocated || 0);
        }
      }
      continue;
    }

    // 2. Si le paiement cible un mois ou une plage textuelle
    const target = String(payment.target_month || payment.month || '').trim();
    if (target) {
      // Chercher si un mois exact correspond
      const directItem = updatedSchedule.find((s) => s.target_month.toLowerCase() === target.toLowerCase());
      if (directItem) {
        directItem.amount_paid += Number(payment.amount || 0);
        continue;
      }

      // Si le texte contient plusieurs mois (ex: "Octobre 2027 – Novembre 2027")
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
    includePendingDeclarations = false
  } = options;

  const monthlyRent = Number(
    contract?.monthly_rent ||
    contract?.rent ||
    contract?.rent_amount ||
    0
  );

  const contractNumber =
    contract?.contract_number ||
    contract?.id ||
    'LT-2026-CI-000492';

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

  // 2. Réconciliation avec l'historique existant
  schedule = reconcilePaymentsOnSchedule(schedule, existingPayments, includePendingDeclarations);

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
      allocations.push({
        target_month: item.target_month,
        month_index: monthIdx++,
        due_date: item.due_date,
        amount_due: item.amount_due,
        amount_already_paid: item.amount_paid,
        amount_allocated: remainingDue,
        remaining_balance: 0,
        status_after: 'paye',
        is_past_unpaid: Boolean(item.is_past_unpaid),
        is_current_month: Boolean(item.is_current_month),
        is_advance: Boolean(item.is_advance)
      });
      availableMoney -= remainingDue;
      item.amount_paid = item.amount_due;
      item.status = 'paye';
    } else {
      // Paiement partiel pour ce mois
      allocations.push({
        target_month: item.target_month,
        month_index: monthIdx++,
        due_date: item.due_date,
        amount_due: item.amount_due,
        amount_already_paid: item.amount_paid,
        amount_allocated: availableMoney,
        remaining_balance: remainingDue - availableMoney,
        status_after: 'partiel',
        is_past_unpaid: Boolean(item.is_past_unpaid),
        is_current_month: Boolean(item.is_current_month),
        is_advance: Boolean(item.is_advance)
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

/**
 * Fonction historique pour rétrocompatibilité
 */
export function processChronologicalRentPayment(
  currentSchedule: MonthlyScheduleItem[],
  paymentAmount: number,
  paymentMethod: string = 'Orange Money',
  referenceTxn: string = `TXN-${Date.now().toString().slice(-6)}`,
  tenantName: string = 'Locataire',
  contractNumber: string = 'Bail LocaTrust',
  propertyTitle: string = 'Logement certifié'
): AllocationResult {
  const dummyContract = {
    contract_number: contractNumber,
    monthly_rent: currentSchedule[0]?.amount_due || (paymentAmount > 0 ? paymentAmount : 0),
    due_day: 5
  };

  const allocResult = calculateRentPaymentAllocation({
    contract: dummyContract,
    paymentAmount,
    paymentDate: new Date(),
    existingPayments: []
  });

  const mainReceiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const allocatedPeriods = allocResult.allocations.map((a) => ({
    target_month: a.target_month,
    amount_allocated: a.amount_allocated,
    receipt_number: mainReceiptNumber
  }));

  return {
    updatedSchedule: currentSchedule,
    allocatedPeriods,
    generatedReceipt: {
      receipt_number: mainReceiptNumber,
      contract_number: contractNumber,
      tenant_name: tenantName,
      property_title: propertyTitle,
      total_amount_paid: paymentAmount,
      periods_covered_text: allocResult.periods_covered_text,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: paymentMethod,
      reference: referenceTxn,
      qr_code_verification: `LOCATRUST-CERTIFIED-${mainReceiptNumber}`
    },
    totalRemainingUnpaid: allocResult.total_unpaid_after
  };
}
