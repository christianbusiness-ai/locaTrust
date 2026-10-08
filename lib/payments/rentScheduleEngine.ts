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

// Initial schedule: empty by default, populated dynamically from active leases
export const MOCK_TENANT_RENT_SCHEDULE: MonthlyScheduleItem[] = [];

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
  tenantName: string = 'Locataire',
  contractNumber: string = 'Bail LocaTrust',
  propertyTitle: string = 'Logement certifié'
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
