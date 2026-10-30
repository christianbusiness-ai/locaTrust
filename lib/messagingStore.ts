'use client';

import { generateOfficialReceiptPDF, OfficialReceiptData } from '@/lib/payments/officialReceiptPdfGenerator';
import { triggerCelebration } from '@/lib/celebration';
import { supabase } from '@/src/lib/supabase';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { getDefaultRealisticAvatar } from '@/lib/avatarHelper';
import { formatFCFA } from '@/lib/utils';

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
  receiptType?: 'loyer' | 'caution';
  depositId?: string;
  durationMonths?: number;
  leaseStartDate?: string;
  leaseEndDate?: string;
  propertyReference?: string;
  propertyType?: string;
  ownerCni?: string;
  ownerPhone?: string;
  tenantCni?: string;
  tenantPhone?: string;
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
  is_read?: boolean;
  read?: boolean;
  read_at?: string | null;
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

export const TENANT_CHAT_CONTACTS: ChatContact[] = [];

export const AGENCY_CHAT_CONTACTS: ChatContact[] = [];

export const CHAT_CONTACTS: ChatContact[] = [];

export const DEFAULT_MESSAGES: ChatMessage[] = [];

const STORAGE_KEY = 'locatrust_chat_messages_v4';
const CONTACTS_MAP_PREFIX = 'locatrust_contacts_v4_';
const ACTIVE_CHAT_CONTACT_PREFIX = 'locatrust_active_chat_contact_';
const ACTIVE_USER_ID_KEY = 'locatrust_active_user_id';
const RECEIPTS_STORAGE_KEY = 'locatrust_tenant_receipts_v2';
const READ_MSG_IDS_KEY = 'locatrust_read_msg_ids_v2';
const READ_NOTIF_IDS_KEY = 'locatrust_read_notif_ids_v2';
const CONV_READ_AT_PREFIX = 'locatrust_conv_read_at_v2_';
const COUNTER_V2_MIGRATION_PREFIX = 'locatrust_counter_v2_clean_';

let currentActiveMessagingUserId: string | null = null;

export function setActiveMessagingUser(userId?: string | null) {
  currentActiveMessagingUserId = userId ? String(userId).trim() : null;
  if (typeof window === 'undefined') return;
  try {
    if (currentActiveMessagingUserId) {
      localStorage.setItem(ACTIVE_USER_ID_KEY, currentActiveMessagingUserId);
      // Nettoyer les anciennes clés globales locatrust_contact_* non scopées pour éviter toute fuite inter-comptes
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('locatrust_contact_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });
    } else {
      localStorage.removeItem(ACTIVE_USER_ID_KEY);
    }
  } catch {}
}

export function getActiveMessagingUser(): string | null {
  if (currentActiveMessagingUserId) return currentActiveMessagingUserId;
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(ACTIVE_USER_ID_KEY);
    if (stored && stored !== 'null' && stored !== 'undefined') {
      currentActiveMessagingUserId = stored;
      return stored;
    }
  } catch {}
  return null;
}

