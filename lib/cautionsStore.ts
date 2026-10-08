import { Deposit } from '@/types/database.types';
import { ChatMessage, getStoredMessages, saveStoredMessages } from '@/lib/messagingStore';
import { formatFCFA } from '@/lib/utils';

const STORAGE_KEY = 'locatrust_deposits_v1';

export const INITIAL_DEPOSITS: Deposit[] = [];

export function getStoredDeposits(): Deposit[] {
  if (typeof window === 'undefined') return INITIAL_DEPOSITS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_DEPOSITS;
    // Purger les données fictives de démonstration résiduelles
    if (raw.includes("Koffi N'Guessan") || raw.includes('000492') || raw.includes('Amina Diabaté')) {
      localStorage.removeItem(STORAGE_KEY);
      return INITIAL_DEPOSITS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_DEPOSITS;
  } catch (err) {
    console.error('Error loading deposits from localStorage:', err);
    return INITIAL_DEPOSITS;
  }
}

export function saveStoredDeposits(deposits: Deposit[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deposits));
    window.dispatchEvent(new CustomEvent('locatrust:cautions_updated'));
  } catch (err) {
    console.error('Error saving deposits to localStorage:', err);
  }
}

export function declareCautionPayment(params: {
  contractId: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  reference: string;
  method: string;
  proofUrl?: string;
  comment?: string;
}): Deposit {
  const all = getStoredDeposits();
  const existing = all.find((d) => d.contract_id === params.contractId || d.tenant_id === params.tenantId);

  const now = new Date().toISOString();
  let updatedDeposit: Deposit;

  if (existing) {
    updatedDeposit = {
      ...existing,
      amount_paid: params.amount,
      status: 'caution_a_confirmer',
      declared_at: now,
      declared_reference: params.reference,
      proof_url: params.proofUrl || existing.proof_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
      comment: params.comment || existing.comment,
      refusal_reason: undefined
    };
    const updatedList = all.map((d) => (d.id === existing.id ? updatedDeposit : d));
    saveStoredDeposits(updatedList);
  } else {
    updatedDeposit = {
      id: `dep_${Date.now()}`,
      contract_id: params.contractId,
      tenant_id: params.tenantId,
      owner_id: 'usr_owner_1',
      amount_requested: params.amount,
      amount_paid: params.amount,
      status: 'caution_a_confirmer',
      declared_at: now,
      declared_reference: params.reference,
      proof_url: params.proofUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
      comment: params.comment,
      restitution_status: 'conserve',
      created_at: now,
      tenant: {
        id: params.tenantId,
        role: 'locataire',
        full_name: params.tenantName,
        email: `${params.tenantName.toLowerCase().replace(/\s+/g, '.')}@locatrust.ci`,
        phone: '+225 07 08 09 10 11',
        verification_status: 'verifie',
        created_at: now
      },
      property: {
        id: 'prop_1',
        owner_id: 'usr_owner_1',
        type: 'appartement',
        title: 'Appartement 3 pièces Cocody Riviera 3',
        description: 'Appartement de standing',
        surface: 120,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 2,
        rent: params.amount / 2,
        caution: params.amount,
        charges: 25000,
        furnished: true,
        equipments: ['Climatisation'],
        status: 'loue',
        created_at: now
      }
    };
    saveStoredDeposits([updatedDeposit, ...all]);
  }

  // Record audit entry
  recordCautionAudit({
    action: 'declaration_caution',
    contractId: params.contractId,
    tenantName: params.tenantName,
    amount: params.amount,
    date: now,
    details: `Déclaration de versement de caution de ${params.amount} FCFA via ${params.method} (Réf: ${params.reference})`
  });

  return updatedDeposit;
}

export function confirmCautionReceipt(depositId: string, confirmedBy: string = 'Bailleur'): Deposit | null {
  const all = getStoredDeposits();
  const target = all.find((d) => d.id === depositId);
  if (!target) return null;

  const now = new Date().toISOString();
  const updatedDeposit: Deposit = {
    ...target,
    status: target.amount_paid >= target.amount_requested ? 'paye_complet' : 'paye_partiel',
    confirmed_by: confirmedBy,
    confirmed_at: now
  };

  const updatedList = all.map((d) => (d.id === depositId ? updatedDeposit : d));
  saveStoredDeposits(updatedList);

  // Record audit entry
  recordCautionAudit({
    action: 'confirmation_caution',
    contractId: target.contract_id,
    tenantName: target.tenant?.full_name || 'Locataire',
    confirmedBy,
    amount: target.amount_paid,
    date: now,
    details: `Réception de caution de ${target.amount_paid} FCFA officiellement confirmée par ${confirmedBy}`
  });

  return updatedDeposit;
}

