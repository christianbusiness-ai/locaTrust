'use client';

import { generateOfficialReceiptPDF, OfficialReceiptData } from '@/lib/payments/officialReceiptPdfGenerator';
import { triggerCelebration } from '@/lib/celebration';
import { supabase } from '@/src/lib/supabase';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { getDefaultRealisticAvatar } from '@/lib/avatarHelper';

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

export interface ChatDeclarationAttachment {
  type: 'caution' | 'loyer';
  declarationId: string;
  contractNumber: string;
  propertyTitle: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  date: string;
  tenantName: string;
  tenantId: string;
  ownerId: string;
  proofUrl?: string;
  status: 'en_attente' | 'valide' | 'rejete';
  month?: string;
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
  declaration?: ChatDeclarationAttachment;
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

export function deduplicateMessageList(list: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const clean: ChatMessage[] = [];

  for (const m of list) {
    if (!m) continue;
    if (seenIds.has(m.id)) continue;
    seenIds.add(m.id);

    const timeMinute = m.created_at ? m.created_at.slice(0, 16) : '';
    const textTrimmed = (m.text || '').trim();
    const fp = `${m.sender_id}::${textTrimmed}::${timeMinute}`;

    if (textTrimmed && seenFingerprints.has(fp)) {
      // Doublon détecté (même expéditeur, même texte et même minute)
      continue;
    }
    if (textTrimmed) {
      seenFingerprints.add(fp);
    }
    clean.push(m);
  }
  return clean;
}

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
    }).map((m: any) => {
      if (!m) return m;
      let textStr = m.text;
      if (typeof textStr === 'string' && (textStr.trim().startsWith('{') || textStr.trim().startsWith('[')) && textStr.includes('"type":')) {
        try {
          const rawParsed = JSON.parse(textStr.trim());
          const item = Array.isArray(rawParsed) ? rawParsed[0] : rawParsed;
          if (item && typeof item === 'object') {
            return {
              ...m,
              text: item.text || m.text,
              contract: m.contract || item.contract,
              quittance: m.quittance || item.quittance,
              restitution: m.restitution || item.restitution,
              attachment: m.attachment || item.attachment
            };
          }
        } catch {}
      }
      return m;
    });

    const deduplicated = deduplicateMessageList(cleaned);
    if (deduplicated.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
    }
    return deduplicated;
  } catch (e) {
    return [];
  }
}

export function saveStoredMessages(messages: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    const deduplicated = deduplicateMessageList(messages);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
    window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
  } catch (e) {
    console.error('Failed to save stored messages:', e);
  }
}

export const isValidUuid = (str?: string) =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

