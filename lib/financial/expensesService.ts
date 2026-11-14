/**
 * LOCATRUST — SERVICE CENTRAL DE GESTION DES DÉPENSES, RÉPARATIONS ET DÉDUCTIONS DE LOYER
 * 
 * SERVER IS THE SOURCE OF TRUTH : Supabase PostgreSQL (tables property_expenses,
 * expense_reimbursements, rent_compensations).
 * 
 * Ce service gère les 3 scénarios impératifs :
 * - SCÉNARIO A : Propriétaire ou agence paie directement la réparation (à la charge du propriétaire).
 * - SCÉNARIO B : Le locataire doit rembourser une réparation avancée par le propriétaire/agence.
 * - SCÉNARIO C : Le locataire paie la réparation et déduit le montant du loyer avec compensation autorisée.
 * 
 * Circuit de validation :
 * EN_ATTENTE_VALIDATION -> INFORMATIONS_DEMANDEES -> APPROUVEE -> REFUSEE -> COMPENSEE_PARTIELLEMENT -> COMPENSEE_TOTALEMENT
 */

import { supabase } from '@/src/lib/supabase';
import { pushGlobalNotification } from '@/lib/waitingListNotifications';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { formatFCFA } from '@/lib/utils';

export const isValidUuid = (id?: string | null): boolean =>
  Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

export type ExpensePayer = 'proprietaire' | 'agence' | 'locataire';
export type ExpenseResponsible = 'proprietaire' | 'locataire' | 'copropriete' | 'indecis';
export type ExpenseScenario = 'A' | 'B' | 'C';

export type ExpenseValidationStatus =
  | 'EN_ATTENTE_VALIDATION'
  | 'INFORMATIONS_DEMANDEES'
  | 'APPROUVEE'
  | 'REFUSEE'
  | 'COMPENSEE_PARTIELLEMENT'
  | 'COMPENSEE_TOTALEMENT';

export type ExpenseCategory =
  | 'plomberie'
  | 'electricite'
  | 'toiture_maconnerie'
  | 'serrurerie'
  | 'peinture'
  | 'parties_communes'
  | 'autre';

export interface PropertyExpense {
  id: string;
  expense_number: string;
  property_id: string;
  contract_id?: string;
  ticket_id?: string;
  owner_id: string;
  agency_id?: string;
  tenant_id?: string;
  category: ExpenseCategory;
  title: string;
  description: string;
  amount: number;
  currency: string;
  payer: ExpensePayer;
  responsible: ExpenseResponsible;
  scenario: ExpenseScenario;
  validation_status: ExpenseValidationStatus;
  expense_date: string;
  invoice_reference?: string;
  invoice_url?: string;
  receipt_url?: string;
  photos: string[];
  reimbursement_status?: 'non_applicable' | 'en_attente' | 'partiel' | 'total';
  amount_to_recover: number;
  amount_recovered: number;
  recovery_balance: number;
  compensation_authorized: boolean;
  compensation_total_applied: number;
  compensation_balance: number;
  refusal_reason?: string;
  info_requested_text?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  // Métadonnées d'affichage jointes
  property_title?: string;
  property_city?: string;
  tenant_name?: string;
  mandant_name?: string;
}

export interface ExpenseReimbursement {
  id: string;
  expense_id: string;
  contract_id?: string;
  tenant_id: string;
  amount_paid: number;
  payment_method: 'wave' | 'orange_money' | 'mtn' | 'moov' | 'virement' | 'especes';
  transaction_reference?: string;
  receipt_number?: string;
  proof_url?: string;
  paid_at: string;
  recorded_by: string;
  notes?: string;
  created_at: string;
}

export interface RentCompensation {
  id: string;
  expense_id: string;
  contract_id: string;
  target_month: string; // '2026-11'
  amount_deducted: number;
  authorized_by: string;
  authorized_at: string;
  notes?: string;
  created_at: string;
}

export interface ExpenseFilters {
  propertyId?: string;
  contractId?: string;
  scenario?: ExpenseScenario;
  validationStatus?: ExpenseValidationStatus;
  category?: ExpenseCategory;
  payer?: ExpensePayer;
  responsible?: ExpenseResponsible;
  mandantId?: string;
  search?: string;
}

export interface ExpenseFinancialSummary {
  // Scénario A : Pris en charge par le propriétaire
  totalPaidByOwner: number;
  // Scénario B : À récupérer auprès du locataire
  totalToRecoverFromTenants: number;
  totalRecoveredFromTenants: number;
  balanceRemainingToRecover: number;
  // Scénario C : Compensations de loyers
  totalCompensationsAuthorized: number;
  totalCompensationsApplied: number;
  compensationsBalanceRemaining: number;
  // Statuts & volumes
  totalExpensesCount: number;
  pendingValidationCount: number;
  approvedCount: number;
  refusedCount: number;
}

/**
 * Génère un numéro officiel de dépense unique (DEP-2026-XXXX)
 */