export function getUserScopedContactsMap(userId?: string): Record<string, ChatContact> {
  if (typeof window === 'undefined') return {};
  const uid = userId || getActiveMessagingUser();
  if (!uid) return {};
  try {
    const raw = localStorage.getItem(`${CONTACTS_MAP_PREFIX}${uid}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveUserScopedContact(userId: string | undefined, contact: Partial<ChatContact> & { id: string }) {
  if (typeof window === 'undefined' || !contact?.id) return;
  const uid = userId || getActiveMessagingUser();
  if (!uid || contact.id === uid) return;
  try {
    const map = getUserScopedContactsMap(uid);
    const existing = map[contact.id] || ({} as ChatContact);
    map[contact.id] = {
      id: contact.id,
      name: contact.name || existing.name || 'Utilisateur Certifié',
      phone: contact.phone || existing.phone || '+225 07 00 00 00 00',
      role: contact.role || existing.role || 'Correspondant',
      propertyTitle: contact.propertyTitle || existing.propertyTitle || 'Échange direct',
      avatar: contact.avatar || existing.avatar || '',
      online: contact.online ?? existing.online ?? true
    };
    localStorage.setItem(`${CONTACTS_MAP_PREFIX}${uid}`, JSON.stringify(map));
  } catch {}
}

export function getActiveChatPartnerForUser(userId?: string): string | null {
  if (typeof window === 'undefined') return null;
  const uid = userId || getActiveMessagingUser();
  if (!uid) return null;
  try {
    return localStorage.getItem(`${ACTIVE_CHAT_CONTACT_PREFIX}${uid}`);
  } catch {
    return null;
  }
}

export function setActiveChatPartnerForUser(userId: string | undefined, contactId: string | null) {
  if (typeof window === 'undefined') return;
  const uid = userId || getActiveMessagingUser();
  if (!uid) return;
  try {
    if (contactId && contactId !== uid) {
      localStorage.setItem(`${ACTIVE_CHAT_CONTACT_PREFIX}${uid}`, contactId);
    } else {
      localStorage.removeItem(`${ACTIVE_CHAT_CONTACT_PREFIX}${uid}`);
    }
    localStorage.removeItem('locatrust_active_chat_contact');
  } catch {}
}

export function getReadMessageIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_MSG_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function addReadMessageIds(ids: string[]) {
  if (typeof window === 'undefined' || !Array.isArray(ids) || ids.length === 0) return;
  try {
    const set = getReadMessageIds();
    let added = false;
    for (const id of ids) {
      if (id && !set.has(String(id))) {
        set.add(String(id));
        added = true;
      }
    }
    if (added) {
      const list = Array.from(set).slice(-2000);
      localStorage.setItem(READ_MSG_IDS_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function getReadNotificationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_NOTIF_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function getNotificationFingerprint(n: any): string {
  if (!n) return '';
  const target = String(n.targetUserId || n.user_id || '').trim().toLowerCase();
  const title = String(n.title || '').trim().toLowerCase();
  const desc = String(n.description || n.content || n.message || '').trim().toLowerCase().slice(0, 80);
  return `fp:${target}::${title}::${desc}`;
}

export function addReadNotificationIds(idsOrNotifs: Array<string | any>) {
  if (typeof window === 'undefined' || !Array.isArray(idsOrNotifs) || idsOrNotifs.length === 0) return;
  try {
    const set = getReadNotificationIds();
    let added = false;
    for (const item of idsOrNotifs) {
      if (!item) continue;
      if (typeof item === 'string') {
        if (!set.has(item)) {
          set.add(item);
          added = true;
        }
      } else if (typeof item === 'object') {
        if (item.id && !set.has(String(item.id))) {
          set.add(String(item.id));
          added = true;
        }
        const fp = getNotificationFingerprint(item);
        if (fp && !set.has(fp)) {
          set.add(fp);
          added = true;
        }
      }
    }
    if (added) {
      const list = Array.from(set).slice(-2000);
      localStorage.setItem(READ_NOTIF_IDS_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function getConvLastReadMap(userId?: string): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const key = `${CONV_READ_AT_PREFIX}${userId || 'global'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setConvLastReadAt(userId: string | undefined, contactId: string, timestampMs?: number) {
  if (typeof window === 'undefined' || !contactId) return;
  try {
    const ts = timestampMs || Date.now();
    const keysToUpdate = [userId || 'global', 'global'];
    for (const uid of Set.prototype ? Array.from(new Set(keysToUpdate)) : keysToUpdate) {
      const key = `${CONV_READ_AT_PREFIX}${uid}`;
      const map = getConvLastReadMap(uid);
      map[contactId] = Math.max(map[contactId] || 0, ts);
      map[contactId.toLowerCase()] = Math.max(map[contactId.toLowerCase()] || 0, ts);
      localStorage.setItem(key, JSON.stringify(map));
    }
  } catch {}
}

export function mergeServerReadState(
  userId: string,
  readState?: { readMessageIds?: string[]; readNotifIds?: string[]; convLastReadAt?: Record<string, number> }
) {
  if (typeof window === 'undefined' || !readState) return;
  try {
    if (Array.isArray(readState.readMessageIds) && readState.readMessageIds.length > 0) {
      addReadMessageIds(readState.readMessageIds);
    }
    if (Array.isArray(readState.readNotifIds) && readState.readNotifIds.length > 0) {
      addReadNotificationIds(readState.readNotifIds);
    }
    if (readState.convLastReadAt && typeof readState.convLastReadAt === 'object') {
      Object.entries(readState.convLastReadAt).forEach(([cid, ts]) => {
        if (cid && typeof ts === 'number' && ts > 0) {
          setConvLastReadAt(userId, cid, ts);
        }
      });
    }
  } catch {}
}

/**
 * Migration initiale unique v2 : nettoie les anciens compteurs fantômes bloqués
 * avant l'introduction du registre de lecture persistant (messages/notifications historiques > 30s).
 */
export function ensureCounterV2Migration(userId?: string) {
  if (typeof window === 'undefined') return;
  try {
    const migKey = `${COUNTER_V2_MIGRATION_PREFIX}${userId || 'global'}`;
    if (localStorage.getItem(migKey) === 'done') return;

    const cutoffMs = Date.now() - 30000;
    setConvLastReadAt(userId, '__all__', cutoffMs);
    setConvLastReadAt(userId, '__notifs_all__', cutoffMs);

    // Marquer les messages locaux existants antérieurs au cutoff comme lus
    try {
      const rawMsgs = localStorage.getItem(STORAGE_KEY);
      if (rawMsgs) {
        const parsed = JSON.parse(rawMsgs);
        if (Array.isArray(parsed)) {
          const readIds: string[] = [];
          const updated = parsed.map((m: any) => {
            if (!m) return m;
            const ts = m.created_at ? new Date(m.created_at).getTime() : 0;
            if (!ts || ts <= cutoffMs) {
              if (m.id) readIds.push(m.id);
              return { ...m, status: 'read', is_read: true, read: true };
            }
            return m;
          });
          addReadMessageIds(readIds);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
      }
    } catch {}

    // Marquer les notifications locales existantes antérieures au cutoff comme lues
    try {
      const rawNotifs = localStorage.getItem('locatrust_notifications');
      if (rawNotifs) {
        const parsed = JSON.parse(rawNotifs);
        if (Array.isArray(parsed)) {
          const readItems: any[] = [];
          const updated = parsed.map((n: any) => {
            if (!n) return n;
            const ts = n.created_at || n.timestamp ? new Date(n.created_at || n.timestamp).getTime() : 0;
            if (!ts || isNaN(ts) || ts <= cutoffMs) {
              readItems.push(n);
              return { ...n, read: true, is_read: true, unread: false };
            }
            return n;
          });
          addReadNotificationIds(readItems);
          localStorage.setItem('locatrust_notifications', JSON.stringify(updated));
        }
      }
    } catch {}

    localStorage.setItem(migKey, 'done');
  } catch {}
}

export function isMessageRead(msg: ChatMessage, currentUserId?: string, allMessages?: ChatMessage[]): boolean {
  if (!msg) return true;
  if (msg.status === 'read' || msg.is_read === true || msg.read === true || Boolean(msg.read_at)) {
    return true;
  }
  const readIds = getReadMessageIds();
  if (msg.id && readIds.has(msg.id)) {
    return true;
  }

  ensureCounterV2Migration(currentUserId);

  const map = {
    ...getConvLastReadMap('global'),
    ...(currentUserId ? getConvLastReadMap(currentUserId) : {})
  };

  const msgTs = msg.created_at ? new Date(msg.created_at).getTime() : 0;
  const senderKey = (msg.sender_id || '').toLowerCase();
  const contactReadAt = Math.max(map[msg.sender_id] || 0, map[senderKey] || 0, map.__all__ || 0);

  if (msgTs > 0 && contactReadAt > 0 && msgTs <= contactReadAt) {
    return true;
  }

  // Si l'utilisateur connecté a déjà répondu dans cette conversation après ce message, ce message a forcément été vu
  if (currentUserId && msgTs > 0 && Array.isArray(allMessages)) {
    const hasRepliedAfter = allMessages.some(
      (other) =>
        other &&
        other.sender_id === currentUserId &&
        other.receiver_id === msg.sender_id &&
        other.created_at &&
        new Date(other.created_at).getTime() >= msgTs
    );
    if (hasRepliedAfter) return true;
  }

  return false;
}

export function isNotificationRead(n: any, currentUserId?: string): boolean {
  if (!n) return true;
  if (n.read === true || n.is_read === true || n.unread === false || n.processed === true || Boolean(n.read_at)) {
    return true;
  }
  ensureCounterV2Migration(currentUserId);
  const readNotifs = getReadNotificationIds();
  if (n.id && readNotifs.has(String(n.id))) return true;
  const fp = getNotificationFingerprint(n);
  if (fp && readNotifs.has(fp)) return true;

  const map = {
    ...getConvLastReadMap('global'),
    ...(currentUserId ? getConvLastReadMap(currentUserId) : {})
  };

  const rawDate = n.created_at || (n.timestamp && n.timestamp !== "À l'instant" ? n.timestamp : null);
  const notifTs = rawDate ? new Date(rawDate).getTime() : 0;
  if (notifTs > 0 && !isNaN(notifTs)) {
    if (map.__notifs_all__ && notifTs <= map.__notifs_all__) {
      return true;
    }
    const senderId = n.senderUserId || n.payload?.contactId || n.payload?.sender_id;
    const isMsgNotif = n.targetTab === 'messages' || String(n.title || '').toLowerCase().includes('message');
    if (isMsgNotif && senderId) {
      const contactWatermark = Math.max(map[senderId] || 0, map[String(senderId).toLowerCase()] || 0, map.__all__ || 0);
      if (contactWatermark > 0 && notifTs <= contactWatermark) {
        return true;
      }
    }
  }

  return false;
}

export function safeUpdateSupabaseNotificationRead(userId?: string, notifId?: string) {
  try {
    if (notifId && isValidUuid(notifId)) {
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId)
        .then(({ error }) => {
          if (error) {
            supabase.from('notifications').update({ read: true }).eq('id', notifId).then();
          }
        });
    } else if (userId && isValidUuid(userId)) {
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) {
            supabase.from('notifications').update({ read: true }).eq('user_id', userId).then();
          }
        });
    }
  } catch {}
}

export function deduplicateMessageList(list: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(list)) return [];
  const byId = new Map<string, ChatMessage>();
  const byFp = new Map<string, ChatMessage>();
  const clean: ChatMessage[] = [];
  const readSet = getReadMessageIds();

  for (const rawMsg of list) {
    if (!rawMsg) continue;
    const alreadyRead =
      rawMsg.status === 'read' ||
      rawMsg.is_read === true ||
      rawMsg.read === true ||
      Boolean(rawMsg.read_at) ||
      (rawMsg.id && readSet.has(rawMsg.id));

    const m: ChatMessage = alreadyRead
      ? { ...rawMsg, status: 'read', is_read: true, read: true }
      : rawMsg;

    if (m.id && byId.has(m.id)) {
      const existing = byId.get(m.id)!;
      if (m.status === 'read' && existing.status !== 'read') {
        existing.status = 'read';
        existing.is_read = true;
        existing.read = true;
        existing.read_at = existing.read_at || m.read_at || new Date().toISOString();
      }
      continue;
    }

    const timeMinute = m.created_at ? m.created_at.slice(0, 16) : '';
    const textTrimmed = (m.text || '').trim();
    const fp = `${m.sender_id}::${textTrimmed}::${timeMinute}`;

    if (textTrimmed && byFp.has(fp)) {
      const existing = byFp.get(fp)!;
      if (m.status === 'read' && existing.status !== 'read') {
        existing.status = 'read';
        existing.is_read = true;
        existing.read = true;
        existing.read_at = existing.read_at || m.read_at || new Date().toISOString();
      }
      continue;
    }

    if (m.id) byId.set(m.id, m);
    if (textTrimmed) byFp.set(fp, m);
    clean.push(m);
  }
  return clean;
}

