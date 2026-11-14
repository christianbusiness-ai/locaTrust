/**
 * SUITE DE TESTS D'INTÉGRATION OFFICIELLE — MODULE DE GESTION DES DÉPENSES & COMPENSATIONS
 * 
 * Valide les 10 scénarios impératifs du prompt technique :
 * 1. Scénario A (Propriétaire paie directement, loyer locataire reste intact, revenu net = 85k)
 * 2. Scénario B (Locataire doit rembourser, solde restant suivi séparément, pas un nouveau loyer)
 * 3. Scénario C (Compensation autorisée 15k + paiement 85k = mois soldé à 0 dette)
 * 4. Circuit de validation (EN_ATTENTE -> INFOS -> APPROUVEE -> REFUSEE)
 * 5. Gestion des reliquats (Dépense 150k > loyer 100k -> 100k mois 1, 50k mois 2)
 * 6. Refus de déduction (Refus motivé -> loyer dû à 100%)
 * 7. Règle 14 : Indépendance stricte des contrats successifs sur un même bien
 * 8. Séparation stricte par mandant (Agence immobilière)
 * 9. Zéro montant codé en dur
 * 10. Immutabilité de l'historique (Dépense toujours conservée)
 */

import {
  analyzeContractSituation,
  computeOwnerFinancialMetrics,
  computeAgencyFinancialMetrics
} from '../lib/financial/rentCalculationEngine';
import {
  calculateExpensesFinancialSummary,
  PropertyExpense
} from '../lib/financial/expensesService';
import {
  calculateRentPaymentAllocation
} from '../lib/payments/rentScheduleEngine';