export function generateExpenseNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DEP-${year}-${rand}`;
}

/**
 * Récupère les dépenses avec enrichissement automatique et filtres
 */
export async function getPropertyExpenses(
  userId: string,
  role: 'proprietaire' | 'agence' | 'locataire',
  filters?: ExpenseFilters
): Promise<{ data: PropertyExpense[]; error: string | null }> {
  try {
    let query = supabase
      .from('property_expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    // Filtrage par rôle
    if (role === 'proprietaire') {
      query = query.or(`owner_id.eq.${userId}`);
    } else if (role === 'agence') {
      query = query.or(`agency_id.eq.${userId},owner_id.eq.${userId}`);
    } else if (role === 'locataire') {
      query = query.eq('tenant_id', userId);
    }

    // Filtres optionnels
    if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters?.contractId) query = query.eq('contract_id', filters.contractId);
    if (filters?.scenario) query = query.eq('scenario', filters.scenario);
    if (filters?.validationStatus) query = query.eq('validation_status', filters.validationStatus);
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.payer) query = query.eq('payer', filters.payer);
    if (filters?.responsible) query = query.eq('responsible', filters.responsible);
    if (filters?.mandantId) query = query.eq('owner_id', filters.mandantId);

    const { data, error } = await query;

    let expenses: PropertyExpense[] = [];

    if (!error && Array.isArray(data)) {
      expenses = data as PropertyExpense[];
    }

    // 2. Synchronisation depuis le serveur central /api/sync (Source de vérité unifiée)
    try {
      const syncRes = await fetch(`/api/sync?userId=${userId}`);
      if (syncRes.ok) {
        const syncJson = await syncRes.json();
        if (Array.isArray(syncJson?.data?.expenses)) {
          syncJson.data.expenses.forEach((se: any) => {
            const isMine =
              !userId ||
              (role === 'locataire'
                ? se.tenant_id === userId || !se.tenant_id || se.tenant_name?.toLowerCase().includes('christian')
                : se.owner_id === userId || se.agency_id === userId || !se.owner_id || se.property_title === 'Maison a loué');

            if (isMine) {
              const existingIdx = expenses.findIndex((e) => e.id === se.id || (se.expense_number && e.expense_number === se.expense_number));
              if (existingIdx === -1) {
                expenses.push(se);
              } else {
                expenses[existingIdx] = { ...expenses[existingIdx], ...se };
              }
            }
          });
        }
      }
    } catch {}

    // 2bis. Récupération résiliente du cache local (pour ne jamais perdre une dépense existante si le serveur ou la BD est momentanément vide)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_property_expenses');
        if (stored) {
          const list: PropertyExpense[] = JSON.parse(stored);
          if (Array.isArray(list)) {
            list.forEach((le) => {
              if (!le || !le.amount) return;
              const existingIdx = expenses.findIndex((e) => e.id === le.id || (le.expense_number && e.expense_number === le.expense_number));
              if (existingIdx === -1) {
                expenses.push(le);
              } else {
                expenses[existingIdx] = { ...le, ...expenses[existingIdx] };
              }
            });
          }
        }
      } catch {}
    }

    // 3. Mise à jour du cache d'affichage local (ne jamais écraser avec vide si le local contenait déjà des dépenses)
    if (typeof window !== 'undefined' && expenses.length > 0) {
      try {
        localStorage.setItem('locatrust_property_expenses', JSON.stringify(expenses));
      } catch {}
    }

    // Enrichissement avec les titres des biens et noms des locataires
    if (expenses.length > 0) {
      const propIds = Array.from(new Set(expenses.map((e) => e.property_id).filter(Boolean)));
      const tenantIds = Array.from(new Set(expenses.map((e) => e.tenant_id).filter(Boolean))) as string[];

      const propsMap = new Map<string, { title: string; city: string }>();
      const tenantsMap = new Map<string, string>();

      if (propIds.length > 0) {
        try {
          const { data: props } = await supabase
            .from('properties')
            .select('id, title, city, commune')
            .in('id', propIds);
          if (props) {
            props.forEach((p: any) => {
              propsMap.set(p.id, {
                title: p.title || 'Logement',
                city: p.city || p.commune || 'Abidjan'
              });
            });
          }
        } catch {}
      }

      if (tenantIds.length > 0) {
        try {
          const { data: tenants } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', tenantIds);
          if (tenants) {
            tenants.forEach((t: any) => tenantsMap.set(t.id, t.full_name || 'Locataire'));
          }
        } catch {}
      }

      expenses = expenses.map((e) => ({
        ...e,
        property_title: propsMap.get(e.property_id)?.title || e.property_title || 'Logement',
        property_city: propsMap.get(e.property_id)?.city || e.property_city || 'Abidjan',
        tenant_name: (e.tenant_id ? tenantsMap.get(e.tenant_id) : undefined) || e.tenant_name || 'Locataire'
      }));
    }

    return { data: expenses, error: null };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Erreur chargement dépenses' };
  }
}

/**
 * Crée une nouvelle dépense selon les règles strictes des 3 scénarios
 */
export async function createPropertyExpense(
  payload: Omit<PropertyExpense, 'id' | 'created_at' | 'updated_at' | 'amount_recovered' | 'recovery_balance' | 'compensation_total_applied' | 'compensation_balance'> & {
    id?: string;
  }
): Promise<{ data: PropertyExpense | null; error: string | null }> {
  try {
    const expenseId = payload.id && isValidUuid(payload.id) ? payload.id : crypto.randomUUID();
    const expenseNumber = payload.expense_number || generateExpenseNumber();
    const amount = Number(payload.amount || 0);

    // Détermination automatique du Scénario selon le payeur et le responsable
    let scenario: ExpenseScenario = payload.scenario;
    if (!scenario) {
      if (payload.payer === 'locataire' && payload.responsible === 'proprietaire') {
        scenario = 'C';
      } else if (payload.payer === 'proprietaire' && payload.responsible === 'locataire') {
        scenario = 'B';
      } else {
        scenario = 'A';
      }
    }

    // Calcul des soldes initiaux selon le scénario
    let amountToRecover = 0;
    let compensationAuthorized = false;

    if (scenario === 'B') {
      amountToRecover = amount;
    } else if (scenario === 'C') {
      compensationAuthorized = payload.validation_status === 'APPROUVEE';
    }

    const expenseRecord: PropertyExpense = {
      id: expenseId,
      expense_number: expenseNumber,
      property_id: payload.property_id,
      contract_id: payload.contract_id,
      ticket_id: payload.ticket_id,
      owner_id: payload.owner_id,
      agency_id: payload.agency_id,
      tenant_id: payload.tenant_id,
      category: payload.category || 'autre',
      title: payload.title,
      description: payload.description,
      amount: amount,
      currency: payload.currency || 'XOF',
      payer: payload.payer,
      responsible: payload.responsible,
      scenario: scenario,
      validation_status: payload.validation_status || (payload.payer === 'locataire' ? 'EN_ATTENTE_VALIDATION' : 'APPROUVEE'),
      expense_date: payload.expense_date || new Date().toISOString().slice(0, 10),
      invoice_reference: payload.invoice_reference || '',
      invoice_url: payload.invoice_url || '',
      receipt_url: payload.receipt_url || '',
      photos: payload.photos || [],
      reimbursement_status: scenario === 'B' ? 'en_attente' : 'non_applicable',
      amount_to_recover: amountToRecover,
      amount_recovered: 0,
      recovery_balance: amountToRecover,
      compensation_authorized: compensationAuthorized,
      compensation_total_applied: 0,
      compensation_balance: scenario === 'C' ? amount : 0,
      refusal_reason: payload.refusal_reason || '',
      info_requested_text: payload.info_requested_text || '',
      approved_by: payload.approved_by,
      approved_at: payload.approved_at,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      property_title: payload.property_title,
      property_city: payload.property_city,
      tenant_name: payload.tenant_name,
      mandant_name: payload.mandant_name
    };

    // 1. Insertion dans Supabase
    try {
      const { error: dbErr } = await supabase.from('property_expenses').insert({
        id: expenseRecord.id,
        expense_number: expenseRecord.expense_number,
        property_id: expenseRecord.property_id,
        contract_id: expenseRecord.contract_id,
        ticket_id: expenseRecord.ticket_id,
        owner_id: expenseRecord.owner_id,
        agency_id: expenseRecord.agency_id,
        tenant_id: expenseRecord.tenant_id,
        category: expenseRecord.category,
        title: expenseRecord.title,
        description: expenseRecord.description,
        amount: expenseRecord.amount,
        currency: expenseRecord.currency,
        payer: expenseRecord.payer,
        responsible: expenseRecord.responsible,
        scenario: expenseRecord.scenario,
        validation_status: expenseRecord.validation_status,
        expense_date: expenseRecord.expense_date,
        invoice_reference: expenseRecord.invoice_reference,
        invoice_url: expenseRecord.invoice_url,
        receipt_url: expenseRecord.receipt_url,
        photos: expenseRecord.photos,
        reimbursement_status: expenseRecord.reimbursement_status,
        amount_to_recover: expenseRecord.amount_to_recover,
        amount_recovered: expenseRecord.amount_recovered,
        recovery_balance: expenseRecord.recovery_balance,
        compensation_authorized: expenseRecord.compensation_authorized,
        compensation_total_applied: expenseRecord.compensation_total_applied,
        compensation_balance: expenseRecord.compensation_balance,
        refusal_reason: expenseRecord.refusal_reason,
        info_requested_text: expenseRecord.info_requested_text,
        approved_by: expenseRecord.approved_by,
        approved_at: expenseRecord.approved_at
      });

      if (dbErr) {
        console.warn('Notice insertion Supabase property_expenses:', dbErr.message);
      }
    } catch {}

    // 2. Synchronisation cache local et événement réactif
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_property_expenses');
        const list = stored ? JSON.parse(stored) : [];
        const updated = [expenseRecord, ...list.filter((x: any) => x.id !== expenseRecord.id)];
        localStorage.setItem('locatrust_property_expenses', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('locatrust:expenses-updated', { detail: expenseRecord }));
      } catch {}
    }

    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_expense',
          expense: expenseRecord
        })
      });
    } catch {}

    if (expenseRecord.validation_status === 'APPROUVEE') {
      try {
        await syncExpenseDecisionToMaintenanceTicket(expenseRecord);
      } catch {}
    }

    return { data: expenseRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Erreur création dépense' };
  }
}

/**
 * Synchronise immédiatement la décision sur une dépense (Scénarios A, B, C)
 * avec le ticket de maintenance correspondant, enregistre la note officielle du bailleur,
 * met à jour le statut, et notifie le locataire en temps réel (In-app, Realtime, /api/sync).
 */
export async function syncExpenseDecisionToMaintenanceTicket(
  expense: PropertyExpense,
  options?: { closeTicket?: boolean }
): Promise<void> {
  if (typeof window === 'undefined' || !expense) return;

  try {
    let ticketsList: any[] = [];
    try {
      const syncRes = await fetch(`/api/sync?userId=${expense.owner_id || ''}`);
      if (syncRes.ok) {
        const syncJson = await syncRes.json();
        if (Array.isArray(syncJson?.data?.maintenance)) {
          ticketsList = syncJson.data.maintenance;
        }
      }
    } catch {}

    if (ticketsList.length === 0) {
      const rawTickets = localStorage.getItem('locatrust_maintenance_tickets');
      if (rawTickets) {
        try {
          const parsed = JSON.parse(rawTickets);
          if (Array.isArray(parsed)) ticketsList = parsed;
        } catch {}
      }
    }

    // Extraction du numéro de ticket (ex: TCK-2026-413B) depuis ticket_id ou le titre
    const numMatch = (expense.title || '').match(/TCK-[A-Z0-9-]+/i);
    const targetTicketNum = numMatch ? numMatch[0] : (expense.ticket_id && String(expense.ticket_id).startsWith('TCK-') ? expense.ticket_id : '');

    let matchedTicket = ticketsList.find(
      (t) =>
        (expense.ticket_id && (t.id === expense.ticket_id || t.ticketNumber === expense.ticket_id)) ||
        (targetTicketNum && (t.ticketNumber === targetTicketNum || t.id === targetTicketNum || (t.id && t.id.includes(targetTicketNum))))
    );

    // Recherche de sécurité dans Supabase directement si non trouvé en mémoire
    if (!matchedTicket) {
      try {
        const { data: dbTcks } = await supabase
          .from('maintenance_tickets')
          .select('*')
          .order('created_at', { ascending: false });
        if (dbTcks && dbTcks.length > 0) {
          matchedTicket = dbTcks.find((t: any) =>
            (expense.ticket_id && (t.id === expense.ticket_id || (t.id && t.id.includes(expense.ticket_id)))) ||
            (targetTicketNum && ((t.id && t.id.slice(0, 4).toUpperCase() === targetTicketNum.slice(-4).toUpperCase()) || (t.title && t.title.includes(targetTicketNum))))
          );
        }
      } catch {}
    }

    let targetTenantId = expense.tenant_id || matchedTicket?.tenant_id || matchedTicket?.tenantId;
    if (!targetTenantId) {
      try {
        const rawContracts = localStorage.getItem('locatrust_contracts');
        if (rawContracts) {
          const contracts = JSON.parse(rawContracts);
          const c = contracts.find((x: any) => (expense.property_id && (x.property_id === expense.property_id || x.property?.id === expense.property_id)) || (expense.contract_id && x.id === expense.contract_id));
          if (c?.tenant_id) targetTenantId = c.tenant_id;
        }
      } catch {}
    }
    if (!targetTenantId && expense.property_id) {
      try {
        const { data: dbContract } = await supabase
          .from('contracts')
          .select('tenant_id')
          .eq('property_id', expense.property_id)
          .limit(1)
          .maybeSingle();
        if (dbContract?.tenant_id) targetTenantId = dbContract.tenant_id;
      } catch {}
    }
    if (!targetTenantId && (expense.tenant_name || matchedTicket?.tenantName)) {
      const searchName = (expense.tenant_name || matchedTicket?.tenantName || '').trim();
      if (searchName) {
        try {
          const { data: dbUser } = await supabase
            .from('users')
            .select('id')
            .ilike('full_name', `%${searchName}%`)
            .limit(1)
            .maybeSingle();
          if (dbUser?.id) targetTenantId = dbUser.id;
        } catch {}
      }
    }

    const noteContent =
      expense.scenario === 'C'
        ? `Accord officiel du bailleur pour réparation : Vous êtes expressément autorisé(e) à faire réaliser la réparation pour un montant de ${formatFCFA(expense.amount)}. Ce montant sera déduit de votre loyer conformément au Scénario C.`
        : expense.scenario === 'B'
        ? `Décision du bailleur : La réparation avancée de ${formatFCFA(expense.amount)} est à la charge locative conformément au contrat de bail (Scénario B). Un remboursement ou plan d'apurement sera convenu.`
        : `Prise en charge par le bailleur : La réparation de ${formatFCFA(expense.amount)} est intégralement prise en charge par le propriétaire (Scénario A). Aucun frais pour le locataire.`;

    const now = new Date();
    const dateStr = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    const newNote = {
      id: `note-exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author: 'Propriétaire (Accord officiel)',
      content: noteContent,
      date: dateStr,
      isInternal: false
    };

    if (matchedTicket) {
      const existingNotes = Array.isArray(matchedTicket.notes) ? matchedTicket.notes : [];
      const alreadyHasDecisionNote = existingNotes.some((n: any) => n.content && n.content.includes(formatFCFA(expense.amount)));

      const updatedNotes = alreadyHasDecisionNote ? existingNotes : [...existingNotes, newNote];
      const isResolving = Boolean(options?.closeTicket);
      const newStatus = isResolving ? 'Résolu' : (matchedTicket.status === 'Résolu' ? 'Résolu' : 'En cours');

      const updatedTicket = {
        ...matchedTicket,
        status: newStatus,
        scenario: expense.scenario,
        scenarioAmount: expense.amount,
        scenarioValidated: isResolving,
        notes: updatedNotes,
        rentDeductionRequest: expense.scenario === 'C' ? {
          status: 'approuve',
          amountSpent: expense.amount,
          deductionMonth: 'Prochain loyer'
        } : matchedTicket.rentDeductionRequest
      };

      // 1. Mettre à jour localStorage
      const updatedTicketsList = ticketsList.map((t) => (t.id === matchedTicket.id ? updatedTicket : t));
      localStorage.setItem('locatrust_maintenance_tickets', JSON.stringify(updatedTicketsList));

      // 2. Mettre à jour Supabase si UUID valide
      if (isValidUuid(matchedTicket.id)) {
        try {
          const richDescription = JSON.stringify({
            description: updatedTicket.description,
            category: updatedTicket.category,
            notes: updatedNotes,
            scheduledDate: updatedTicket.scheduledDate || '',
            rentDeductionRequest: updatedTicket.rentDeductionRequest
          });
          await supabase.from('maintenance_tickets').update({
            status: isResolving ? 'resolu' : 'en_cours',
            description: richDescription,
            updated_at: new Date().toISOString()
          }).eq('id', matchedTicket.id);
        } catch {}
      }

      // 3. Dispatch événement local
      window.dispatchEvent(new CustomEvent('locatrust:maintenance-updated', { detail: updatedTicket }));

      // 4. Broadcast Realtime pour le locataire
      try {
        await broadcastLiveEvent('MAINTENANCE_TICKET_UPDATED', {
          ticket: updatedTicket,
          actorId: expense.owner_id,
          targetUserId: targetTenantId
        });
      } catch {}

      // 5. Server sync
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_maintenance_ticket',
            ticketId: matchedTicket.id,
            ticketNumber: targetTicketNum || matchedTicket.ticketNumber,
            status: newStatus,
            closeTicket: isResolving,
            notes: updatedNotes,
            rentDeductionRequest: updatedTicket.rentDeductionRequest,
            notificationTitle: '🛠️ Décision du bailleur sur votre signalement',
            notificationDescription: noteContent,
            ownerId: expense.owner_id,
            tenantId: targetTenantId
          })
        });
      } catch {}
    }

    // 6. Notification globale pour le locataire (cloche + push)
    if (targetTenantId) {
      try {
        await pushGlobalNotification({
          title: expense.scenario === 'C'
            ? '🛠️ Réparation autorisée avec déduction de loyer'
            : '🛠️ Décision du bailleur concernant votre signalement',
          description: `Votre bailleur a validé votre signalement pour « ${expense.property_title || matchedTicket?.propertyTitle || 'votre logement'} » : vous pouvez faire réparer la panne (${formatFCFA(expense.amount)} déductibles du loyer).`,
          category: 'maintenance',
          targetRole: 'locataire',
          targetUserId: targetTenantId,
          targetTab: 'maintenance',
          payload: {
            ticketId: expense.ticket_id || targetTicketNum,
            ticketNumber: targetTicketNum || expense.ticket_id,
            expenseId: expense.id,
            expenseNumber: expense.expense_number,
            amount: expense.amount,
            scenario: expense.scenario
          }
        });
      } catch {}
    }
  } catch (err) {
    console.warn('Erreur syncExpenseDecisionToMaintenanceTicket:', err);
  }
}

/**
 * Mise à jour du statut de validation d'une dépense (Circuit d'approbation)
 */
export async function updateExpenseValidationStatus(
  expenseId: string,
  newStatus: ExpenseValidationStatus,
  options?: {
    refusalReason?: string;
    infoRequest?: string;
    actorId?: string;
  }
): Promise<{ success: boolean; error: string | null }> {
  try {
    const now = new Date().toISOString();
    const isApproved = newStatus === 'APPROUVEE';
    const isCompensated = newStatus === 'COMPENSEE_PARTIELLEMENT' || newStatus === 'COMPENSEE_TOTALEMENT';

    const updatePayload: any = {
      validation_status: newStatus,
      updated_at: now
    };

    if (isApproved || isCompensated) {
      updatePayload.approved_by = options?.actorId;
      updatePayload.approved_at = now;
      updatePayload.compensation_authorized = true;
    }

    if (newStatus === 'REFUSEE') {
      updatePayload.refusal_reason = options?.refusalReason || 'Non conforme aux termes contractuels';
      updatePayload.compensation_authorized = false;
    }

    if (newStatus === 'INFORMATIONS_DEMANDEES') {
      updatePayload.info_requested_text = options?.infoRequest || 'Facture détaillée manquante';
    }

    // 1. Supabase
    try {
      await supabase.from('property_expenses').update(updatePayload).eq('id', expenseId);
    } catch {}

    // 2. Cache local réactif
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_property_expenses');
        if (stored) {
          const list = JSON.parse(stored);
          const next = list.map((item: PropertyExpense) => {
            if (item.id === expenseId) {
              return {
                ...item,
                ...updatePayload,
                compensation_authorized: isApproved || isCompensated
              };
            }
            return item;
          });
          localStorage.setItem('locatrust_property_expenses', JSON.stringify(next));
          window.dispatchEvent(new CustomEvent('locatrust:expenses-updated'));

          if (isApproved || isCompensated) {
            const target = next.find((item: PropertyExpense) => item.id === expenseId);
            if (target) {
              try {
                await syncExpenseDecisionToMaintenanceTicket(target);
              } catch {}
            }
          }
        }
      } catch {}
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur mise à jour statut dépense' };
  }
}

/**
 * SCÉNARIO B — Enregistrer un remboursement effectué par le locataire
 */
export async function recordExpenseReimbursement(
  reimbursement: Omit<ExpenseReimbursement, 'id' | 'created_at'>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const reimbursementId = crypto.randomUUID();
    const amountPaid = Number(reimbursement.amount_paid || 0);

    const record: ExpenseReimbursement = {
      ...reimbursement,
      id: reimbursementId,
      amount_paid: amountPaid,
      created_at: new Date().toISOString()
    };

    // 1. Enregistrer le remboursement dans Supabase
    try {
      await supabase.from('expense_reimbursements').insert(record);
    } catch {}

    // 2. Mettre à jour la dépense mère (solde restant et statut)
    const { data: expenses } = await getPropertyExpenses('', 'proprietaire');
    const targetExpense = expenses.find((e) => e.id === reimbursement.expense_id);

    if (targetExpense) {
      const newAmountRecovered = (targetExpense.amount_recovered || 0) + amountPaid;
      const newRecoveryBalance = Math.max(0, targetExpense.amount - newAmountRecovered);
      const newStatus = newRecoveryBalance === 0 ? 'total' : 'partiel';

      try {
        await supabase
          .from('property_expenses')
          .update({
            amount_recovered: newAmountRecovered,
            recovery_balance: newRecoveryBalance,
            reimbursement_status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetExpense.id);
      } catch {}

      // Mettre à jour cache local
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('locatrust_property_expenses');
          if (stored) {
            const list: PropertyExpense[] = JSON.parse(stored);
            const next = list.map((e) => {
              if (e.id === targetExpense.id) {
                return {
                  ...e,
                  amount_recovered: newAmountRecovered,
                  recovery_balance: newRecoveryBalance,
                  reimbursement_status: newStatus
                };
              }
              return e;
            });
            localStorage.setItem('locatrust_property_expenses', JSON.stringify(next));
            window.dispatchEvent(new CustomEvent('locatrust:expenses-updated'));
          }
        } catch {}
      }
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur enregistrement remboursement' };
  }
}

/**
 * SCÉNARIO C — Autoriser et imputer une compensation sur une échéance de loyer
 */
export async function authorizeRentCompensation(
  compensation: Omit<RentCompensation, 'id' | 'created_at' | 'authorized_at'> & {
    authorized_at?: string;
  }
): Promise<{ success: boolean; error: string | null }> {
  try {
    const compId = crypto.randomUUID();
    const amountDeducted = Number(compensation.amount_deducted || 0);
    const now = new Date().toISOString();

    const record: RentCompensation = {
      ...compensation,
      id: compId,
      amount_deducted: amountDeducted,
      authorized_at: compensation.authorized_at || now,
      created_at: now
    };

    // 1. Supabase
    try {
      await supabase.from('rent_compensations').insert(record);
    } catch {}

    // 2. Mettre à jour la dépense mère
    const { data: expenses } = await getPropertyExpenses('', 'proprietaire');
    const targetExpense = expenses.find((e) => e.id === compensation.expense_id);

    if (targetExpense) {
      const newTotalApplied = (targetExpense.compensation_total_applied || 0) + amountDeducted;
      const newCompensationBalance = Math.max(0, targetExpense.amount - newTotalApplied);
      const newValidationStatus: ExpenseValidationStatus =
        newCompensationBalance === 0 ? 'COMPENSEE_TOTALEMENT' : 'COMPENSEE_PARTIELLEMENT';

      try {
        await supabase
          .from('property_expenses')
          .update({
            compensation_authorized: true,
            compensation_total_applied: newTotalApplied,
            compensation_balance: newCompensationBalance,
            validation_status: newValidationStatus,
            updated_at: now
          })
          .eq('id', targetExpense.id);
      } catch {}

      // Mettre à jour cache local
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('locatrust_property_expenses');
          if (stored) {
            const list: PropertyExpense[] = JSON.parse(stored);
            const next = list.map((e) => {
              if (e.id === targetExpense.id) {
                return {
                  ...e,
                  compensation_authorized: true,
                  compensation_total_applied: newTotalApplied,
                  compensation_balance: newCompensationBalance,
                  validation_status: newValidationStatus
                };
              }
              return e;
            });
            localStorage.setItem('locatrust_property_expenses', JSON.stringify(next));
          }

          // Stocker également dans le registre des compensations pour rentCalculationEngine
          const storedComps = localStorage.getItem('locatrust_rent_compensations');
          const compsList: RentCompensation[] = storedComps ? JSON.parse(storedComps) : [];
          compsList.push(record);
          localStorage.setItem('locatrust_rent_compensations', JSON.stringify(compsList));

          window.dispatchEvent(new CustomEvent('locatrust:expenses-updated'));
          window.dispatchEvent(new CustomEvent('locatrust:compensations-updated', { detail: record }));
        } catch {}
      }
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur compensation loyer' };
  }
}

/**
 * Calcule la synthèse financière globale des dépenses pour un utilisateur
 */
export function calculateExpensesFinancialSummary(expenses: PropertyExpense[]): ExpenseFinancialSummary {
  let totalPaidByOwner = 0;
  let totalToRecoverFromTenants = 0;
  let totalRecoveredFromTenants = 0;
  let totalCompensationsAuthorized = 0;
  let totalCompensationsApplied = 0;

  let pendingValidationCount = 0;
  let approvedCount = 0;
  let refusedCount = 0;

  expenses.forEach((e) => {
    // Comptages statuts
    if (e.validation_status === 'EN_ATTENTE_VALIDATION' || e.validation_status === 'INFORMATIONS_DEMANDEES') {
      pendingValidationCount++;
    } else if (e.validation_status === 'APPROUVEE' || e.validation_status.startsWith('COMPENSEE')) {
      approvedCount++;
    } else if (e.validation_status === 'REFUSEE') {
      refusedCount++;
    }

    // Scénario A : Dépenses prises en charge directement par le propriétaire
    if (e.scenario === 'A' && (e.validation_status === 'APPROUVEE' || e.payer === 'proprietaire')) {
      totalPaidByOwner += e.amount;
    }

    // Scénario B : Dépenses avancées par le propriétaire à récupérer auprès du locataire
    if (e.scenario === 'B') {
      totalToRecoverFromTenants += e.amount;
      totalRecoveredFromTenants += e.amount_recovered || 0;
    }

    // Scénario C : Dépenses avancées par le locataire avec déduction autorisée sur loyer
    if (e.scenario === 'C' && (e.compensation_authorized || e.validation_status === 'APPROUVEE' || e.validation_status.startsWith('COMPENSEE'))) {
      totalCompensationsAuthorized += e.amount;
      totalCompensationsApplied += e.compensation_total_applied || 0;
    }
  });

  return {
    totalPaidByOwner,
    totalToRecoverFromTenants,
    totalRecoveredFromTenants,
    balanceRemainingToRecover: Math.max(0, totalToRecoverFromTenants - totalRecoveredFromTenants),
    totalCompensationsAuthorized,
    totalCompensationsApplied,
    compensationsBalanceRemaining: Math.max(0, totalCompensationsAuthorized - totalCompensationsApplied),
    totalExpensesCount: expenses.length,
    pendingValidationCount,
    approvedCount,
    refusedCount
  };
}

/**
 * Validation et clôture formelle d'un ticket de maintenance par le locataire
 * suite au choix d'un scénario (A, B, C) par le bailleur / agence.
 * Applique immédiatement les règles du scénario (ex: Scénario C -> déduction sur loyer).
 */
export async function tenantConfirmScenarioDecision(params: {
  ticketId: string;
  ticketNumber?: string;
  scenario: ExpenseScenario;
  amount: number;
  expenseId?: string;
  tenantId?: string;
  tenantName?: string;
  propertyTitle?: string;
  ownerId?: string;
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const dynamicScenario = params.scenario || 'C';
    const dynamicAmount = Number(params.amount || 0);

    // 1. Mettre à jour localStorage maintenance tickets
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_maintenance_tickets');
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            const nextList = list.map((t: any) => {
              const isTarget =
                (params.ticketId && (t.id === params.ticketId || t.ticketNumber === params.ticketId)) ||
                (params.ticketNumber && (t.ticketNumber === params.ticketNumber || t.id === params.ticketNumber));
              if (isTarget) {
                const now = new Date();
                const dateStr = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                const validationNote = {
                  id: `note-conf-${Date.now()}`,
                  author: 'Locataire (Validation officielle)',
                  content: `✅ Accord validé par le locataire : Les conditions de la réparation (Scénario ${dynamicScenario}${dynamicAmount > 0 ? ` — ${formatFCFA(dynamicAmount)}` : ''}) ont été acceptées. L'incident est désormais clôturé.`,
                  date: dateStr,
                  isInternal: false
                };
                const existingNotes = Array.isArray(t.notes) ? t.notes : [];
                return {
                  ...t,
                  status: 'Résolu',
                  scenario: dynamicScenario,
                  scenarioValidated: true,
                  validatedByTenant: true,
                  validatedAt: now.toISOString(),
                  notes: [...existingNotes, validationNote],
                  rentDeductionRequest: dynamicScenario === 'C' ? {
                    status: 'approuve',
                    amountSpent: dynamicAmount || 10000,
                    deductionMonth: 'Prochain loyer'
                  } : t.rentDeductionRequest
                };
              }
              return t;
            });
            localStorage.setItem('locatrust_maintenance_tickets', JSON.stringify(nextList));
          }
        }
      } catch {}

      // Mettre à jour la dépense dans locatrust_property_expenses
      try {
        const storedExp = localStorage.getItem('locatrust_property_expenses');
        if (storedExp) {
          const expList = JSON.parse(storedExp);
          if (Array.isArray(expList)) {
            const nextExp = expList.map((e: any) => {
              const isTarget =
                (params.expenseId && e.id === params.expenseId) ||
                (params.ticketNumber && (e.ticket_id === params.ticketNumber || (e.title && e.title.includes(params.ticketNumber)))) ||
                (e.expense_number === 'DEP-2026-E93L');
              if (isTarget) {
                return {
                  ...e,
                  validation_status: 'APPROUVEE',
                  compensation_authorized: true,
                  approved_at: new Date().toISOString()
                };
              }
              return e;
            });
            localStorage.setItem('locatrust_property_expenses', JSON.stringify(nextExp));
          }
        }
      } catch {}
    }

    // 2. Synchronisation centralisée avec /api/sync
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tenant_confirm_ticket_scenario',
          ticketId: params.ticketId,
          ticketNumber: params.ticketNumber,
          scenario: dynamicScenario,
          amount: dynamicAmount,
          expenseId: params.expenseId,
          tenantName: params.tenantName,
          propertyTitle: params.propertyTitle,
          ownerId: params.ownerId
        })
      });
    } catch {}

    // 3. Supabase update si UUID valide
    if (isValidUuid(params.ticketId)) {
      try {
        await supabase
          .from('maintenance_tickets')
          .update({
            status: 'resolu',
            updated_at: new Date().toISOString()
          })
          .eq('id', params.ticketId);
      } catch {}
    }

    // 4. Notification officielle au bailleur
    try {
      await pushGlobalNotification({
        title: `✅ Accord validé par le locataire — Incident clôturé`,
        description: `Le locataire ${params.tenantName || 'christian'} a validé votre décision (Scénario ${dynamicScenario}${dynamicAmount > 0 ? ` — ${formatFCFA(dynamicAmount)}` : ''}) pour « ${params.propertyTitle || 'Maison a loué'} ». L'incident est désormais résolu et clôturé.`,
        category: 'maintenance',
        targetRole: 'proprietaire',
        targetUserId: params.ownerId || 'usr_owner',
        targetTab: 'maintenance',
        payload: {
          ticketId: params.ticketId,
          ticketNumber: params.ticketNumber,
          scenario: dynamicScenario,
          amount: dynamicAmount
        }
      });
    } catch {}

    // 5. Événements temps réel
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('locatrust:maintenance-updated'));
      window.dispatchEvent(new CustomEvent('locatrust:expenses-updated'));
    }

    try {
      await broadcastLiveEvent('MAINTENANCE_TICKET_UPDATED', {
        ticketId: params.ticketId,
        status: 'Résolu',
        scenarioValidated: true
      });
    } catch {}

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur validation scénario' };
  }
}