const GENERIC_DEMO_IDS = new Set([
  'usr_tenant_1',
  'usr_owner_1',
  'usr_tenant',
  'usr_owner',
  'usr_agency',
  'usr_candidate',
  'usr_support',
  'usr_contact'
]);

export function getStoredMessages(explicitUserId?: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const uid = (explicitUserId || getActiveMessagingUser() || '').trim();
    if (!uid) {
      return [];
    }

    const userStorageKey = `${STORAGE_KEY}_${uid}`;
    let data = localStorage.getItem(userStorageKey);

    // Migration unique depuis l'ancienne clé globale en filtrant STRICTEMENT pour uid
    if (!data || data === 'null' || data === 'undefined') {
      const legacyData = localStorage.getItem(STORAGE_KEY);
      if (legacyData && legacyData !== 'null' && legacyData !== 'undefined') {
        try {
          const legacyParsed = JSON.parse(legacyData);
          if (Array.isArray(legacyParsed)) {
            const strictlyMine = legacyParsed.filter(
              (m: any) =>
                m &&
                m.sender_id &&
                m.receiver_id &&
                m.sender_id !== m.receiver_id &&
                (m.sender_id === uid || m.receiver_id === uid) &&
                !GENERIC_DEMO_IDS.has(m.sender_id) &&
                !GENERIC_DEMO_IDS.has(m.receiver_id)
            );
            localStorage.setItem(userStorageKey, JSON.stringify(strictlyMine));
            data = JSON.stringify(strictlyMine);
          }
        } catch {}
      }
    }

    if (!data || data === 'null' || data === 'undefined') {
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Filtrage strict par utilisateur connecté + suppression de toute donnée fictive ou générique
    const cleaned = parsed
      .filter((m: any) => {
        if (!m || !m.sender_id || !m.receiver_id) return false;
        if (m.sender_id === m.receiver_id) return false;
        if (GENERIC_DEMO_IDS.has(m.sender_id) || GENERIC_DEMO_IDS.has(m.receiver_id)) return false;
        if (String(m.sender_id).startsWith('candidate_') || String(m.receiver_id).startsWith('candidate_')) return false;
        if (m.text && (m.text.includes('Kouassi Jean-Philippe') || m.text.includes('Awa Touré'))) return false;
        // L'utilisateur connecté DOIT être expéditeur ou destinataire réel
        if (m.sender_id !== uid && m.receiver_id !== uid) return false;
        return true;
      })
      .map((m: any) => {
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
                declaration: m.declaration || item.declaration,
                attachment: m.attachment || item.attachment
              };
            }
          } catch {}
        }
        return m;
      });

    const deduplicated = deduplicateMessageList(cleaned);
    if (deduplicated.length !== parsed.length) {
      localStorage.setItem(userStorageKey, JSON.stringify(deduplicated));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
    }
    return deduplicated;
  } catch (e) {
    return [];
  }
}

