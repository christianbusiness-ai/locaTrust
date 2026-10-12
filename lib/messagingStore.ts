'use client';

import { generateOfficialReceiptPDF, OfficialReceiptData } from '@/lib/payments/officialReceiptPdfGenerator';
import { triggerCelebration } from '@/lib/celebration';

export interface ChatQuittanceAttachment {
  receiptNumber: string;
  contractNumber: string;
  propertyTitle: string;
  propertyAddress: string;
  amount: number;
  periodCovered: string;
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string;
  ownerName: string;
  tenantName: string;
  ownerSignatureUrl?: string | null;
  tenantSignatureUrl?: string | null;
}

export interface ChatContractAttachment {
  contractNumber: string;
  propertyTitle: string;
  propertyAddress: string;
  rentAmount: number;
  cautionAmount: number;
  durationMonths: number;
  startDate: string;
  ownerName: string;
  tenantName: string;
  ownerSigned: boolean;
  tenantSigned: boolean;
}

export interface ChatAttachment {
  type: 'image' | 'document' | 'audio';
  url: string;
  name?: string;
  size?: string;
  duration?: number;
}

export interface ChatRestitutionAttachment {
  receiptNumber: string;
  contractNumber: string;
  propertyTitle: string;
  propertyAddress: string;
  initialCautionAmount: number;
  amountRestituted: number;
  deductionAmount: number;
  deductionReason?: string;
  restitutionDate: string;
  restitutionMethod: string;
  ownerName: string;
  tenantName: string;
  operationType: 'RESTITUTION_CAUTION';
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  media_url?: string;
  created_at: string;
  quittance?: ChatQuittanceAttachment;
  contract?: ChatContractAttachment;
  restitution?: ChatRestitutionAttachment;
  reminderContractNumber?: string;
  attachment?: ChatAttachment;
  status?: 'sent' | 'delivered' | 'read';
}

export interface ChatContact {
  id: string;
  name: string;
  phone: string;
  role: string;
  propertyTitle: string;
  avatar: string;
  online: boolean;
  lastSeen?: string;
  unreadCount?: number;
}

export const OWNER_CHAT_CONTACTS: ChatContact[] = [];

export const TENANT_CHAT_CONTACTS: ChatContact[] = [
  {
    id: 'usr_support',
    name: 'Support LocaTrust',
    phone: '+225 25 20 00 11 22',
    role: 'Assistance Client 24/7',
    propertyTitle: 'Support Technique & Juridique',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
    online: true
  }
];

export const AGENCY_CHAT_CONTACTS: ChatContact[] = [];

export const CHAT_CONTACTS: ChatContact[] = [];

export const DEFAULT_MESSAGES: ChatMessage[] = [];

const STORAGE_KEY = 'locatrust_chat_messages_v4';
const RECEIPTS_STORAGE_KEY = 'locatrust_tenant_receipts_v2';

export function getStoredMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data || data === 'null' || data === 'undefined') {
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Nettoyage automatique des messages de démonstration fictifs (Kouassi Jean-Philippe, Awa Touré, usr_tenant_1, usr_owner_1)
    const cleaned = parsed.filter((m: any) => {
      if (!m) return false;
      if (m.sender_id === 'usr_tenant_1' || m.receiver_id === 'usr_tenant_1') return false;
      if (m.sender_id === 'usr_owner_1' || m.receiver_id === 'usr_owner_1') return false;
      if (m.text && (m.text.includes('Kouassi Jean-Philippe') || m.text.includes('Awa Touré'))) return false;
      return true;
    });

    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

export function saveStoredMessages(messages: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
  } catch (e) {
    console.error('Failed to save stored messages:', e);
  }
}