console.log('================================================================');
console.log('🧪 DÉBUT DU TEST DE CONFORMITÉ — MODULE DÉPENSES & COMPENSATIONS');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [TEST ${totalTests}] PASS: ${testName}`);
  } else {
    console.error(`❌ [TEST ${totalTests}] FAIL: ${testName}`);
    if (details) console.error(`   Détails: ${details}`);
    process.exitCode = 1;
  }
}

// ----------------------------------------------------------------------------
// TEST 1 : SCÉNARIO A — LE PROPRIÉTAIRE PAIE DIRECTEMENT LA RÉPARATION
// ----------------------------------------------------------------------------
{
  const contract = {
    id: 'cnt_scen_a',
    contract_number: 'LT-SCEN-A',
    tenant_name: 'Christian Yao',
    monthly_rent: 100000,
    signed_date: '2026-11-01',
    status: 'actif'
  };

  const expense: PropertyExpense = {
    id: 'exp_01',
    expense_number: 'DEP-2026-0001',
    property_id: 'prop_01',
    contract_id: 'cnt_scen_a',
    owner_id: 'own_01',
    category: 'plomberie',
    title: 'Réparation fuite toiture',
    description: 'Remplacement tôle',
    amount: 15000,
    currency: 'XOF',
    payer: 'proprietaire',
    responsible: 'proprietaire',
    scenario: 'A',
    validation_status: 'APPROUVEE',
    expense_date: '2026-11-05',
    photos: [],
    amount_to_recover: 0,
    amount_recovered: 0,
    recovery_balance: 0,
    compensation_authorized: false,
    compensation_total_applied: 0,
    compensation_balance: 0,
    created_at: '2026-11-05T10:00:00Z',
    updated_at: '2026-11-05T10:00:00Z'
  };

  // Le locataire n'a pas encore payé son loyer du mois
  const analysis = analyzeContractSituation(contract, [], new Date(2026, 10, 10), []);

  assert(
    analysis.currentMonthExpected === 100000 && analysis.currentMonthBalance === 100000,
    'Scénario A : Le locataire doit toujours payer l’intégralité de son loyer (100 000 FCFA)'
  );

  const metrics = computeOwnerFinancialMetrics(
    [{ id: 'prop_01', title: 'Villa Cocody' }],
    [contract],
    [{ id: 'p1', contract_id: 'cnt_scen_a', amount: 100000, status: 'confirme', payment_date: '2026-11-06' }],
    [],
    new Date(2026, 10, 10),
    [],
    [expense]
  );

  assert(
    metrics.collectedRentCurrentMonth === 100000 &&
    metrics.totalExpensesPaidByOwner === 15000 &&
    metrics.netRentalIncome === 85000,
    'Scénario A : Revenu locatif net = 85 000 FCFA (Loyer 100k - Dépense propriétaire 15k)',
    `Attendu net 85000, obtenu: ${metrics.netRentalIncome}`
  );
}

// ----------------------------------------------------------------------------
// TEST 2 : SCÉNARIO B — LE LOCATAIRE DOIT REMBOURSER LA RÉPARATION
// ----------------------------------------------------------------------------
{
  const expenseB: PropertyExpense = {
    id: 'exp_02',
    expense_number: 'DEP-2026-0002',
    property_id: 'prop_02',
    contract_id: 'cnt_scen_b',
    owner_id: 'own_01',
    tenant_id: 'ten_02',
    category: 'serrurerie',
    title: 'Clé cassée dans serrure',
    description: 'Intervention serrurier à la charge du locataire',
    amount: 15000,
    currency: 'XOF',
    payer: 'proprietaire',
    responsible: 'locataire',
    scenario: 'B',
    validation_status: 'APPROUVEE',
    expense_date: '2026-11-05',
    photos: [],
    reimbursement_status: 'en_attente',
    amount_to_recover: 15000,
    amount_recovered: 0,
    recovery_balance: 15000,
    compensation_authorized: false,
    compensation_total_applied: 0,
    compensation_balance: 0,
    created_at: '2026-11-05T10:00:00Z',
    updated_at: '2026-11-05T10:00:00Z'
  };

  const summaryBefore = calculateExpensesFinancialSummary([expenseB]);
  assert(
    summaryBefore.totalToRecoverFromTenants === 15000 && summaryBefore.balanceRemainingToRecover === 15000,
    'Scénario B initial : Montant à récupérer auprès du locataire = 15 000 FCFA'
  );

  // Simulation d'un remboursement partiel de 10 000 FCFA
  const expenseBAfterPartial: PropertyExpense = {
    ...expenseB,
    amount_recovered: 10000,
    recovery_balance: 5000,
    reimbursement_status: 'partiel'
  };

  const summaryAfter = calculateExpensesFinancialSummary([expenseBAfterPartial]);
  assert(
    summaryAfter.totalRecoveredFromTenants === 10000 && summaryAfter.balanceRemainingToRecover === 5000,
    'Scénario B après remboursement partiel : Solde restant à récupérer = 5 000 FCFA'
  );
}

// ----------------------------------------------------------------------------
// TEST 3 : SCÉNARIO C — DÉDUCTION DE LOYER COMPENSÉE (100k Loyer - 15k Réparation)
// ----------------------------------------------------------------------------
{
  const contractC = {
    id: 'cnt_scen_c',
    contract_number: 'LT-SCEN-C',
    tenant_name: 'Christian Koffi',
    monthly_rent: 100000,
    signed_date: '2026-11-01',
    status: 'actif'
  };

  const compensationRecord = {
    id: 'comp_01',
    expense_id: 'exp_03',
    contract_id: 'cnt_scen_c',
    target_month: '2026-11',
    amount_deducted: 15000,
    compensation_authorized: true,
    validation_status: 'APPROUVEE'
  };

  // Le locataire verse le complément de 85 000 FCFA
  const payment85k = {
    id: 'pmt_85k',
    contract_id: 'cnt_scen_c',
    amount: 85000,
    status: 'confirme',
    payment_date: '2026-11-07',
    target_month: '2026-11'
  };

  const situation = analyzeContractSituation(
    contractC,
    [payment85k],
    new Date(2026, 10, 15),
    [compensationRecord]
  );

  const novMonth = situation.schedule.find((s) => s.monthKey === '2026-11');

  assert(
    novMonth !== undefined &&
    novMonth.amountDue === 100000 &&
    novMonth.amountPaid === 85000 &&
    novMonth.amountCompensated === 15000 &&
    novMonth.balanceRemaining === 0 &&
    novMonth.status === 'paye',
    'Scénario C : Loyer 100k - Comp 15k - Payé 85k => Solde = 0 FCFA, Statut: Mois Payé (SANS AUCUN IMPAYÉ)'
  );

  assert(
    situation.totalExpectedToDate === 100000 && situation.lateAmount === 0,
    'Scénario C : Aucun retard ou faux impayé généré sur le bail'
  );
}

// ----------------------------------------------------------------------------
// TEST 4 : CIRCUIT DE VALIDATION DES DÉPENSES
// ----------------------------------------------------------------------------
{
  const expPending: PropertyExpense = {
    id: 'exp_val_01',
    expense_number: 'DEP-2026-0004',
    property_id: 'p1',
    owner_id: 'own_1',
    category: 'plomberie',
    title: 'Fuite lavabo',
    description: 'Facture soumise par locataire',
    amount: 20000,
    currency: 'XOF',
    payer: 'locataire',
    responsible: 'proprietaire',
    scenario: 'C',
    validation_status: 'EN_ATTENTE_VALIDATION',
    expense_date: '2026-11-01',
    photos: [],
    amount_to_recover: 0,
    amount_recovered: 0,
    recovery_balance: 0,
    compensation_authorized: false,
    compensation_total_applied: 0,
    compensation_balance: 20000,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z'
  };

  const summary = calculateExpensesFinancialSummary([expPending]);
  assert(
    summary.pendingValidationCount === 1 && summary.totalCompensationsAuthorized === 0,
    'Circuit de validation : Une dépense EN_ATTENTE_VALIDATION n’autorise AUCUNE compensation automatique'
  );
}

// ----------------------------------------------------------------------------
// TEST 5 : GESTION DES RELIQUATS (Dépense 150k > Loyer 100k)
// ----------------------------------------------------------------------------
{
  const contractReliquat = {
    id: 'cnt_reliquat',
    contract_number: 'LT-RELIQUAT',
    monthly_rent: 100000,
    signed_date: '2026-11-01',
    status: 'actif'
  };

  // Grosse réparation de 150 000 FCFA autorisée
  const comp150k = {
    id: 'comp_big',
    contract_id: 'cnt_reliquat',
    target_month: '2026-11',
    amount_deducted: 150000,
    compensation_authorized: true
  };

  const situation = analyzeContractSituation(
    contractReliquat,
    [],
    new Date(2026, 11, 10), // En décembre 2026
    [comp150k]
  );

  const mNov = situation.schedule.find((s) => s.monthKey === '2026-11');
  const mDec = situation.schedule.find((s) => s.monthKey === '2026-12');

  assert(
    mNov?.amountCompensated === 100000 &&
    mNov?.balanceRemaining === 0 &&
    mDec?.amountCompensated === 50000 &&
    mDec?.balanceRemaining === 50000,
    'Gestion des reliquats : 100k imputés sur Novembre (solde 0) et reliquat de 50k imputé sur Décembre (solde 50k)'
  );
}

// ----------------------------------------------------------------------------
// TEST 6 : REFUS DE DÉDUCTION PAR LE BAILLEUR
// ----------------------------------------------------------------------------
{
  const contractRefused = {
    id: 'cnt_refused',
    contract_number: 'LT-REFUSED',
    monthly_rent: 100000,
    signed_date: '2026-11-01',
    status: 'actif'
  };

  // Dépense refusée par le bailleur
  const compRefused = {
    id: 'comp_ref',
    contract_id: 'cnt_refused',
    target_month: '2026-11',
    amount_deducted: 15000,
    validation_status: 'REFUSEE',
    compensation_authorized: false
  };

  const situation = analyzeContractSituation(
    contractRefused,
    [],
    new Date(2026, 10, 10),
    [compRefused]
  );

  const novMonth = situation.schedule.find((s) => s.monthKey === '2026-11');
  assert(
    novMonth?.amountCompensated === 0 && novMonth?.balanceRemaining === 100000,
    'Refus de déduction : La dépense refusée ne donne lieu à aucune déduction (Loyer dû à 100%)'
  );
}

// ----------------------------------------------------------------------------
// TEST 7 : RÈGLE 14 — INDÉPENDANCE STRICTE DES CONTRATS SUCCESSIFS
// ----------------------------------------------------------------------------
{
  const oldContractTerminated = {
    id: 'cnt_old_term',
    contract_number: 'LT-OLD-01',
    property_id: 'prop_villa_01',
    monthly_rent: 100000,
    signed_date: '2025-01-01',
    status: 'termine',
    end_date: '2026-10-31'
  };

  const newContractActive = {
    id: 'cnt_new_act',
    contract_number: 'LT-NEW-02',
    property_id: 'prop_villa_01', // Même bien immobilier !
    monthly_rent: 100000,
    signed_date: '2026-11-01',
    status: 'actif'
  };

  // Ancienne compensation sur l'ancien contrat
  const oldComp = {
    id: 'comp_old',
    contract_id: 'cnt_old_term',
    target_month: '2026-10',
    amount_deducted: 15000,
    compensation_authorized: true
  };

  const newAnalysis = analyzeContractSituation(
    newContractActive,
    [],
    new Date(2026, 10, 10),
    [oldComp]
  );

  const novNew = newAnalysis.schedule.find((s) => s.monthKey === '2026-11');
  assert(
    novNew?.amountCompensated === 0 && novNew?.balanceRemaining === 100000,
    'Règle 14 : Un nouveau contrat ne récupère AUCUNE compensation ni dépense de l’ancien contrat du même bien'
  );
}

// ----------------------------------------------------------------------------
// TEST 8 : SÉPARATION STRICTE PAR MANDANT (AGENCE IMMOBILIÈRE)
// ----------------------------------------------------------------------------
{
  const properties = [
    { id: 'p_m1', title: 'Villa Mandant A', owner_id: 'mandant_a' },
    { id: 'p_m2', title: 'Appartement Mandant B', owner_id: 'mandant_b' }
  ];

  const contracts = [
    { id: 'c_m1', contract_number: 'LT-M1', property_id: 'p_m1', owner_id: 'mandant_a', monthly_rent: 100000, signed_date: '2026-11-01', status: 'actif' },
    { id: 'c_m2', contract_number: 'LT-M2', property_id: 'p_m2', owner_id: 'mandant_b', monthly_rent: 200000, signed_date: '2026-11-01', status: 'actif' }
  ];

  const payments = [
    { id: 'pay_m1', contract_id: 'c_m1', amount: 100000, status: 'confirme', payment_date: '2026-11-05' },
    { id: 'pay_m2', contract_id: 'c_m2', amount: 200000, status: 'confirme', payment_date: '2026-11-05' }
  ];

  const mandants = [
    { id: 'mandant_a', full_name: 'Mandant A', commission_rate: 0.10 },
    { id: 'mandant_b', full_name: 'Mandant B', commission_rate: 0.10 }
  ];

  const agencyMetrics = computeAgencyFinancialMetrics(
    properties,
    contracts,
    payments,
    [],
    mandants,
    new Date(2026, 10, 10)
  );

  const recA = agencyMetrics.mandantsRecords.find((m) => m.mandantId === 'mandant_a');
  const recB = agencyMetrics.mandantsRecords.find((m) => m.mandantId === 'mandant_b');

  assert(
    recA?.collectedRent === 100000 &&
    recA?.agencyCommissionAmount === 10000 &&
    recB?.collectedRent === 200000 &&
    recB?.agencyCommissionAmount === 20000,
    'Séparation Agence : Les flux et commissions sont strictement compartimentés par mandant'
  );
}

// ----------------------------------------------------------------------------
// TEST 9 : ZÉRO MONTANT CODÉ EN DUR
// ----------------------------------------------------------------------------
{
  const customRent = 375420;
  const customRepair = 42150;

  const dynamicContract = {
    id: 'cnt_dynamic',
    monthly_rent: customRent,
    signed_date: '2026-11-01',
    status: 'actif'
  };

  const dynamicComp = {
    id: 'comp_dyn',
    contract_id: 'cnt_dynamic',
    target_month: '2026-11',
    amount_deducted: customRepair,
    compensation_authorized: true
  };

  const situation = analyzeContractSituation(
    dynamicContract,
    [],
    new Date(2026, 10, 10),
    [dynamicComp]
  );

  const novItem = situation.schedule.find((s) => s.monthKey === '2026-11');
  const expectedBalance = customRent - customRepair;

  assert(
    novItem?.balanceRemaining === expectedBalance,
    `Zéro montant en dur : Calcul exact avec montants arbitraires (${customRent} - ${customRepair} = ${expectedBalance})`
  );
}

// ----------------------------------------------------------------------------
// TEST 10 : IMMUTABILITÉ ET CONSERVATION DE L'HISTORIQUE DE DÉPENSE
// ----------------------------------------------------------------------------
{
  const expenseToArchive: PropertyExpense = {
    id: 'exp_immutable',
    expense_number: 'DEP-2026-0010',
    property_id: 'p_imm',
    owner_id: 'own_1',
    category: 'peinture',
    title: 'Peinture salon',
    description: 'Facture conservée',
    amount: 50000,
    currency: 'XOF',
    payer: 'locataire',
    responsible: 'proprietaire',
    scenario: 'C',
    validation_status: 'COMPENSEE_TOTALEMENT',
    expense_date: '2026-11-01',
    photos: [],
    amount_to_recover: 0,
    amount_recovered: 0,
    recovery_balance: 0,
    compensation_authorized: true,
    compensation_total_applied: 50000,
    compensation_balance: 0,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z'
  };

  const summary = calculateExpensesFinancialSummary([expenseToArchive]);
  assert(
    summary.totalExpensesCount === 1 &&
    summary.totalCompensationsApplied === 50000 &&
    summary.approvedCount === 1,
    'Immutabilité : Une dépense compensée à 100% est conservée intacte dans l’historique comptable'
  );
}

console.log('\n================================================================');
console.log(`RÉSULTAT GLOBAL : ${passedTests} / ${totalTests} TESTS VALIDÉS AVEC SUCCÈS 🚀`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