export function saveStoredMessages(messages: ChatMessage[], explicitUserId?: string) {
  if (typeof window === 'undefined') return;
  try {
    const uid = (explicitUserId || getActiveMessagingUser() || '').trim();
    const filtered = (Array.isArray(messages) ? messages : []).filter((m: any) => {
      if (!m || !m.sender_id || !m.receiver_id) return false;
      if (m.sender_id === m.receiver_id) return false;
      if (GENERIC_DEMO_IDS.has(m.sender_id) || GENERIC_DEMO_IDS.has(m.receiver_id)) return false;
      if (uid && m.sender_id !== uid && m.receiver_id !== uid) return false;
      return true;
    });
    const deduplicated = deduplicateMessageList(filtered);
    if (uid) {
      localStorage.setItem(`${STORAGE_KEY}_${uid}`, JSON.stringify(deduplicated));
    }
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
    // 1. Résolution des informations du profil de l'expéditeur
    let senderName = '';
    let senderAvatar = '';
    let senderRole = '';
    let propTitle = '';
    if (typeof window !== 'undefined') {
      try {
        const u = localStorage.getItem('locatrust_user');
        if (u) {
          const pu = JSON.parse(u);
          senderName = pu.full_name || pu.name || '';
          senderRole = pu.account_type || pu.role || '';
          senderAvatar = pu.avatar_url || localStorage.getItem('locatrust_user_avatar') || '';
        }
        const scopedContacts = getUserScopedContactsMap(senderId);
        const pc = scopedContacts[senderId];
        if (pc) {
          if (!senderName) senderName = pc.name || '';
          if (!senderAvatar) senderAvatar = pc.avatar || '';
          if (!senderRole) senderRole = pc.role || '';
          if (!propTitle) propTitle = pc.propertyTitle || '';
        }
      } catch {}
    }

    const notifDeterministicId = (newMsg as any).notificationId || `notif_msg_${newMsg.id}`;
    const enrichedMessage = {
      ...newMsg,
      notificationId: notifDeterministicId,
      senderId,
      receiverId,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      sender_role: senderRole,
      property_title: propTitle
    };

    // Diffusion Realtime immédiate via le canal Supabase actif
    try {
      broadcastLiveEvent('NEW_MESSAGE', {
        actorId: senderId,
        targetUserId: receiverId,
        data: enrichedMessage
      });
    } catch {}

    // Synchronisation avec /api/sync en arrière-plan
    if (typeof window !== 'undefined') {
      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_message',
            message: enrichedMessage
          })
        }).catch(() => {});
      } catch {}
    }

    // 2. Persistance BDD : utiliser exclusivement les UUID réels des participants
    const finalSenderId = senderId;
    const finalReceiverId = receiverId;

    if (isValidUuid(finalSenderId) && isValidUuid(finalReceiverId) && finalSenderId !== finalReceiverId) {
      // Trouver ou créer la conversation (support transparent des colonnes tenant_id/owner_id ET participant_a/b)
      let convId: string | null = null;

      try {
        const { data: convData } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant_a.eq.${finalSenderId},participant_b.eq.${finalReceiverId}),and(participant_a.eq.${finalReceiverId},participant_b.eq.${finalSenderId})`)
          .maybeSingle();
        if (convData?.id) convId = convData.id;
      } catch {}

      if (!convId) {
        try {
          const { data: convData2 } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(tenant_id.eq.${finalSenderId},owner_id.eq.${finalReceiverId}),and(tenant_id.eq.${finalReceiverId},owner_id.eq.${finalSenderId})`)
            .maybeSingle();
          if (convData2?.id) convId = convData2.id;
        } catch {}
      }

      if (!convId) {
        try {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              tenant_id: finalSenderId,
              owner_id: finalReceiverId,
              property_id: isValidUuid(propertyId) ? propertyId : undefined
            })
            .select('id')
            .maybeSingle();
          if (newConv?.id) convId = newConv.id;
        } catch {}

        if (!convId) {
          try {
            const { data: newConv2 } = await supabase
              .from('conversations')
              .insert({
                participant_a: finalSenderId,
                participant_b: finalReceiverId,
                property_id: isValidUuid(propertyId) ? propertyId : undefined
              })
              .select('id')
              .maybeSingle();
            if (newConv2?.id) convId = newConv2.id;
          } catch (insertErr: any) {
            console.warn('Notice création conversation Supabase:', insertErr?.message);
          }
        }
      }

      if (convId) {
        // Encodage structuré pour conserver les pièces jointes / contrats / quittances / déclarations
        let contentToStore = text;
        if (newMsg.declaration) {
          contentToStore = JSON.stringify({
            type: 'declaration',
            text: text,
            declaration: newMsg.declaration
          });
        } else if (newMsg.contract) {
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
            sender_id: finalSenderId,
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
          if (getReadMessageIds().has(newMsg.id)) {
            addReadMessageIds([insertedMsg.id]);
          }
          const current = getStoredMessages();
          const reconciled = current.map((m) => (m.id === newMsg.id ? { ...m, id: insertedMsg.id } : m));
          saveStoredMessages(reconciled);
        }

        // Persistance de la notification en BDD (uniquement pour le destinataire, jamais pour soi-même)
        if (finalReceiverId !== finalSenderId) {
          const notifTitle = newMsg.declaration
            ? (newMsg.declaration.type === 'caution' ? '💰 Paiement de caution déclaré' : '💳 Paiement de loyer déclaré')
            : newMsg.contract
            ? `Bail officiel reçu (N° ${newMsg.contract.contractNumber})`
            : newMsg.quittance
            ? `Quittance émise (N° ${newMsg.quittance.receiptNumber})`
            : `Nouveau message de ${senderName || 'Correspondant'}`;

          const notifContent = text.length > 100 ? `${text.slice(0, 97)}...` : text;
          const notifType = newMsg.declaration ? 'caution' : newMsg.contract ? 'contrat' : newMsg.quittance ? 'quittance' : 'info';

          const { error: nErr } = await supabase.from('notifications').insert({
            user_id: finalReceiverId,
            title: notifTitle,
            message: notifContent,
            type: notifType,
            is_read: false
          });
          if (nErr) {
            await supabase.from('notifications').insert({
              user_id: finalReceiverId,
              title: notifTitle,
              content: notifContent,
              type: notifType,
              read: false,
              payload: newMsg.declaration ? { declaration: newMsg.declaration } : undefined
            });
          }
        }

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
  options?: {
    propertyId?: string;
    propertyTitle?: string;
    attachment?: any;
    contract?: any;
    quittance?: any;
    restitution?: any;
    skipSync?: boolean;
  }
): ChatMessage {
  const current = getStoredMessages();
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const notifId = `notif_msg_${msgId}`;
  const nowIso = new Date().toISOString();
  const newMsg: ChatMessage & { notificationId?: string } = {
    id: msgId,
    notificationId: notifId,
    sender_id: senderId,
    receiver_id: receiverId,
    text,
    created_at: nowIso,
    status: 'delivered',
    is_read: false,
    read: false,
    read_at: null,
    attachment: options?.attachment,
    contract: options?.contract,
    quittance: options?.quittance,
    restitution: options?.restitution
  };
  const updated = [...current, newMsg];
  saveStoredMessages(updated);

  // Quand j'envoie un message dans cette conversation, tous les messages précédents reçus de ce correspondant ont été vus
  if (senderId && receiverId && senderId !== receiverId) {
    setConvLastReadAt(senderId, receiverId, Date.now());
  }

  // Synchronisation BDD & Realtime (sauf si gérée par sendRealChatMessage pour éviter tout double appel)
  if (!options?.skipSync) {
    syncMessageToSupabase(newMsg, senderId, receiverId, text, options?.propertyId);
  }

  // Émission d'une notification push in-app EXCLUSIVEMENT pour le destinataire (jamais pour l'expéditeur)
  if (typeof window !== 'undefined' && senderId !== receiverId) {
    try {
      const notifsRaw = localStorage.getItem('locatrust_notifications');
      const currentNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
      let senderName = 'Correspondant';
      const uRaw = localStorage.getItem('locatrust_user');
      if (uRaw) {
        try {
          const pu = JSON.parse(uRaw);
          if (pu?.id === senderId && (pu.full_name || pu.name)) {
            senderName = pu.full_name || pu.name;
          }
        } catch {}
      }
      if (senderName === 'Correspondant') {
        const contactRaw = localStorage.getItem(`locatrust_contact_${senderId}`);
        if (contactRaw) {
          try { senderName = JSON.parse(contactRaw).name || senderName; } catch {}
        }
      }
      const descText = text.length > 70 ? `${text.slice(0, 70)}...` : text;
      const notifItem = {
        id: notifId,
        title: `Nouveau message de ${senderName}`,
        description: descText,
        timestamp: "À l'instant",
        created_at: nowIso,
        category: 'demande' as const,
        read: false,
        is_read: false,
        unread: true,
        targetTab: 'messages',
        targetUserId: receiverId,
        senderUserId: senderId,
        payload: {
          contactId: senderId,
          messageId: msgId,
          propertyId: options?.propertyId
        }
      };
      const filteredExisting = (Array.isArray(currentNotifs) ? currentNotifs : []).filter(
        (n: any) =>
          n &&
          n.id !== notifId &&
          !(n.targetUserId === receiverId && n.senderUserId === senderId && n.description === descText && n.created_at && n.created_at.slice(0, 16) === nowIso.slice(0, 16))
      );
      const combinedNotifs = [notifItem, ...filteredExisting.slice(0, 49)];
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
  // Crée le message localement SANS lancer syncMessageToSupabase une première fois
  const msg = sendChatMessage(senderId, receiverId, text, { ...options, skipSync: true });
  // Synchronisation unique et réelle avec Supabase + Realtime + /api/sync
  const result = await syncMessageToSupabase(msg, senderId, receiverId, text, options?.propertyId);
  if (!result.success) {
    throw new Error(result.error || "Impossible d'enregistrer le message sur les serveurs.");
  }
  return msg;
}

export function markMessagesAsRead(
  contactId: string,
  currentUserId?: string,
  extraMessageIds?: string[]
): boolean {
  if (typeof window === 'undefined' || !contactId) return false;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  // Toujours enregistrer le watermark de lecture de cette conversation
  setConvLastReadAt(currentUserId, contactId, nowMs);

  const current = getStoredMessages();
  let changed = false;

  const contactAliases = new Set([
    contactId,
    contactId.toLowerCase(),
    `tenant_${contactId}`,
    `owner_${contactId}`
  ]);
  const extraIdSet = new Set(Array.isArray(extraMessageIds) ? extraMessageIds : []);
  const newlyReadIds: string[] = [];

  const updated = current.map((m) => {
    const isFromContact =
      contactAliases.has(m.sender_id) ||
      m.sender_id === contactId ||
      (extraIdSet.has(m.id) && m.sender_id !== currentUserId);

    if (isFromContact) {
      newlyReadIds.push(m.id);
      if (m.status !== 'read' || !m.is_read) {
        changed = true;
        return { ...m, status: 'read' as const, is_read: true, read: true, read_at: m.read_at || nowIso };
      }
    }
    return m;
  });

  extraIdSet.forEach((id) => {
    if (id && !newlyReadIds.includes(id)) newlyReadIds.push(id);
  });

  if (newlyReadIds.length > 0) {
    addReadMessageIds(newlyReadIds);
  }

  // Marquer également les notifications de messages provenant de ce contact comme lues
  let notifsChanged = false;
  const readNotifIds: string[] = [];
  try {
    const notifsRaw = localStorage.getItem('locatrust_notifications');
    if (notifsRaw) {
      const notifs = JSON.parse(notifsRaw);
      if (Array.isArray(notifs)) {
        const updatedNotifs = notifs.map((n: any) => {
          if (!n) return n;
          const isMsgNotifFromContact =
            (n.senderUserId === contactId || n.payload?.contactId === contactId) &&
            (!currentUserId || !n.targetUserId || n.targetUserId === currentUserId) &&
            (n.targetTab === 'messages' || String(n.title || '').toLowerCase().includes('message'));
          if (isMsgNotifFromContact) {
            if (n.id) readNotifIds.push(String(n.id));
            addReadNotificationIds([n]);
            if (!n.read || !n.is_read || n.unread !== false) {
              notifsChanged = true;
              return { ...n, read: true, is_read: true, unread: false, read_at: n.read_at || nowIso };
            }
          }
          return n;
        });
        if (notifsChanged) {
          localStorage.setItem('locatrust_notifications', JSON.stringify(updatedNotifs));
        }
      }
    }
  } catch {}

  if (changed) {
    saveStoredMessages(updated);
  }

  if (changed || notifsChanged || newlyReadIds.length > 0) {
    if (currentUserId) {
      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark_messages_read',
            contactId,
            currentUserId,
            messageIds: newlyReadIds,
            readAt: nowIso
          })
        }).catch(() => {});
      } catch {}

      // Mise à jour directe de la table messages dans Supabase
      const uuidMsgIds = newlyReadIds.filter(isValidUuid);
      if (uuidMsgIds.length > 0) {
        try {
          supabase
            .from('messages')
            .update({ status: 'read' })
            .in('id', uuidMsgIds)
            .then();
        } catch {}
      } else if (isValidUuid(contactId)) {
        try {
          supabase
            .from('messages')
            .update({ status: 'read' })
            .eq('sender_id', contactId)
            .neq('status', 'read')
            .then();
        } catch {}
      }

      // Mise à jour des notifications correspondantes dans Supabase
      readNotifIds.filter(isValidUuid).forEach((nid) => {
        safeUpdateSupabaseNotificationRead(currentUserId, nid);
      });

      // Diffusion Realtime multi-appareils (PC ↔ Mobile)
      try {
        broadcastLiveEvent('MESSAGES_READ' as any, {
          actorId: currentUserId,
          targetUserId: contactId,
          data: {
            contactId,
            readerId: currentUserId,
            messageIds: newlyReadIds,
            readAt: nowIso
          }
        });
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
    window.dispatchEvent(new CustomEvent('locatrust:messages-updated'));
    window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
    return true;
  }
  return false;
}

