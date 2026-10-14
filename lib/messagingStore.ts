'use client';

import { generateOfficialReceiptPDF, OfficialReceiptData } from '@/lib/payments/officialReceiptPdfGenerator';
import { triggerCelebration } from '@/lib/celebration';
import { supabase } from '@/src/lib/supabase';

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
  ownerSignatureUrl?: string | null;
  tenantSignatureUrl?: string | null;
  surface?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  equipments?: string[];
  amenities?: string[];
  propertyDescription?: string;
  leaseType?: 'habitation' | 'professionnel';
  usageDestination?: 'habitation' | 'professionnel';
  authorizedActivity?: string;
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
  operationType: 'RESTITUTION_CAUTION' | 'IMPUTATION_LOYERS';
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

const isValidUuid = (str?: string) =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

// Synchronisation asynchrone sécurisée avec Supabase Realtime & DB
export async function syncMessageToSupabase(
  newMsg: ChatMessage,
  senderId: string,
  receiverId: string,
  text: string,
  propertyId?: string
) {
  try {
    // 1. Diffusion Realtime immédiate via channel Supabase
    try {
      const channel = supabase.channel('locatrust_chat_realtime');
      channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: { ...newMsg, senderId, receiverId }
      });
    } catch {}

    // 2. Persistance BDD si identifiants UUID valides
    if (isValidUuid(senderId) && isValidUuid(receiverId)) {
      // Trouver ou créer la conversation
      let convId: string | null = null;
      const { data: convData } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(tenant_id.eq.${senderId},owner_id.eq.${receiverId}),and(tenant_id.eq.${receiverId},owner_id.eq.${senderId})`)
        .maybeSingle();

      if (convData?.id) {
        convId = convData.id;
      } else {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            tenant_id: senderId,
            owner_id: receiverId,
            property_id: isValidUuid(propertyId) ? propertyId : undefined
          })
          .select('id')
          .maybeSingle();
        if (newConv?.id) convId = newConv.id;
      }

      if (convId) {
        await supabase.from('messages').insert({
          conversation_id: convId,
          sender_id: senderId,
          content: text,
          status: 'delivered'
        });

        // Persistance de la notification en BDD
        await supabase.from('notifications').insert({
          user_id: receiverId,
          title: 'Nouveau message reçu',
          message: text.length > 100 ? `${text.slice(0, 97)}...` : text,
          type: 'info',
          is_read: false
        });
      }
    }
  } catch (err) {
    console.warn('Notice sync Supabase chat:', err);
  }
}

export function sendChatMessage(
  senderId: string,
  receiverId: string,
  text: string,
  options?: { propertyId?: string; propertyTitle?: string; attachment?: any; contract?: any; quittance?: any; restitution?: any }
): ChatMessage {
  const current = getStoredMessages();
  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender_id: senderId,
    receiver_id: receiverId,
    text,
    created_at: new Date().toISOString(),
    status: 'delivered',
    attachment: options?.attachment,
    contract: options?.contract,
    quittance: options?.quittance,
    restitution: options?.restitution
  };
  const updated = [...current, newMsg];
  saveStoredMessages(updated);

  // Synchronisation BDD & Realtime
  syncMessageToSupabase(newMsg, senderId, receiverId, text, options?.propertyId);

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
        category: 'demande' as const,
        read: false,
        targetTab: 'messages',
        targetUserId: receiverId,
        senderUserId: senderId
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

export async function sendRealChatMessage(
  senderId: string,
  receiverId: string,
  text: string,
  options?: { propertyId?: string; propertyTitle?: string; attachment?: any; contract?: any; quittance?: any; restitution?: any }
): Promise<ChatMessage> {
  const msg = sendChatMessage(senderId, receiverId, text, options);
  // Attendre la tentative de synchronisation réseau
  await syncMessageToSupabase(msg, senderId, receiverId, text, options?.propertyId);
  return msg;
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
      return { ...m, status: 'read' as const, is_read: true, read_at: new Date().toISOString() };
    }
    return m;
  });

  if (changed) {
    saveStoredMessages(updated);
    if (isValidUuid(contactId)) {
      try {
        supabase.from('messages').update({ status: 'read' }).eq('sender_id', contactId).then(() => {});
      } catch {}
    }
    return true;
  }
  return false;
}

export function markAllMessagesAsReadForUser(currentUserId?: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = getStoredMessages();
  let changed = false;

  const updated = current.map((m) => {
    const isFromMe = Boolean(currentUserId && m.sender_id === currentUserId);
    if (!isFromMe && m.status !== 'read') {
      changed = true;
      return { ...m, status: 'read' as const, is_read: true, read_at: new Date().toISOString() };
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

  // Identifiants appartenant à l'utilisateur connecté
  const myIds = new Set<string>();
  if (userId) myIds.add(userId);
  if (userEmail) myIds.add(userEmail);
  myIds.add(defaultId);
  if (role === 'locataire') myIds.add('usr_tenant');
  if (role === 'proprietaire') myIds.add('usr_owner');
  if (role === 'agence') {
    myIds.add('usr_agency');
    myIds.add('usr_owner');
  }

  return messages.filter((m) => {
    // Message déjà lu
    if (m.status === 'read' || (m as any).is_read) return false;

    // Ne JAMAIS compter ses propres messages envoyés
    if (myIds.has(m.sender_id)) return false;

    // Le message doit être adressé à l'utilisateur connecté
    const isForMe = myIds.has(m.receiver_id);
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

  // Synchronisation Supabase & Realtime pour la quittance
  syncMessageToSupabase(newMsg, senderId || 'usr_owner', receiverId || 'usr_tenant', newMsg.text);

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
  const finalSenderId = senderId || 'usr_owner';
  const newMsg: ChatMessage = {
    id: `msg_contract_${Date.now()}`,
    sender_id: finalSenderId,
    receiver_id: tenantId,
    text: `📑 Contrat de Bail Officiel Transmis (N° ${contract.contractNumber})\nVotre bailleur vous a transmis le bail d'habitation pour le logement : ${contract.propertyTitle}.\nVeuillez consulter les articles et apposer votre signature électronique pour officialiser la location.`,
    created_at: new Date().toISOString(),
    contract,
    status: 'delivered'
  };

  const updated = [...current, newMsg];
  saveStoredMessages(updated);

  // Synchronisation Supabase & Realtime pour le contrat
  syncMessageToSupabase(newMsg, finalSenderId, tenantId, newMsg.text);

  // Sauvegarder immédiatement les contacts dans le localStorage pour que la conversation apparaisse des deux côtés
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`locatrust_contact_${finalSenderId}`, JSON.stringify({
        id: finalSenderId,
        name: contract.ownerName,
        phone: '+225 07 00 00 00 00',
        role: contract.ownerName.toLowerCase().includes('agence') ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur',
        propertyTitle: contract.propertyTitle,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(contract.ownerName)}&background=1E40AF&color=fff`,
        online: true
      }));

      localStorage.setItem(`locatrust_contact_${tenantId}`, JSON.stringify({
        id: tenantId,
        name: contract.tenantName,
        phone: '+225 05 00 00 00 00',
        role: 'Locataire Preneur',
        propertyTitle: contract.propertyTitle,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(contract.tenantName)}&background=059669&color=fff`,
        online: true
      }));

      // Notification push in-app ciblée EXCLUSIVEMENT pour le locataire
      const notifsRaw = localStorage.getItem('locatrust_notifications');
      const currentNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
      const notifItem = {
        id: `notif_cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `Bail officiel reçu pour signature (N° ${contract.contractNumber})`,
        description: `${contract.ownerName} vous a transmis le bail pour « ${contract.propertyTitle} ». Veuillez y apposer votre signature certifiée.`,
        timestamp: "À l'instant",
        category: 'contrat' as const,
        read: false,
        targetTab: 'messages',
        targetUserId: tenantId,
        senderUserId: finalSenderId
      };
      const combinedNotifs = [notifItem, ...currentNotifs.slice(0, 49)];
      localStorage.setItem('locatrust_notifications', JSON.stringify(combinedNotifs));
      window.dispatchEvent(
        new CustomEvent('locatrust:notifications-updated', {
          detail: { notifications: combinedNotifs }
        })
      );
    } catch (e) {
      console.warn('Error saving contacts/notification on contract send:', e);
    }
  }

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

export async function fetchSupabaseMessages(userId: string): Promise<ChatMessage[]> {
  if (!isValidUuid(userId) || typeof window === 'undefined') return [];
  try {
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('id, tenant_id, owner_id')
      .or(`tenant_id.eq.${userId},owner_id.eq.${userId}`);

    if (convErr || !convs || convs.length === 0) return [];

    const convIds = convs.map((c) => c.id);
    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true });

    if (msgErr || !msgs) return [];

    const convMap = new Map<string, { tenant_id: string; owner_id: string }>();
    convs.forEach((c) => convMap.set(c.id, c));

    const currentLocal = getStoredMessages();
    const existingIds = new Set(currentLocal.map((m) => m.id));
    const newFromDb: ChatMessage[] = [];

    msgs.forEach((m: any) => {
      const conv = convMap.get(m.conversation_id);
      const isSender = m.sender_id === userId;
      const otherId = conv ? (conv.tenant_id === userId ? conv.owner_id : conv.tenant_id) : 'usr_contact';
      const receiverId = isSender ? otherId : userId;

      let parsedContract: any = undefined;
      let parsedQuittance: any = undefined;
      let parsedRestitution: any = undefined;
      let parsedAttachment: any = undefined;

      try {
        if (m.content && m.content.startsWith('{') && m.content.includes('"type":')) {
          const parsed = JSON.parse(m.content);
          if (parsed.contract) parsedContract = parsed.contract;
          if (parsed.quittance) parsedQuittance = parsed.quittance;
          if (parsed.restitution) parsedRestitution = parsed.restitution;
          if (parsed.attachment) parsedAttachment = parsed.attachment;
        }
      } catch {}

      const formatted: ChatMessage = {
        id: m.id,
        sender_id: m.sender_id,
        receiver_id: receiverId,
        text: m.content || '',
        created_at: m.created_at,
        status: m.status || 'delivered',
        contract: parsedContract,
        quittance: parsedQuittance,
        restitution: parsedRestitution,
        attachment: parsedAttachment || (m.attachment_url ? { type: 'document', url: m.attachment_url } : undefined)
      };

      if (!existingIds.has(m.id)) {
        newFromDb.push(formatted);
      }
    });

    if (newFromDb.length > 0) {
      const merged = [...currentLocal, ...newFromDb];
      saveStoredMessages(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Erreur synchronisation messages Supabase:', err);
  }
  return [];
}