// Synchronisation asynchrone sécurisée avec Supabase Realtime & DB
export async function syncMessageToSupabase(
  newMsg: ChatMessage,
  senderId: string,
  receiverId: string,
  text: string,
  propertyId?: string
): Promise<{ success: boolean; error?: any }> {
  try {
    // 1. Diffusion Realtime immédiate via le canal Supabase actif
    try {
      broadcastLiveEvent('NEW_MESSAGE', {
        actorId: senderId,
        targetUserId: receiverId,
        data: { ...newMsg, senderId, receiverId }
      });
    } catch {}

    // 2. Persistance BDD si identifiants UUID valides
    if (isValidUuid(senderId) && isValidUuid(receiverId)) {
      // Trouver ou créer la conversation
      let convId: string | null = null;
      const { data: convData, error: convLookupError } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_a.eq.${senderId},participant_b.eq.${receiverId}),and(participant_a.eq.${receiverId},participant_b.eq.${senderId})`)
        .maybeSingle();

      if (convLookupError) {
        console.warn('Erreur recherche conversation Supabase:', convLookupError.message);
      }

      if (convData?.id) {
        convId = convData.id;
      } else {
        const { data: newConv, error: convInsertError } = await supabase
          .from('conversations')
          .insert({
            participant_a: senderId,
            participant_b: receiverId,
            property_id: isValidUuid(propertyId) ? propertyId : undefined
          })
          .select('id')
          .maybeSingle();

        if (convInsertError) {
          console.error('Erreur création conversation Supabase:', convInsertError.message);
          return { success: false, error: convInsertError.message };
        }
        if (newConv?.id) convId = newConv.id;
      }

      if (convId) {
        // Encodage structuré pour conserver les pièces jointes / contrats / quittances
        let contentToStore = text;
        if (newMsg.contract) {
          contentToStore = JSON.stringify({
            type: 'contract',
            text: text,
            contract: newMsg.contract
          });
        } else if (newMsg.quittance) {
          contentToStore = JSON.stringify({
            type: 'quittance',
            text: text,
            quittance: newMsg.quittance
          });
        } else if (newMsg.restitution) {
          contentToStore = JSON.stringify({
            type: 'restitution',
            text: text,
            restitution: newMsg.restitution
          });
        } else if (newMsg.attachment) {
          contentToStore = JSON.stringify({
            type: 'attachment',
            text: text,
            attachment: newMsg.attachment
          });
        }

        const { data: insertedMsg, error: msgInsertError } = await supabase
          .from('messages')
          .insert({
            conversation_id: convId,
            sender_id: senderId,
            content: contentToStore
          })
          .select('id, created_at')
          .maybeSingle();

        if (msgInsertError) {
          console.error('Erreur insertion message Supabase:', msgInsertError.message);
          return { success: false, error: msgInsertError.message };
        }

        // Mettre à jour l'ID local avec le vrai UUID Supabase pour éliminer tout doublon futur
        if (insertedMsg?.id) {
          const current = getStoredMessages();
          const reconciled = current.map((m) => (m.id === newMsg.id ? { ...m, id: insertedMsg.id } : m));
          saveStoredMessages(reconciled);
        }

        // Persistance de la notification en BDD
        const notifTitle = newMsg.contract
          ? `Bail officiel reçu (N° ${newMsg.contract.contractNumber})`
          : newMsg.quittance
          ? `Quittance émise (N° ${newMsg.quittance.receiptNumber})`
          : 'Nouveau message reçu';

        await supabase.from('notifications').insert({
          user_id: receiverId,
          title: notifTitle,
          message: text.length > 100 ? `${text.slice(0, 97)}...` : text,
          type: newMsg.contract ? 'contrat' : newMsg.quittance ? 'quittance' : 'info',
          is_read: false
        });

        return { success: true };
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('Exception sync Supabase chat:', err);
    return { success: false, error: err?.message || 'Erreur réseau' };
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
  // Synchronisation réelle avec Supabase
  const result = await syncMessageToSupabase(msg, senderId, receiverId, text, options?.propertyId);
  if (!result.success) {
    throw new Error(result.error || "Impossible d'enregistrer le message sur les serveurs.");
  }
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

export function sendDeclarationMessageToOwner(declaration: ChatDeclarationAttachment): ChatMessage {
  const current = getStoredMessages();

  let targetOwnerId = declaration.ownerId;
  if (!targetOwnerId || targetOwnerId === 'usr_owner' || targetOwnerId === 'usr_agency') {
    try {
      const appsRaw = localStorage.getItem('locatrust_rental_applications');
      if (appsRaw) {
        const apps = JSON.parse(appsRaw);
        if (Array.isArray(apps)) {
          const matched = apps.find((a: any) =>
            (declaration.contractNumber && a.contract_number === declaration.contractNumber) ||
            (declaration.propertyTitle && a.property_title === declaration.propertyTitle)
          );
          if (matched && (matched.agency_id || matched.owner_id)) {
            targetOwnerId = matched.agency_id || matched.owner_id;
          }
        }
      }
    } catch {}
  }
  if (!targetOwnerId) targetOwnerId = 'usr_owner';

  const isCaution = declaration.type === 'caution';
  const text = isCaution
    ? `💰 Déclaration de versement de Caution (${formatFCFA(declaration.amount)})\nLe locataire ${declaration.tenantName} a déclaré le règlement de sa caution (${declaration.paymentMethod} • Réf: ${declaration.reference}) pour le logement ${declaration.propertyTitle}.\nConsultez le document ci-dessous pour vérifier et valider l'encaissement.`
    : `💳 Déclaration de paiement de Loyer (${formatFCFA(declaration.amount)})\nLe locataire ${declaration.tenantName} a déclaré le règlement de son loyer de ${declaration.month || 'la période'} (${declaration.paymentMethod} • Réf: ${declaration.reference}) pour le logement ${declaration.propertyTitle}.\nConsultez le document ci-dessous pour vérifier et valider le règlement.`;

  const newMsg: ChatMessage = {
    id: `msg_decl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender_id: declaration.tenantId,
    receiver_id: targetOwnerId,
    text,
    created_at: new Date().toISOString(),
    declaration: {
      ...declaration,
      ownerId: targetOwnerId
    },
    status: 'delivered'
  };

  const updated = [...current, newMsg];
  saveStoredMessages(updated);
  syncMessageToSupabase(newMsg, declaration.tenantId, targetOwnerId, newMsg.text);

  // Send real notification strictly to owner/agency in locatrust_notifications
  try {
    const notifsRaw = localStorage.getItem('locatrust_notifications');
    const existing = notifsRaw ? JSON.parse(notifsRaw) : [];
    const notifItem = {
      id: `notif_decl_${Date.now()}`,
      title: isCaution ? '💰 Nouvelle déclaration de caution' : '💳 Nouveau paiement de loyer déclaré',
      description: `${declaration.tenantName} a déclaré un versement de ${formatFCFA(declaration.amount)} pour ${declaration.propertyTitle}.`,
      time: 'À l\'instant',
      unread: true,
      type: isCaution ? 'caution' : 'payment',
      targetRole: 'proprietaire',
      targetUserId: targetOwnerId,
      senderUserId: declaration.tenantId
    };
    localStorage.setItem('locatrust_notifications', JSON.stringify([notifItem, ...(Array.isArray(existing) ? existing : [])]));
    window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
  } catch {}

  return newMsg;
}

export function updateDeclarationMessageStatus(declarationId: string, newStatus: 'valide' | 'rejete') {
  const current = getStoredMessages();
  let changed = false;
  const updated = current.map((m) => {
    if (m.declaration && (m.declaration.declarationId === declarationId || m.id === declarationId)) {
      changed = true;
      return {
        ...m,
        declaration: {
          ...m.declaration,
          status: newStatus
        }
      };
    }
    return m;
  });
  if (changed) {
    saveStoredMessages(updated);
  }
}

export function sendContractToTenant(tenantId: string, contract: ChatContractAttachment, senderId?: string): ChatMessage {
  const current = getStoredMessages();
  let finalSenderId = senderId;
  if (!finalSenderId || finalSenderId === 'usr_owner' || finalSenderId === 'usr_agency') {
    try {
      const appsRaw = localStorage.getItem('locatrust_rental_applications');
      if (appsRaw) {
        const apps = JSON.parse(appsRaw);
        if (Array.isArray(apps)) {
          const matched = apps.find((a: any) =>
            (contract.contractNumber && a.contract_number === contract.contractNumber) ||
            (contract.propertyTitle && a.property_title === contract.propertyTitle) ||
            (contract.ownerName && (a.owner_name === contract.ownerName || a.agency_name === contract.ownerName))
          );
          if (matched && (matched.agency_id || matched.owner_id)) {
            finalSenderId = matched.agency_id || matched.owner_id;
          }
        }
      }
    } catch {}
  }
  if (!finalSenderId) finalSenderId = 'usr_owner';

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
      const storedUserAvatar = localStorage.getItem('locatrust_user_avatar');
      const existingOwnerContact = localStorage.getItem(`locatrust_contact_${finalSenderId}`);
      const parsedOwner = existingOwnerContact ? JSON.parse(existingOwnerContact) : null;
      const existingTenantContact = localStorage.getItem(`locatrust_contact_${tenantId}`);
      const parsedTenant = existingTenantContact ? JSON.parse(existingTenantContact) : null;

      const ownerAvatar =
        parsedOwner?.avatar && !parsedOwner.avatar.includes('ui-avatars.com')
          ? parsedOwner.avatar
          : storedUserAvatar && !storedUserAvatar.includes('ui-avatars.com')
          ? storedUserAvatar
          : getDefaultRealisticAvatar(contract.ownerName, contract.ownerName.toLowerCase().includes('agence') ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur');

      localStorage.setItem(`locatrust_contact_${finalSenderId}`, JSON.stringify({
        id: finalSenderId,
        name: contract.ownerName,
        phone: '+225 07 00 00 00 00',
        role: contract.ownerName.toLowerCase().includes('agence') ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur',
        propertyTitle: contract.propertyTitle,
        avatar: ownerAvatar,
        online: true
      }));

      localStorage.setItem(`locatrust_contact_${tenantId}`, JSON.stringify({
        id: tenantId,
        name: contract.tenantName,
        phone: '+225 05 00 00 00 00',
        role: 'Locataire Preneur',
        propertyTitle: contract.propertyTitle,
        avatar: parsedTenant?.avatar || (contract.tenantName.toLowerCase().includes('chris') ? (storedUserAvatar || undefined) : undefined) || `https://ui-avatars.com/api/?name=${encodeURIComponent(contract.tenantName)}&background=059669&color=fff`,
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
      .select('id, participant_a, participant_b')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);

    if (convErr || !convs || convs.length === 0) return [];

    const convIds = convs.map((c) => c.id);
    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true });

    if (msgErr || !msgs) return [];

    const convMap = new Map<string, { participant_a: string; participant_b: string }>();
    convs.forEach((c) => convMap.set(c.id, c));

    const currentLocal = getStoredMessages();
    let localReconciled = false;
    const reconciledLocal = currentLocal.map((local) => {
      if (local.id.startsWith('msg_') || local.id.startsWith('call_')) {
        const matchingDbMsg = msgs.find(
          (m: any) =>
            m.sender_id === local.sender_id &&
            m.content === local.text &&
            Math.abs(new Date(local.created_at).getTime() - new Date(m.created_at).getTime()) < 60000
        );
        if (matchingDbMsg) {
          localReconciled = true;
          return { ...local, id: matchingDbMsg.id };
        }
      }
      return local;
    });

    const activeIds = new Set(reconciledLocal.map((m) => m.id));
    const newFromDb: ChatMessage[] = [];

    msgs.forEach((m: any) => {
      const conv = convMap.get(m.conversation_id);
      const isSender = m.sender_id === userId;
      const otherId = conv ? (conv.participant_a === userId ? conv.participant_b : conv.participant_a) : 'usr_contact';
      const receiverId = isSender ? otherId : userId;

      let parsedContract: any = undefined;
      let parsedQuittance: any = undefined;
      let parsedRestitution: any = undefined;
      let parsedAttachment: any = undefined;

      let displayText = m.content || '';
      try {
        if (m.content && (m.content.trim().startsWith('{') || m.content.trim().startsWith('[')) && m.content.includes('"type":')) {
          const rawParsed = JSON.parse(m.content.trim());
          const parsed = Array.isArray(rawParsed) ? rawParsed[0] : rawParsed;
          if (parsed && typeof parsed === 'object') {
            if (parsed.text) displayText = parsed.text;
            if (parsed.contract) parsedContract = parsed.contract;
            if (parsed.quittance) parsedQuittance = parsed.quittance;
            if (parsed.restitution) parsedRestitution = parsed.restitution;
            if (parsed.attachment) parsedAttachment = parsed.attachment;
          }
        }
      } catch {}

      const formatted: ChatMessage = {
        id: m.id,
        sender_id: m.sender_id,
        receiver_id: receiverId,
        text: displayText,
        created_at: m.created_at,
        status: m.status || 'delivered',
        contract: parsedContract,
        quittance: parsedQuittance,
        restitution: parsedRestitution,
        attachment: parsedAttachment || (m.attachment_url ? { type: 'document', url: m.attachment_url } : undefined)
      };

      const isAlreadyInLocal = reconciledLocal.some(
        (local) =>
          local.id === m.id ||
          (local.sender_id === m.sender_id &&
            local.text === displayText &&
            Math.abs(new Date(local.created_at).getTime() - new Date(m.created_at).getTime()) < 60000)
      );

      if (!isAlreadyInLocal && !activeIds.has(m.id)) {
        newFromDb.push(formatted);
      }
    });

    if (newFromDb.length > 0 || localReconciled) {
      const merged = deduplicateMessageList([...reconciledLocal, ...newFromDb]);
      saveStoredMessages(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Erreur synchronisation messages Supabase:', err);
  }
  return [];
}