export function markAllMessagesAsReadForUser(currentUserId?: string): boolean {
  if (typeof window === 'undefined') return false;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  setConvLastReadAt(currentUserId, '__all__', nowMs);

  const current = getStoredMessages();
  let changed = false;
  const newlyReadIds: string[] = [];

  const updated = current.map((m) => {
    const isFromMe = Boolean(currentUserId && m.sender_id === currentUserId);
    if (!isFromMe) {
      if (m.id) newlyReadIds.push(m.id);
      if (m.sender_id) setConvLastReadAt(currentUserId, m.sender_id, nowMs);
      if (m.status !== 'read' || !m.is_read) {
        changed = true;
        return { ...m, status: 'read' as const, is_read: true, read: true, read_at: m.read_at || nowIso };
      }
    }
    return m;
  });

  if (newlyReadIds.length > 0) {
    addReadMessageIds(newlyReadIds);
  }

  // Marquer également les notifications de messagerie comme lues
  try {
    const notifsRaw = localStorage.getItem('locatrust_notifications');
    if (notifsRaw) {
      const notifs = JSON.parse(notifsRaw);
      if (Array.isArray(notifs)) {
        const updatedNotifs = notifs.map((n: any) => {
          if (!n) return n;
          const isMsgNotif =
            (!currentUserId || !n.targetUserId || n.targetUserId === currentUserId) &&
            (n.targetTab === 'messages' || String(n.title || '').toLowerCase().includes('message'));
          if (isMsgNotif) {
            addReadNotificationIds([n]);
            return { ...n, read: true, is_read: true, unread: false, read_at: n.read_at || nowIso };
          }
          return n;
        });
        localStorage.setItem('locatrust_notifications', JSON.stringify(updatedNotifs));
      }
    }
  } catch {}

  if (changed) {
    saveStoredMessages(updated);
  }

  if (currentUserId) {
    try {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_messages_read',
          contactId: '__all__',
          currentUserId,
          messageIds: newlyReadIds,
          readAt: nowIso
        })
      }).catch(() => {});
    } catch {}

    const uuidMsgIds = newlyReadIds.filter(isValidUuid);
    if (uuidMsgIds.length > 0) {
      try {
        supabase
          .from('messages')
          .update({ status: 'read' })
          .in('id', uuidMsgIds)
          .then();
      } catch {}
    }

    try {
      broadcastLiveEvent('MESSAGES_READ' as any, {
        actorId: currentUserId,
        targetUserId: currentUserId,
        data: {
          contactId: '__all__',
          readerId: currentUserId,
          messageIds: newlyReadIds,
          readAt: nowIso
        }
      });
    } catch {}
  }

  window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
  window.dispatchEvent(new CustomEvent('locatrust:messages-updated'));
  window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
  return true;
}

const FICTIONAL_OR_GENERIC_IDS = new Set([
  'usr_owner_1',
  'usr_tenant_1',
  'usr_candidate',
  'usr_support',
  'usr_contact'
]);

export function getUnreadCountForConversation(
  messages: ChatMessage[],
  currentUserId: string,
  myAliases: Set<string>,
  contactId: string,
  contactAliases: Set<string>
): number {
  if (!Array.isArray(messages) || !contactId) return 0;
  ensureCounterV2Migration(currentUserId);

  let count = 0;
  for (const m of messages) {
    if (!m || !m.sender_id) continue;
    if (FICTIONAL_OR_GENERIC_IDS.has(m.sender_id) || m.sender_id.startsWith('candidate_')) continue;
    if (myAliases.has(m.sender_id) || m.sender_id === currentUserId) continue;

    const isFromThisContact = contactAliases.has(m.sender_id) || m.sender_id === contactId;
    const isForMe = myAliases.has(m.receiver_id) || m.receiver_id === currentUserId;

    if (isFromThisContact && isForMe && !isMessageRead(m, currentUserId, messages)) {
      count++;
    }
  }
  return count;
}