export function sendChatMessage(senderId: string, receiverId: string, text: string): ChatMessage {
  const current = getStoredMessages();
  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    sender_id: senderId,
    receiver_id: receiverId,
    text,
    created_at: new Date().toISOString(),
    status: 'delivered'
  };
  const updated = [...current, newMsg];
  saveStoredMessages(updated);

  // Émission d'une notification push in-app pour le destinataire
  if (typeof window !== 'undefined') {
    try {
      const notifsRaw = localStorage.getItem('locatrust_notifications');
      const currentNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
      let senderName = 'Correspondant';
      const contactRaw = localStorage.getItem(`locatrust_contact_${senderId}`);
      if (contactRaw) {
        try { senderName = JSON.parse(contactRaw).name || senderName; } catch {}
      }
      const notifItem = {
        id: `notif_msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `Nouveau message de ${senderName}`,
        description: text.length > 70 ? `${text.slice(0, 70)}...` : text,
        timestamp: "À l'instant",
        category: 'demande',
        read: false,
        targetTab: 'messages'
      };
      const combinedNotifs = [notifItem, ...currentNotifs.slice(0, 49)];
      localStorage.setItem('locatrust_notifications', JSON.stringify(combinedNotifs));
      window.dispatchEvent(
        new CustomEvent('locatrust:notifications-updated', {
          detail: { notifications: combinedNotifs }
        })
      );
    } catch (e) {
      // Ignore notification write error
    }
  }

  return newMsg;
}

export function markMessagesAsRead(contactId: string, currentUserId?: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = getStoredMessages();
  let changed = false;

  const updated = current.map((m) => {
    // Tout message reçu de ce contact
    const isFromContact = m.sender_id === contactId;

    if (isFromContact && m.status !== 'read') {
      changed = true;
      return { ...m, status: 'read' as const };
    }
    return m;
  });

  if (changed) {
    saveStoredMessages(updated);
    return true;
  }
  return false;
}

export function markAllMessagesAsReadForUser(currentUserId?: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = getStoredMessages();
  let changed = false;

  const updated = current.map((m) => {
    // Tout message non lu qui n'a pas été envoyé par l'utilisateur courant
    const isFromMe = Boolean(currentUserId && m.sender_id === currentUserId);
    if (!isFromMe && m.status !== 'read') {
      changed = true;
      return { ...m, status: 'read' as const };
    }
    return m;
  });

  if (changed) {
    saveStoredMessages(updated);
    return true;
  }
  return false;
}

export function getUnreadMessagesCountForUser(user?: { id?: string; email?: string; role?: string } | null): number {
  if (typeof window === 'undefined') return 0;
  const messages = getStoredMessages();
  if (!Array.isArray(messages) || messages.length === 0) return 0;

  const role = user?.role || 'proprietaire';
  const userId = user?.id || '';
  const userEmail = (user?.email || '').toLowerCase();
  const defaultId = role === 'locataire' ? 'usr_tenant' : role === 'agence' ? 'usr_agency' : 'usr_owner';

  return messages.filter((m) => {
    // Si déjà lu, pas compté
    if (m.status === 'read') return false;

    // Ne jamais compter ses propres messages envoyés
    const isFromMe = (userId && m.sender_id === userId) || m.sender_id === defaultId || m.sender_id === 'usr_owner' || m.sender_id === 'usr_tenant';
    if (isFromMe) return false;

    // Le message doit être adressé à l'utilisateur
    const isForMe =
      (userId && m.receiver_id === userId) ||
      (userEmail && m.receiver_id === userEmail) ||
      (!userId && (m.receiver_id === defaultId || m.receiver_id === 'usr_tenant' || m.receiver_id === 'usr_owner'));

    return isForMe;
  }).length;
}

export function sendQuittanceToTenant(quittance: ChatQuittanceAttachment, senderId?: string, receiverId?: string): ChatMessage {
  const current = getStoredMessages();
  const newMsg: ChatMessage = {
    id: `msg_quittance_${Date.now()}`,
    sender_id: senderId || 'usr_owner',
    receiver_id: receiverId || 'usr_tenant',
    text: `📄 Quittance de Loyer Officielle Émise (N° ${quittance.receiptNumber})\nVotre bailleur a validé votre règlement et a apposé sa signature manuscrite certifiée. La quittance est disponible au téléchargement.`,
    created_at: new Date().toISOString(),
    quittance,
    status: 'delivered'
  };

  const updated = [...current, newMsg];
  saveStoredMessages(updated);

  // Also persist in tenant receipts store
  try {
    if (typeof window !== 'undefined') {
      const existingReceipts = getStoredTenantReceipts();
      const exists = existingReceipts.some((r) => r.receiptNumber === quittance.receiptNumber);
      if (!exists) {
        const updatedReceipts = [quittance, ...existingReceipts];
        localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(updatedReceipts));
        window.dispatchEvent(new CustomEvent('locatrust:receipts_updated'));
      }
    }
  } catch (e) {
    console.error('Error saving tenant receipt:', e);
  }

  return newMsg;
}

export function getStoredTenantReceipts(): ChatQuittanceAttachment[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(RECEIPTS_STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse stored tenant receipts:', e);
    return [];
  }
}

export function sendContractToTenant(tenantId: string, contract: ChatContractAttachment, senderId?: string): ChatMessage {
  const current = getStoredMessages();
  const newMsg: ChatMessage = {
    id: `msg_contract_${Date.now()}`,
    sender_id: senderId || 'usr_owner',
    receiver_id: tenantId,
    text: `📑 Contrat de Bail Officiel Transmis (N° ${contract.contractNumber})\nVotre propriétaire vous a transmis le bail d'habitation pour le logement : ${contract.propertyTitle}.\nVeuillez consulter les articles et apposer votre signature électronique pour officialiser la location.`,
    created_at: new Date().toISOString(),
    contract,
    status: 'delivered'
  };

  const updated = [...current, newMsg];
  saveStoredMessages(updated);
  return newMsg;
}

export function sendContractReminderToTenant(
  tenantId: string,
  contractNumber: string,
  tenantName: string,
  propertyTitle: string,
  senderId?: string
): ChatMessage {
  const current = getStoredMessages();
  const newMsg: ChatMessage = {
    id: `msg_reminder_${Date.now()}`,
    sender_id: senderId || 'usr_owner',
    receiver_id: tenantId,
    text: `⚠️ RAPPEL DE SIGNATURE : Contrat N° ${contractNumber}\nBonjour ${tenantName}, votre bailleur a déjà signé et validé le bail pour « ${propertyTitle} ». Votre signature électronique est attendue pour finaliser officiellement l'entrée dans les lieux.`,
    created_at: new Date().toISOString(),
    reminderContractNumber: contractNumber,
    status: 'delivered'
  };

  const updated = [...current, newMsg];
  saveStoredMessages(updated);
  return newMsg;
}

export async function downloadQuittancePdfFromAttachment(q: ChatQuittanceAttachment) {
  const pdfData: OfficialReceiptData = {
    receiptNumber: q.receiptNumber,
    contractNumber: q.contractNumber,
    contractToken: 'tok_cnt_ci2026_000123',
    propertyTitle: q.propertyTitle,
    propertyAddress: q.propertyAddress,
    propertyReference: 'BIEN-000456',
    propertyType: 'Appartement 3 pièces',
    durationMonths: 12,
    leaseStartDate: '01/10/2026',
    leaseEndDate: '30/09/2027',
    ownerName: q.ownerName,
    ownerCni: 'CI987654321',
    ownerPhone: '05 05 43 21 00',
    tenantName: q.tenantName,
    tenantCni: 'CI123456789',
    tenantPhone: '07 00 12 34 56',
    amount: q.amount,
    periodCovered: q.periodCovered,
    paymentDate: q.paymentDate,
    paymentMethod: q.paymentMethod,
    transactionReference: q.transactionReference,
    ownerSignatureUrl: q.ownerSignatureUrl,
    tenantSignatureUrl: q.tenantSignatureUrl
  };

  await generateOfficialReceiptPDF(pdfData);
}