/**
 * Récupère les vraies conversations et profils associés depuis Supabase
 * et les retourne sous forme de ChatContact avec noms et photos réels
 */
export async function fetchSupabaseConversationsWithProfiles(userId: string): Promise<ChatContact[]> {
  if (!isValidUuid(userId) || typeof window === 'undefined') return [];
  try {
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('id, participant_a, participant_b, property_id, properties:properties(id, title, city, commune)')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (convErr || !convs || convs.length === 0) return [];

    const otherUserIds = Array.from(
      new Set(
        convs.map((c) => (c.participant_a === userId ? c.participant_b : c.participant_a)).filter(isValidUuid)
      )
    );

    if (otherUserIds.length === 0) return [];

    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, phone, account_type, avatar_url, city, commune')
      .in('id', otherUserIds);

    if (profErr || !profiles) return [];

    const profMap = new Map<string, any>();
    profiles.forEach((p) => profMap.set(p.id, p));

    const realContacts: ChatContact[] = [];

    convs.forEach((c) => {
      const otherId = c.participant_a === userId ? c.participant_b : c.participant_a;
      const prof = profMap.get(otherId);
      if (!prof) return;

      const isAgency = prof.account_type === 'agence';
      const roleLabel = isAgency
        ? 'Agence Immobilière Agréée'
        : prof.account_type === 'proprietaire'
        ? 'Propriétaire Bailleur'
        : 'Locataire Preneur';

      const myStoredAvatar = typeof window !== 'undefined' ? localStorage.getItem('locatrust_user_avatar') : null;
      let avatarUrl =
        prof.avatar_url && prof.avatar_url.trim().length > 5 && !prof.avatar_url.includes('ui-avatars.com') && prof.avatar_url !== myStoredAvatar
          ? prof.avatar_url
          : (typeof window !== 'undefined' ? localStorage.getItem(`locatrust_user_avatar_${prof.id}`) : null);

      if (!avatarUrl || avatarUrl === myStoredAvatar) {
        avatarUrl = getDefaultRealisticAvatar(prof.full_name, roleLabel);
      }

      if (!realContacts.some((rc) => rc.id === prof.id)) {
        realContacts.push({
          id: prof.id,
          name: prof.full_name || 'Utilisateur Certifié',
          phone: prof.phone || '+225 07 00 00 00 00',
          role: roleLabel,
          propertyTitle: propTitle,
          avatar: avatarUrl,
          online: true
        });

        // Mémorisation dans le stockage local pour affichage instantané
        localStorage.setItem(
          `locatrust_contact_${prof.id}`,
          JSON.stringify({
            id: prof.id,
            name: prof.full_name || 'Utilisateur Certifié',
            phone: prof.phone || '+225 07 00 00 00 00',
            role: roleLabel,
            propertyTitle: propTitle,
            avatar: avatarUrl,
            online: true
          })
        );
      }
    });

    return realContacts;
  } catch (e) {
    console.warn('Erreur chargement contacts réels Supabase:', e);
    return [];
  }
}