export function rejectCautionPayment(depositId: string, refusalReason: string): Deposit | null {
  const all = getStoredDeposits();
  const target = all.find((d) => d.id === depositId);
  if (!target) return null;

  const now = new Date().toISOString();
  const updatedDeposit: Deposit = {
    ...target,
    status: 'refuse',
    refusal_reason: refusalReason
  };

  const updatedList = all.map((d) => (d.id === depositId ? updatedDeposit : d));
  saveStoredDeposits(updatedList);

  recordCautionAudit({
    action: 'declaration_caution',
    contractId: target.contract_id,
    tenantName: target.tenant?.full_name || 'Locataire',
    amount: target.amount_paid,
    date: now,
    details: `Signalement de caution refusé par le bailleur. Motif : ${refusalReason}`
  });

  return updatedDeposit;
}

export function signCautionReceipt(depositId: string, party: 'owner' | 'tenant', signatureData: string): Deposit | null {
  const all = getStoredDeposits();
  const target = all.find((d) => d.id === depositId);
  if (!target) return null;

  const now = new Date().toISOString();
  const updatedDeposit: Deposit = {
    ...target,
    ...(party === 'owner'
      ? { owner_signature: signatureData, owner_signed_at: now }
      : { tenant_signature: signatureData, tenant_signed_at: now })
  };

  const updatedList = all.map((d) => (d.id === depositId ? updatedDeposit : d));
  saveStoredDeposits(updatedList);
  return updatedDeposit;
}

export function sendCautionReceiptToTenant(depositId: string): Deposit | null {
  const all = getStoredDeposits();
  const target = all.find((d) => d.id === depositId);
  if (!target) return null;

  const now = new Date().toISOString();
  const updatedDeposit: Deposit = {
    ...target,
    receipt_sent_to_tenant: true
  };

  const updatedList = all.map((d) => (d.id === depositId ? updatedDeposit : d));
  saveStoredDeposits(updatedList);

  try {
    const existingMessages = getStoredMessages();
    const chatText = `Reçu officiel de caution disponible\nVotre caution de ${formatFCFA(target.amount_paid)} pour le contrat ${target.contract_id} a été validée.\nLe reçu officiel est prêt. Veuillez apposer votre signature pour valider le document.`;
    const msg: ChatMessage = {
      id: `msg_caution_receipt_${Date.now()}`,
      sender_id: target.owner_id || 'usr_owner_1',
      receiver_id: target.tenant_id,
      text: chatText,
      created_at: now,
      status: 'delivered'
    };
    saveStoredMessages([...existingMessages, msg]);
    window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
  } catch (err) {
    console.error('Error dispatching message:', err);
  }

  return updatedDeposit;
}

export function signRestitutionReceipt(depositId: string, party: 'owner' | 'tenant', signatureData: string): Deposit | null {
  const all = getStoredDeposits();
  const target = all.find((d) => d.id === depositId);
  if (!target) return null;

  const now = new Date().toISOString();
  const updatedDeposit: Deposit = {
    ...target,
    ...(party === 'owner'
      ? { restitution_owner_signature: signatureData, restitution_owner_signed_at: now }
      : { restitution_tenant_signature: signatureData, restitution_tenant_signed_at: now })
  };

  const updatedList = all.map((d) => (d.id === depositId ? updatedDeposit : d));
  saveStoredDeposits(updatedList);
  return updatedDeposit;
}

export function sendRestitutionReceiptToTenant(depositId: string): Deposit | null {
  const all = getStoredDeposits();
  const target = all.find((d) => d.id === depositId);
  if (!target) return null;

  const now = new Date().toISOString();
  const updatedDeposit: Deposit = {
    ...target,
    restitution_receipt_sent_to_tenant: true
  };

  const updatedList = all.map((d) => (d.id === depositId ? updatedDeposit : d));
  saveStoredDeposits(updatedList);

  try {
    const existingMessages = getStoredMessages();
    const isImp = target.restitution_status === 'impute_loyers';
    const chatText = isImp
      ? `Attestation d'imputation sur préavis émise\nVotre caution a été imputée sur vos loyers de préavis. Veuillez apposer votre signature pour validation conjointe.`
      : `Reçu officiel de restitution de caution émis\nLe décompte de restitution de caution est disponible. Veuillez apposer votre signature pour finaliser la procédure.`;

    const msg: ChatMessage = {
      id: `msg_restitution_receipt_${Date.now()}`,
      sender_id: target.owner_id || 'usr_owner_1',
      receiver_id: target.tenant_id,
      text: chatText,
      created_at: now,
      status: 'delivered'
    };
    saveStoredMessages([...existingMessages, msg]);
    window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
  } catch (err) {
    console.error('Error dispatching restitution message:', err);
  }

  return updatedDeposit;
}