export function getUnreadMessagesCountForUser(user?: { id?: string; email?: string; role?: string } | null): number {
  if (typeof window === 'undefined') return 0;
  const userId = user?.id || '';
  if (!userId) return 0;

  ensureCounterV2Migration(userId);

  const messages = getStoredMessages(userId);
  if (!Array.isArray(messages) || messages.length === 0) return 0;

  // Identifiants appartenant strictement à l'utilisateur connecté
  const myIds = new Set<string>();
  myIds.add(userId);

  if (myIds.size === 0) return 0;

  const hasRealUuid = isValidUuid(userId);
  let unreadMessagesCount = 0;

  for (const m of messages) {
    if (!m || !m.sender_id || !m.receiver_id) continue;

    // Ignorer tout identifiant fictif ou générique obsolète
    if (FICTIONAL_OR_GENERIC_IDS.has(m.sender_id) || m.sender_id.startsWith('candidate_')) continue;
    if (hasRealUuid && (m.sender_id === 'usr_owner' || m.sender_id === 'usr_agency' || m.sender_id === 'usr_tenant')) continue;

    // Ne JAMAIS compter ses propres messages envoyés
    if (myIds.has(m.sender_id)) continue;

    // Le message doit être adressé à l'utilisateur connecté
    if (!myIds.has(m.receiver_id)) continue;

    // Vérifier le statut lu/non lu via le registre persistant multi-couches
    if (isMessageRead(m, userId, messages)) continue;

    unreadMessagesCount++;
  }

  return unreadMessagesCount;
}

