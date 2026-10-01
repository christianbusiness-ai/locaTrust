/**
 * LocaTrust Chronological Rent Allocation Engine
 *
 * Rules:
 * 1. Rent schedule is generated month-by-month from the signed lease contract.
 * 2. Any incoming payment is AUTOMATICALLY allocated starting from the OLDEST UNPAID MONTH.
 * 3. The date of receipt does NOT dictate the period paid; the contract schedule does.
 * 4. Multi-month payments automatically extinguish past debts sequentially and generate a multi-period receipt.
 */

export interface MonthlyScheduleItem {
  id: string;
  contract_id: string;
  tenant_id: string;
  target_month: string; // e.g. "Mars 2026", "Avril 2026"
  due_date: string; // e.g. "2026-03-05"
  amount_due: number;
  amount_paid: number;
  status: 'impaye' | 'a_payer' | 'partiel' | 'paye';
  payment_date?: string;
  receipt_number?: string;
  reference_txn?: string;
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

// Initial mock schedule for testing the exact user scenarios
export const MOCK_TENANT_RENT_SCHEDULE: MonthlyScheduleItem[] = [
  {
    id: 'sch_mars_2026',
    contract_id: 'LT-2026-CI-000492',
    tenant_id: 'usr_tenant_1',
    target_month: 'Mars 2026',
    due_date: '2026-03-05',
    amount_due: 150000,
    amount_paid: 150000,
    status: 'paye',
    payment_date: '2026-03-04',
    receipt_number: 'REC-2026-000301'
  },
  {
    id: 'sch_avril_2026',
    contract_id: 'LT-2026-CI-000492',
    tenant_id: 'usr_tenant_1',
    target_month: 'Avril 2026',
    due_date: '2026-04-05',
    amount_due: 150000,
    amount_paid: 150000,
    status: 'paye',
    payment_date: '2026-04-03',
    receipt_number: 'REC-2026-000402'
  },
  {
    id: 'sch_mai_2026',
    contract_id: 'LT-2026-CI-000492',
    tenant_id: 'usr_tenant_1',
    target_month: 'Mai 2026',
    due_date: '2026-05-05',
    amount_due: 150000,
    amount_paid: 150000,
    status: 'paye',
    payment_date: '2026-05-04',
    receipt_number: 'REC-2026-000503'
  },
  {
    id: 'sch_juin_2026',
    contract_id: 'LT-2026-CI-000492',
    tenant_id: 'usr_tenant_1',
    target_month: 'Juin 2026',
    due_date: '2026-06-05',
    amount_due: 150000,
    amount_paid: 150000,
    status: 'paye',
    payment_date: '2026-06-02',
    receipt_number: 'REC-2026-000604'
  },
  {
    id: 'sch_juillet_2026',
    contract_id: 'LT-2026-CI-000492',
    tenant_id: 'usr_tenant_1',
    target_month: 'Juillet 2026',
    due_date: '2026-07-05',
    amount_due: 150000,
    amount_paid: 150000,
    status: 'paye',
    payment_date: '2026-07-03',
    receipt_number: 'REC-2026-000705'
  },
  {
    id: 'sch_aout_2026',
    contract_id: 'LT-2026-CI-000492',
    tenant_id: 'usr_tenant_1',
    target_month: 'Août 2026',
    due_date: '2026-08-05',
    amount_due: 150000,
    amount_paid: 0,
    status: 'impaye'
  },
  {
    id: 'sch_sept_2026',
    contract_id: 'LT-2026-CI-000492',
    tenant_id: 'usr_tenant_1',
    target_month: 'Septembre 2026',
    due_date: '2026-09-05',
    amount_due: 150000,
    amount_paid: 0,
    status: 'a_payer'
  },
  {
    id: 'sch_oct_2026',
    contract_id: 'LT-2026-CI-000492',
    tenant_id: 'usr_tenant_1',
    target_month: 'Octobre 2026',
    due_date: '2026-10-05',
    amount_due: 150000,
    amount_paid: 0,
    status: 'a_payer'
  }
];

/**
 * Core Chronological Allocation Function
 * @param currentSchedule List of monthly items
 * @param paymentAmount FCFA amount received
 * @param paymentMethod Payment gateway / mode
 * @param referenceTxn Transaction ID (Mobile Money / Bank)
 * @param tenantName Name of tenant
 * @param contractNumber Contract number
 * @param propertyTitle Title of property
 */
export function processChronologicalRentPayment(
  currentSchedule: MonthlyScheduleItem[],
  paymentAmount: number,
  paymentMethod: string = 'Orange Money',
  referenceTxn: string = `TXN-${Date.now().toString().slice(-6)}`,
  tenantName: string = "Koffi N'Guessan",
  contractNumber: string = 'LT-2026-CI-000492',
  propertyTitle: string = 'Appartement 3 pièces Cocody Riviera 3'
): AllocationResult {
  let remainingMoney = paymentAmount;
  const newSchedule = currentSchedule.map((item) => ({ ...item }));
  const allocatedPeriods: AllocationResult['allocatedPeriods'] = [];

  const mainReceiptNumber = `REC-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  // Find all unpaid or partially paid months sorted chronologically by due date
  const unpaidItems = newSchedule
    .filter((item) => item.status === 'impaye' || item.status === 'a_payer' || item.status === 'partiel')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  for (const item of unpaidItems) {
    if (remainingMoney <= 0) break;

    const remainingDueForThisMonth = item.amount_due - item.amount_paid;

    if (remainingMoney >= remainingDueForThisMonth) {
      // Fully pay this month
      item.amount_paid = item.amount_due;
      item.status = 'paye';
      item.payment_date = new Date().toISOString().split('T')[0];
      item.receipt_number = mainReceiptNumber;
      item.reference_txn = referenceTxn;

      remainingMoney -= remainingDueForThisMonth;
      allocatedPeriods.push({
        target_month: item.target_month,
        amount_allocated: remainingDueForThisMonth,
        receipt_number: mainReceiptNumber
      });
    } else {
      // Partial payment for this month
      item.amount_paid += remainingMoney;
      item.status = 'partiel';
      item.payment_date = new Date().toISOString().split('T')[0];
      item.receipt_number = mainReceiptNumber;
      item.reference_txn = referenceTxn;

      allocatedPeriods.push({
        target_month: item.target_month,
        amount_allocated: remainingMoney,
        receipt_number: mainReceiptNumber
      });
      remainingMoney = 0;
    }
  }

  // Format the human-readable text for periods covered
  const periodNames = allocatedPeriods.map((p) => p.target_month);
  let periodsText = '';
  if (periodNames.length === 1) {
    periodsText = periodNames[0];
  } else if (periodNames.length > 1) {
    periodsText = `${periodNames.slice(0, -1).join(', ')} et ${periodNames[periodNames.length - 1]}`;
  } else {
    periodsText = 'Acompte Général Loyer';
  }

  const totalRemainingUnpaid = newSchedule
    .filter((item) => item.status !== 'paye')
    .reduce((sum, item) => sum + (item.amount_due - item.amount_paid), 0);

  return {
    updatedSchedule: newSchedule,
    allocatedPeriods,
    generatedReceipt: {
      receipt_number: mainReceiptNumber,
      contract_number: contractNumber,
      tenant_name: tenantName,
      property_title: propertyTitle,
      total_amount_paid: paymentAmount,
      periods_covered_text: periodsText,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: paymentMethod,
      reference: referenceTxn,
      qr_code_verification: `LOCATRUST-CERTIFIED-${mainReceiptNumber}`
    },
    totalRemainingUnpaid
  };
}