export function restituteCaution(params: {
  depositId: string;
  restitutionMode?: 'integrale' | 'partielle' | 'imputation_loyers';
  amountRestituted: number;
  deductionAmount: number;
  deductionReason?: string;
  restitutionDate: string;
  paymentMethod: string;
  monthsCovered?: string;
  confirmedBy?: string;
}): { updatedDeposit: Deposit; receiptNumber: string } | null {
  const all = getStoredDeposits();
  const target = all.find((d) => d.id === params.depositId);
  if (!target) return null;

  const now = new Date().toISOString();
  const receiptCount = Math.floor(100000 + Math.random() * 900000);
  const isImputation = params.restitutionMode === 'imputation_loyers';
  const prefix = isImputation ? 'IMP-2026-' : 'RRC-2026-';
  const receiptNumber = `${prefix}${receiptCount}`;

  const isPartial = params.deductionAmount > 0 && !isImputation;
  const status: Deposit['restitution_status'] = isImputation
    ? 'impute_loyers'
    : isPartial
    ? 'restitue_partiel'
    : 'restitue_total';

  const updatedDeposit: Deposit = {
    ...target,
    restitution_status: status,
    amount_restituted: isImputation ? 0 : params.amountRestituted,
    deduction_amount: isImputation ? target.amount_paid : params.deductionAmount,
    deduction_reason: isImputation
      ? `Conservation de la caution pour compensation des loyers de préavis (${params.monthsCovered || 'Période de préavis'}). Aucun loyer à payer pour le locataire.`
      : params.deductionReason,
    restituted_at: params.restitutionDate || now
  };

  const updatedList = all.map((d) => (d.id === params.depositId ? updatedDeposit : d));
  saveStoredDeposits(updatedList);

  // 1. Audit trail record
  const auditDetails = isImputation
    ? `Caution de ${formatFCFA(target.amount_paid)} conservée et imputée sur les loyers de préavis (${params.monthsCovered || 'Préavis de fin de bail'}). Le locataire est dispensé du paiement des loyers pour cette période. Attestation N° ${receiptNumber}.`
    : `Restitution de caution ${isPartial ? 'partielle' : 'totale'} : ${formatFCFA(params.amountRestituted)} restitués${
        params.deductionAmount > 0 ? ` (Retenue: ${formatFCFA(params.deductionAmount)}, Motif: ${params.deductionReason})` : ''
      }. Reçu N° ${receiptNumber}.`;

  recordCautionAudit({
    action: 'restitution_caution',
    contractId: target.contract_id,
    tenantName: target.tenant?.full_name || 'Locataire',
    confirmedBy: params.confirmedBy || 'Bailleur',
    amount: isImputation ? target.amount_paid : params.amountRestituted,
    date: params.restitutionDate || now,
    details: auditDetails
  });

  // 2. Automatic System Message into Tenant's internal LocaTrust chat
  try {
    const existingMessages = getStoredMessages();
    const chatText = isImputation
      ? `Accord sur la caution — Préavis de fin de bail\nVotre bailleur a affecté votre caution de ${formatFCFA(target.amount_paid)} au règlement de vos derniers mois de loyer (${params.monthsCovered || 'période de préavis'}).\nVous n'avez aucun loyer à décaisser pour ces mois.`
      : `Restitution de caution\nVotre caution concernant le contrat ${target.contract_id} a été restituée.\nMontant restitué : ${formatFCFA(params.amountRestituted)}.${
          params.deductionAmount > 0 ? `\nRetenue : ${formatFCFA(params.deductionAmount)} (Motif : ${params.deductionReason})` : ''
        }`;

    const restitutionMessage: ChatMessage = {
      id: `msg_restitution_${Date.now()}`,
      sender_id: target.owner_id || 'usr_owner_1',
      receiver_id: target.tenant_id,
      text: chatText,
      created_at: now,
      restitution: {
        receiptNumber,
        contractNumber: target.contract_id,
        propertyTitle: target.property?.title || 'Logement LocaTrust',
        propertyAddress: target.property?.description || 'Cocody, Abidjan',
        initialCautionAmount: target.amount_paid,
        amountRestituted: isImputation ? 0 : params.amountRestituted,
        deductionAmount: isImputation ? target.amount_paid : params.deductionAmount,
        deductionReason: isImputation
          ? `Imputation sur loyers de préavis (${params.monthsCovered || 'Période préavis'})`
          : params.deductionReason,
        restitutionDate: params.restitutionDate || new Date().toLocaleDateString('fr-FR'),
        restitutionMethod: isImputation ? 'Compensation de loyers' : (params.paymentMethod || 'Wave CI'),
        ownerName: params.confirmedBy || 'Bailleur',
        tenantName: target.tenant?.full_name || 'Locataire',
        operationType: isImputation ? 'IMPUTATION_LOYERS' : 'RESTITUTION_CAUTION'
      },
      status: 'delivered'
    };

    saveStoredMessages([...existingMessages, restitutionMessage]);
    window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
  } catch (err) {
    console.error('Error dispatching restitution message to tenant chat:', err);
  }

  return { updatedDeposit, receiptNumber };
}

export interface CautionAuditEntry {
  id: string;
  action: 'declaration_caution' | 'confirmation_caution' | 'restitution_caution';
  contractId: string;
  tenantName: string;
  confirmedBy?: string;
  amount: number;
  date: string;
  details: string;
}

const AUDIT_STORAGE_KEY = 'locatrust_cautions_audit_v1';

export function getCautionAuditTrail(): CautionAuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordCautionAudit(entry: Omit<CautionAuditEntry, 'id'>): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getCautionAuditTrail();
    const newEntry: CautionAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    };
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([newEntry, ...list]));
  } catch (err) {
    console.error('Error saving caution audit log:', err);
  }
}