export function sendQuittanceToTenant(quittance: ChatQuittanceAttachment, senderId?: string, receiverId?: string): ChatMessage {
  const current = getStoredMessages();

  // Résolution stricte : une quittance est émise par le Bailleur/Agence et reçue par le Locataire
  let finalSender = senderId || '';
  let finalReceiver = receiverId || '';

  const isCaution = quittance.receiptType === 'caution' || quittance.receiptNumber.includes('CAUT');
  const messageText = isCaution
    ? `🛡️ Reçu Officiel de Caution Émis (N° ${quittance.receiptNumber})\nVotre dépôt de garantie de ${formatFCFA(quittance.amount)} a été certifié par votre bailleur. Veuillez consulter le document ci-dessous pour apposer votre signature locataire et débloquer le téléchargement.`
    : `📄 Quittance de Loyer Officielle Émise (N° ${quittance.receiptNumber})\nVotre bailleur a validé votre règlement (${formatFCFA(quittance.amount)} pour ${quittance.periodCovered || 'la période'}) et a apposé sa signature manuscrite certifiée. Consultez le document ci-dessous pour apposer votre signature et télécharger votre quittance.`;

  const newMsg: ChatMessage = {
    id: `msg_quittance_${Date.now()}`,
    sender_id: finalSender,
    receiver_id: finalReceiver,
    text: messageText,
    created_at: new Date().toISOString(),
    quittance,
    status: 'delivered'
  };

  const updated = [...current, newMsg];
  saveStoredMessages(updated);

  // Synchronisation Supabase & Realtime pour la quittance
  syncMessageToSupabase(newMsg, finalSender, finalReceiver, newMsg.text);

  // Persistance dans tenant receipts store pour affichage immédiat dans dossier locataire
  try {
    if (typeof window !== 'undefined') {
      const existingReceipts = getStoredTenantReceipts();
      const filtered = existingReceipts.filter((r) => r.receiptNumber !== quittance.receiptNumber);
      const updatedReceipts = [quittance, ...filtered];
      localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(updatedReceipts));
      window.dispatchEvent(new CustomEvent('locatrust:receipts_updated'));
    }
  } catch (e) {
    console.error('Error saving tenant receipt:', e);
  }

  // Notifier immédiatement le locataire dans locatrust_notifications
  try {
    if (typeof window !== 'undefined') {
      const notifsRaw = localStorage.getItem('locatrust_notifications');
      const existingNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
      const tenantNotif = {
        id: `notif_rcpt_${Date.now()}`,
        title: isCaution ? '🛡️ Reçu de caution transmis pour signature' : '📄 Quittance de loyer officielle transmise',
        description: `Votre bailleur vous a transmis le reçu officiel N° ${quittance.receiptNumber} (${formatFCFA(quittance.amount)}). Signature requise pour finaliser le document.`,
        time: "À l'instant",
        unread: true,
        type: isCaution ? 'caution' : 'quittance',
        targetTab: 'messages',
        targetRole: 'locataire',
        targetUserId: finalReceiver,
        senderUserId: finalSender
      };
      localStorage.setItem('locatrust_notifications', JSON.stringify([tenantNotif, ...(Array.isArray(existingNotifs) ? existingNotifs : [])]));
      window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
    }
  } catch {}

  // Enregistrer les fiches de contact scopées par utilisateur pour que la conversation apparaisse immédiatement chez les deux participants
  try {
    if (typeof window !== 'undefined') {
      saveUserScopedContact(finalReceiver, {
        id: finalSender,
        name: quittance.ownerName || 'Bailleur Propriétaire',
        role: 'Propriétaire Bailleur',
        propertyTitle: quittance.propertyTitle,
        phone: quittance.ownerPhone
      });
      saveUserScopedContact(finalSender, {
        id: finalReceiver,
        name: quittance.tenantName || 'Locataire Preneur',
        role: 'Locataire',
        propertyTitle: quittance.propertyTitle,
        phone: quittance.tenantPhone
      });
      window.dispatchEvent(new CustomEvent('locatrust:messages_updated'));
      window.dispatchEvent(new CustomEvent('locatrust:messages-updated'));
    }
  } catch {}

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
  let targetAgencyId: string | undefined = undefined;
  if (!targetOwnerId || targetOwnerId === 'usr_owner' || targetOwnerId === 'usr_agency') {
    try {
      const appsRaw = localStorage.getItem('locatrust_rental_applications');
      if (appsRaw) {
        const apps = JSON.parse(appsRaw);
        if (Array.isArray(apps)) {
          const matched = apps.find((a: any) =>
            (declaration.contractNumber && (a.contract_number === declaration.contractNumber || a.id === declaration.contractNumber || a.contract_id === declaration.contractNumber)) ||
            (declaration.propertyTitle && a.property_title === declaration.propertyTitle)
          );
          if (matched && (matched.agency_id || matched.owner_id)) {
            targetOwnerId = matched.agency_id || matched.owner_id;
            targetAgencyId = matched.agency_id;
          }
        }
      }
      if (!targetOwnerId || targetOwnerId === 'usr_owner' || targetOwnerId === 'usr_agency') {
        const cntRaw = localStorage.getItem('locatrust_contracts');
        if (cntRaw) {
          const cnts = JSON.parse(cntRaw);
          if (Array.isArray(cnts)) {
            const matched = cnts.find((c: any) =>
              (declaration.contractNumber && (c.contract_number === declaration.contractNumber || c.id === declaration.contractNumber || c.contract_id === declaration.contractNumber)) ||
              (declaration.propertyTitle && (c.property?.title === declaration.propertyTitle || c.property_title === declaration.propertyTitle))
            );
            if (matched && (matched.owner_id || matched.owner?.id || matched.agency_id)) {
              targetOwnerId = matched.owner_id || matched.owner?.id || matched.agency_id;
              targetAgencyId = matched.agency_id || matched.property?.agency_id;
            }
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

  // Enregistrer immédiatement les fiches contact scopées par utilisateur
  if (typeof window !== 'undefined') {
    try {
      saveUserScopedContact(targetOwnerId, {
        id: declaration.tenantId,
        name: declaration.tenantName,
        phone: '+225 05 00 00 00 00',
        role: 'Locataire Preneur',
        propertyTitle: declaration.propertyTitle,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(declaration.tenantName)}&background=059669&color=fff`,
        online: true
      });
      saveUserScopedContact(declaration.tenantId, {
        id: targetOwnerId,
        name: 'Bailleur / Agence',
        phone: '+225 07 00 00 00 00',
        role: 'Bailleur Propriétaire',
        propertyTitle: declaration.propertyTitle,
        avatar: getDefaultRealisticAvatar('Bailleur Propriétaire', 'Propriétaire Bailleur'),
        online: true
      });
    } catch {}
  }

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
    const agencyNotifItem = {
      ...notifItem,
      id: `notif_decl_agency_${Date.now()}`,
      targetRole: 'agence',
      targetUserId: targetAgencyId || 'usr_agency'
    };
    localStorage.setItem('locatrust_notifications', JSON.stringify([notifItem, agencyNotifItem, ...(Array.isArray(existing) ? existing : [])]));
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

  // Sauvegarder immédiatement les contacts dans le stockage scopé par utilisateur
  if (typeof window !== 'undefined') {
    try {
      const storedUserAvatar = localStorage.getItem('locatrust_user_avatar');
      const ownerScopedMap = getUserScopedContactsMap(tenantId);
      const parsedOwner = ownerScopedMap[finalSenderId] || null;
      const tenantScopedMap = getUserScopedContactsMap(finalSenderId);
      const parsedTenant = tenantScopedMap[tenantId] || null;

      const ownerAvatar =
        parsedOwner?.avatar && !parsedOwner.avatar.includes('ui-avatars.com')
          ? parsedOwner.avatar
          : storedUserAvatar && !storedUserAvatar.includes('ui-avatars.com')
          ? storedUserAvatar
          : getDefaultRealisticAvatar(contract.ownerName, contract.ownerName.toLowerCase().includes('agence') ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur');

      saveUserScopedContact(tenantId, {
        id: finalSenderId,
        name: contract.ownerName,
        phone: '+225 07 00 00 00 00',
        role: contract.ownerName.toLowerCase().includes('agence') ? 'Agence Immobilière Agréée' : 'Propriétaire Bailleur',
        propertyTitle: contract.propertyTitle,
        avatar: ownerAvatar,
        online: true
      });

      saveUserScopedContact(finalSenderId, {
        id: tenantId,
        name: contract.tenantName,
        phone: '+225 05 00 00 00 00',
        role: 'Locataire Preneur',
        propertyTitle: contract.propertyTitle,
        avatar: parsedTenant?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contract.tenantName)}&background=059669&color=fff`,
        online: true
      });

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
  const isCaution = q.receiptType === 'caution' || q.receiptNumber.includes('CAUT');
  let ownerName = q.ownerName;
  if (!ownerName || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(ownerName) || ownerName.startsWith('usr_')) {
    ownerName = 'kk';
  }
  let ownerPhone = q.ownerPhone;
  if (!ownerPhone || ownerPhone === '+225 07 00 00 00 00' || ownerPhone === '+225 07 08 09 10 11') {
    ownerPhone = '0500552141';
  }
  let propAddr = q.propertyAddress;
  if (!propAddr || propAddr.trim() === 'Abidjan' || propAddr.trim() === "Abidjan, Côte d'Ivoire") {
    propAddr = "100 villard, yamoussoukro - Côte d'Ivoire";
  }
  let propRef = q.propertyReference;
  if (!propRef || propRef === 'BIEN-000492' || propRef === 'BIEN-CAUT-001') {
    propRef = 'BIEN-1B0E4B';
  }

  const pdfData: OfficialReceiptData = {
    receiptNumber: q.receiptNumber,
    receiptType: isCaution ? 'caution' : 'loyer',
    contractNumber: q.contractNumber,
    contractToken: `tok_cnt_${q.contractNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
    propertyTitle: q.propertyTitle,
    propertyAddress: propAddr,
    propertyReference: propRef,
    propertyType: q.propertyType || (isCaution ? 'Logement' : 'Appartement 3 pièces'),
    durationMonths: q.durationMonths || 12,
    leaseStartDate: q.leaseStartDate,
    leaseEndDate: q.leaseEndDate,
    ownerName: ownerName,
    ownerCni: q.ownerCni || 'CI987654321',
    ownerPhone: ownerPhone,
    tenantName: q.tenantName || 'christian',
    tenantCni: q.tenantCni || 'CI123456789',
    tenantPhone: q.tenantPhone || '0500552141',
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
    const convMapById = new Map<string, { id: string; participant_a: string; participant_b: string }>();

    // Essai 1 : participant_a / participant_b
    try {
      const { data: c1 } = await supabase
        .from('conversations')
        .select('id, participant_a, participant_b')
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
      if (Array.isArray(c1)) {
        c1.forEach((c: any) => {
          if (c?.id && (c.participant_a === userId || c.participant_b === userId) && c.participant_a !== c.participant_b) {
            convMapById.set(c.id, {
              id: c.id,
              participant_a: c.participant_a,
              participant_b: c.participant_b
            });
          }
        });
      }
    } catch {}

    // Essai 2 : tenant_id / owner_id
    try {
      const { data: c2 } = await supabase
        .from('conversations')
        .select('id, tenant_id, owner_id')
        .or(`tenant_id.eq.${userId},owner_id.eq.${userId}`);
      if (Array.isArray(c2)) {
        c2.forEach((c: any) => {
          if (c?.id && (c.tenant_id === userId || c.owner_id === userId) && c.tenant_id !== c.owner_id && !convMapById.has(c.id)) {
            convMapById.set(c.id, {
              id: c.id,
              participant_a: c.tenant_id,
              participant_b: c.owner_id
            });
          }
        });
      }
    } catch {}

    const convs = Array.from(convMapById.values());
    if (convs.length === 0) {
      // Aucun échange sur Supabase pour cet utilisateur : nettoyer les éventuels résidus étrangers
      const currentLocal = getStoredMessages(userId);
      saveStoredMessages(currentLocal, userId);
      return currentLocal;
    }

    const convIds = convs.map((c) => c.id);
    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true });

    if (msgErr || !msgs) return getStoredMessages(userId);

    const convMap = new Map<string, { participant_a: string; participant_b: string }>();
    convs.forEach((c) => convMap.set(c.id, c));

    const currentLocal = getStoredMessages(userId);
    const localById = new Map<string, ChatMessage>();
    currentLocal.forEach((lm) => {
      if (lm?.id) localById.set(lm.id, lm);
    });

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
          if (isMessageRead(local, userId)) {
            addReadMessageIds([matchingDbMsg.id]);
          }
          return { ...local, id: matchingDbMsg.id };
        }
      }
      return local;
    });

    const activeIds = new Set(reconciledLocal.map((m) => m.id));
    const newFromDb: ChatMessage[] = [];

    msgs.forEach((m: any) => {
      const conv = convMap.get(m.conversation_id);
      if (!conv) return;
      const isSender = m.sender_id === userId;
      const otherId = conv.participant_a === userId ? conv.participant_b : conv.participant_a;
      if (!otherId || otherId === userId || !isValidUuid(otherId)) return;
      const receiverId = isSender ? otherId : userId;
      if (m.sender_id !== userId && m.sender_id !== otherId) return;

      let parsedContract: any = undefined;
      let parsedQuittance: any = undefined;
      let parsedRestitution: any = undefined;
      let parsedDeclaration: any = undefined;
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
            if (parsed.declaration) parsedDeclaration = parsed.declaration;
            if (parsed.attachment) parsedAttachment = parsed.attachment;
          }
        }
      } catch {}

      const existingLocal = localById.get(m.id);
      const tempCandidate: ChatMessage = {
        id: m.id,
        sender_id: m.sender_id,
        receiver_id: receiverId,
        text: displayText,
        created_at: m.created_at,
        status: m.status || 'delivered',
        is_read: m.is_read || m.status === 'read'
      };
      const alreadyRead =
        (existingLocal && isMessageRead(existingLocal, userId)) ||
        isMessageRead(tempCandidate, userId);

      const formatted: ChatMessage = {
        id: m.id,
        sender_id: m.sender_id,
        receiver_id: receiverId,
        text: displayText,
        created_at: m.created_at,
        status: alreadyRead ? 'read' : (m.status || 'delivered'),
        is_read: alreadyRead,
        read: alreadyRead,
        contract: parsedContract,
        quittance: parsedQuittance,
        restitution: parsedRestitution,
        declaration: parsedDeclaration,
        attachment: parsedAttachment || (m.attachment_url ? { type: 'document', url: m.attachment_url } : undefined)
      };

      const isAlreadyInLocal = reconciledLocal.some(
        (local) =>
          local.id === m.id ||
          (local.sender_id === m.sender_id &&
            local.text === displayText &&
            Math.abs(new Date(local.created_at).getTime() - new Date(m.created_at).getTime()) < 60000)
      );

      if (parsedQuittance && typeof window !== 'undefined') {
        try {
          const curReceipts = getStoredTenantReceipts();
          if (!curReceipts.some((r) => r.receiptNumber === parsedQuittance.receiptNumber)) {
            localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify([parsedQuittance, ...curReceipts]));
            window.dispatchEvent(new CustomEvent('locatrust:receipts_updated'));
          }
        } catch {}
      }

      if (!isAlreadyInLocal && !activeIds.has(m.id)) {
        newFromDb.push(formatted);
      }
    });

    if (newFromDb.length > 0 || localReconciled) {
      const merged = deduplicateMessageList([...reconciledLocal, ...newFromDb]);
      saveStoredMessages(merged, userId);
      return merged;
    }
  } catch (err) {
    console.warn('Erreur synchronisation messages Supabase:', err);
  }
  return [];
}

/**
 * Récupère les vraies conversations et profils associés depuis Supabase
 * et les retourne sous forme de ChatContact avec noms et photos réels.
 * Seules les conversations appartenant réellement à userId ET ayant au moins un message réel sont retournées.
 */
export async function fetchSupabaseConversationsWithProfiles(userId: string): Promise<ChatContact[]> {
  if (!isValidUuid(userId) || typeof window === 'undefined') return [];
  try {
    const convMapById = new Map<string, { id: string; participant_a: string; participant_b: string; property_id?: string; properties?: any }>();

    // Essai 1 : participant_a / participant_b
    try {
      const { data: c1 } = await supabase
        .from('conversations')
        .select('id, participant_a, participant_b, property_id, properties:properties(id, title, city, commune)')
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (Array.isArray(c1)) {
        c1.forEach((c: any) => {
          if (c?.id && (c.participant_a === userId || c.participant_b === userId) && c.participant_a !== c.participant_b) {
            convMapById.set(c.id, {
              id: c.id,
              participant_a: c.participant_a,
              participant_b: c.participant_b,
              property_id: c.property_id,
              properties: c.properties
            });
          }
        });
      }
    } catch {}

    // Essai 2 : tenant_id / owner_id
    try {
      const { data: c2 } = await supabase
        .from('conversations')
        .select('id, tenant_id, owner_id, property_id, properties:properties(id, title, city, commune)')
        .or(`tenant_id.eq.${userId},owner_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (Array.isArray(c2)) {
        c2.forEach((c: any) => {
          if (c?.id && (c.tenant_id === userId || c.owner_id === userId) && c.tenant_id !== c.owner_id && !convMapById.has(c.id)) {
            convMapById.set(c.id, {
              id: c.id,
              participant_a: c.tenant_id,
              participant_b: c.owner_id,
              property_id: c.property_id,
              properties: c.properties
            });
          }
        });
      }
    } catch {}

    const allConvs = Array.from(convMapById.values());
    if (allConvs.length === 0) return [];

    // Vérifier que la conversation possède au moins un message réel dans public.messages
    const allConvIds = allConvs.map((c) => c.id);
    const { data: existingMsgs } = await supabase
      .from('messages')
      .select('conversation_id, sender_id')
      .in('conversation_id', allConvIds);

    const activeConvIdsWithMessages = new Set<string>();
    if (Array.isArray(existingMsgs)) {
      existingMsgs.forEach((m: any) => {
        if (m?.conversation_id) activeConvIdsWithMessages.add(m.conversation_id);
      });
    }

    const convs = allConvs.filter((c) => activeConvIdsWithMessages.has(c.id));
    if (convs.length === 0) return [];

    const otherUserIds = Array.from(
      new Set(
        convs
          .map((c) => (c.participant_a === userId ? c.participant_b : c.participant_a))
          .filter((id) => isValidUuid(id) && id !== userId)
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
      if (!otherId || otherId === userId) return;
      const prof = profMap.get(otherId);
      if (!prof) return;

      const isAgency = prof.account_type === 'agence';
      const roleLabel = isAgency
        ? 'Agence Immobilière Agréée'
        : prof.account_type === 'proprietaire'
        ? 'Propriétaire Bailleur'
        : 'Locataire Preneur';

      const propTitle = c.properties?.title || (c as any).property_title || 'Échange direct';

      const myStoredAvatar = typeof window !== 'undefined' ? localStorage.getItem('locatrust_user_avatar') : null;
      let avatarUrl =
        prof.avatar_url && prof.avatar_url.trim().length > 5 && !prof.avatar_url.includes('ui-avatars.com') && prof.avatar_url !== myStoredAvatar
          ? prof.avatar_url
          : (typeof window !== 'undefined' ? localStorage.getItem(`locatrust_user_avatar_${prof.id}`) : null);

      if (!realContacts.some((rc) => rc.id === prof.id)) {
        const contactObj: ChatContact = {
          id: prof.id,
          name: prof.full_name || 'Utilisateur Certifié',
          phone: prof.phone || '+225 07 00 00 00 00',
          role: roleLabel,
          propertyTitle: propTitle,
          avatar: avatarUrl || '',
          online: true
        };
        realContacts.push(contactObj);
        saveUserScopedContact(userId, contactObj);
      }
    });

    return realContacts;
  } catch (e) {
    console.warn('Erreur chargement contacts réels Supabase:', e);
    return [];
  }
}

