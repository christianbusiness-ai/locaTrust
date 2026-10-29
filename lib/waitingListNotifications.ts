'use client';

import {
  getStoredMessages,
  saveStoredMessages,
  ChatMessage,
  addReadNotificationIds,
  isNotificationRead,
  getNotificationFingerprint,
  setConvLastReadAt,
  safeUpdateSupabaseNotificationRead,
  isValidUuid
} from '@/lib/messagingStore';
import { supabase } from '@/src/lib/supabase';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';

export interface WaitingListCandidateNotification {
  candidateId: string;
  candidateName: string;
  candidatePhone?: string;
  candidateEmail?: string;
  propertyTitle: string;
  propertyAddress: string;
  contractNumber: string;
  finalizedDate: string;
  message: string;
}

export const NOTIFICATIONS_STORAGE_KEY = 'locatrust_notifications';
export const APPLICATIONS_STORAGE_KEY = 'locatrust_rental_applications';

export interface GlobalNotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  category: 'demande' | 'visite' | 'paiement' | 'contrat' | 'caution' | 'maintenance' | 'abonnement';
  read: boolean;
  targetTab: string;
  targetUserId?: string;
  targetRole?: 'proprietaire' | 'locataire' | 'agence';
  senderUserId?: string;
  senderAvatar?: string;
}

// Candidats par défaut (vide pour garantir des données réelles uniquement)
const DEFAULT_APPLICATIONS: any[] = [];

/**
 * Notifie automatiquement tous les demandeurs de contrat / candidats en liste d'attente
 * lorsqu'un bailleur finalise un contrat de bail pour un logement donné.
 */
export function notifyWaitingListCandidatesOnLeaseFinalized({
  propertyTitle,
  propertyAddress = '',
  chosenTenantName,
  contractNumber
}: {
  propertyTitle: string;
  propertyAddress?: string;
  chosenTenantName: string;
  contractNumber: string;
}): WaitingListCandidateNotification[] {
  if (typeof window === 'undefined') return [];

  // 1. Récupération des candidatures enregistrées ou par défaut
  let storedApps: any[] = [];
  try {
    const raw = localStorage.getItem(APPLICATIONS_STORAGE_KEY);
    if (raw) {
      storedApps = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Erreur lecture applications:', e);
  }

  if (!storedApps || storedApps.length === 0) {
    storedApps = [];
  }

  // Normalisation pour recherche flexible
  const normTitle = propertyTitle.toLowerCase().trim();
  const normChosen = chosenTenantName.toLowerCase().trim();

  // Filtrer les candidats sur ce bien qui ne sont PAS le locataire choisi
  const competingCandidates = storedApps.filter((app) => {
    const appTitle = (app.property_title || '').toLowerCase().trim();
    const appName = (app.tenant_name || '').toLowerCase().trim();

    // Même bien ou correspondance forte
    const isSameProperty =
      appTitle.includes(normTitle) ||
      normTitle.includes(appTitle) ||
      (normTitle.includes('appartement') && appTitle.includes('appartement a'));

    // Candidat différent du locataire finalisé
    const isDifferentTenant = !appName.includes(normChosen) && !normChosen.includes(appName);

    return isSameProperty && isDifferentTenant;
  });

  const notificationsGenerated: WaitingListCandidateNotification[] = [];
  const now = new Date().toISOString();

  // 2. Mettre à jour les candidatures dans le localStorage
  const updatedApps = storedApps.map((app) => {
    const isComp = competingCandidates.some((c) => c.id === app.id);
    if (isComp) {
      return {
        ...app,
        status: 'refusee',
        unavailable_reason: `Logement loué : Bail N° ${contractNumber} finalisé avec un autre locataire`,
        date_notified: now
      };
    }
    const appName = (app.tenant_name || '').toLowerCase().trim();
    if (appName.includes(normChosen) || normChosen.includes(appName)) {
      return {
        ...app,
        status: 'contrat_actif',
        contract_number: contractNumber
      };
    }
    return app;
  });

  try {
    localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(updatedApps));
    window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { updatedApps } }));
  } catch (e) {
    console.warn('Erreur sauvegarde applications:', e);
  }

  // 3. Ajouter les notifications dans le centre de notifications global (Header Bell)
  let currentNotifs: GlobalNotificationItem[] = [];
  try {
    const rawNotifs = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (rawNotifs) {
      currentNotifs = JSON.parse(rawNotifs);
    }
  } catch (e) {
    console.warn('Erreur lecture notifications:', e);
  }

  const newNotifs: GlobalNotificationItem[] = [];

  for (const candidate of competingCandidates) {
    const message = `Bonjour ${candidate.tenant_name}, nous vous informons que le logement « ${propertyTitle} » pour lequel vous étiez sur la liste d'attente n'est plus disponible. Le bailleur a finalisé un contrat de bail officiel avec un autre preneur.`;

    notificationsGenerated.push({
      candidateId: candidate.id,
      candidateName: candidate.tenant_name,
      candidatePhone: candidate.tenant_phone,
      candidateEmail: candidate.tenant_email,
      propertyTitle,
      propertyAddress,
      contractNumber,
      finalizedDate: now,
      message
    });

    // Notification système
    newNotifs.push({
      id: `notif_waitlist_${candidate.id}_${Date.now()}`,
      title: `Logement non disponible : ${propertyTitle}`,
      description: `Notification envoyée à ${candidate.tenant_name} (Liste d'attente) : Le bien a été attribué et finalisé sous le contrat N° ${contractNumber}.`,
      timestamp: "À l'instant",
      category: 'demande',
      read: false,
      targetTab: 'applications'
    });

    // 4. Ajouter également un message direct dans la messagerie
    try {
      const messages = getStoredMessages();
      const chatMsg: ChatMessage = {
        id: `msg_waitlist_notify_${candidate.id}_${Date.now()}`,
        sender_id: 'usr_owner_1',
        receiver_id: candidate.id || 'usr_candidate',
        text: `📢 INFORMATION LISTE D'ATTENTE :\n${message}\n\nNous vous remercions pour l'intérêt porté à notre patrimoine et conservons votre dossier certifié pour nos prochaines disponibilités.`,
        created_at: now,
        status: 'delivered'
      };
      saveStoredMessages([...messages, chatMsg]);
    } catch (e) {
      console.warn('Erreur envoi message chat liste attente:', e);
    }
  }

  // Sauvegarder les notifications dans le Header
  if (newNotifs.length > 0) {
    const combinedNotifs = [...newNotifs, ...currentNotifs];
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(combinedNotifs));
      window.dispatchEvent(
        new CustomEvent('locatrust:notifications-updated', {
          detail: { notifications: combinedNotifs }
        })
      );
    } catch (e) {
      console.warn('Erreur sauvegarde notifications:', e);
    }
  }

  return notificationsGenerated;
}

export function deduplicateAndNormalizeNotifications(list: any[], userId?: string): any[] {
  if (!Array.isArray(list)) return [];
  const byId = new Map<string, any>();
  const byFp = new Map<string, any>();
  const result: any[] = [];

  for (const raw of list) {
    if (!raw) continue;
    const isRead = isNotificationRead(raw, userId);
    const title = String(raw.title || '').replace(/christian\s+yao\s+koffi/gi, 'Christian');
    const description = String(raw.description || raw.content || raw.message || '').replace(/christian\s+yao\s+koffi/gi, 'Christian');
    const normalized = {
      ...raw,
      title,
      description,
      timestamp: raw.timestamp || raw.time || "À l'instant",
      time: raw.time || raw.timestamp || "À l'instant",
      read: isRead,
      is_read: isRead,
      unread: !isRead
    };

    const idKey = normalized.id ? String(normalized.id) : '';
    const fpKey = getNotificationFingerprint(normalized);

    if (idKey && byId.has(idKey)) {
      const existing = byId.get(idKey)!;
      if (isRead && !existing.read) {
        existing.read = true;
        existing.is_read = true;
        existing.unread = false;
      }
      continue;
    }

    if (fpKey && byFp.has(fpKey)) {
      const existing = byFp.get(fpKey)!;
      if (isRead && !existing.read) {
        existing.read = true;
        existing.is_read = true;
        existing.unread = false;
      }
      if (idKey) byId.set(idKey, existing);
      continue;
    }

    if (idKey) byId.set(idKey, normalized);
    if (fpKey) byFp.set(fpKey, normalized);
    result.push(normalized);
  }

  return result;
}

export function markNotificationAsRead(notifOrId: any, userId?: string) {
  if (typeof window === 'undefined' || !notifOrId) return;
  const nowIso = new Date().toISOString();
  const targetId = typeof notifOrId === 'string' ? notifOrId : String(notifOrId.id || '');
  const targetFp = typeof notifOrId === 'object' ? getNotificationFingerprint(notifOrId) : '';

  addReadNotificationIds([notifOrId]);

  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const matchedItems: any[] = [];
        const updated = list.map((n: any) => {
          if (!n) return n;
          const nFp = getNotificationFingerprint(n);
          if (String(n.id) === targetId || (targetFp && nFp === targetFp)) {
            matchedItems.push(n);
            return { ...n, read: true, is_read: true, unread: false, read_at: n.read_at || nowIso };
          }
          return n;
        });
        addReadNotificationIds(matchedItems);
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: updated } }));
      }
    }
  } catch {}

  try {
    const tRaw = localStorage.getItem('locatrust_tenant_notifications');
    if (tRaw) {
      const tList = JSON.parse(tRaw);
      if (Array.isArray(tList)) {
        const updatedT = tList.map((n: any) =>
          n && (String(n.id) === targetId || (targetFp && getNotificationFingerprint(n) === targetFp))
            ? { ...n, read: true, is_read: true, unread: false }
            : n
        );
        localStorage.setItem('locatrust_tenant_notifications', JSON.stringify(updatedT));
      }
    }
  } catch {}

  safeUpdateSupabaseNotificationRead(userId, targetId);

  try {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark_notification_read',
        notificationId: targetId,
        userId
      })
    }).catch(() => {});
  } catch {}

  try {
    broadcastLiveEvent('NOTIFICATION_READ' as any, {
      actorId: userId,
      targetUserId: userId,
      data: { notificationId: targetId, fingerprint: targetFp }
    });
  } catch {}
}

export function markAllNotificationsAsRead(userId?: string) {
  if (typeof window === 'undefined') return;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  setConvLastReadAt(userId, '__notifs_all__', nowMs);

  const allIds: string[] = [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        addReadNotificationIds(list);
        const updated = list.map((n: any) => {
          if (n?.id) allIds.push(String(n.id));
          return n ? { ...n, read: true, is_read: true, unread: false, read_at: n.read_at || nowIso } : n;
        });
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: updated } }));
      }
    }
  } catch {}

  try {
    const tRaw = localStorage.getItem('locatrust_tenant_notifications');
    if (tRaw) {
      const tList = JSON.parse(tRaw);
      if (Array.isArray(tList)) {
        addReadNotificationIds(tList);
        const updatedT = tList.map((n: any) => (n ? { ...n, read: true, is_read: true, unread: false } : n));
        localStorage.setItem('locatrust_tenant_notifications', JSON.stringify(updatedT));
      }
    }
  } catch {}

  safeUpdateSupabaseNotificationRead(userId);

  try {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark_notification_read',
        notificationIds: allIds,
        userId
      })
    }).catch(() => {});
  } catch {}

  try {
    broadcastLiveEvent('NOTIFICATION_READ' as any, {
      actorId: userId,
      targetUserId: userId,
      data: { all: true, notificationIds: allIds }
    });
  } catch {}
}

/**
 * Envoie une notification officielle en temps réel dans le centre de notifications (Header Bell)
 */
export function pushGlobalNotification(notif: {
  id?: string;
  title: string;
  description: string;
  category: 'demande' | 'visite' | 'paiement' | 'contrat' | 'caution' | 'maintenance' | 'abonnement' | 'candidature';
  targetTab?: string;
  targetUserId?: string;
  targetRole?: 'proprietaire' | 'locataire' | 'agence';
  senderUserId?: string;
  senderAvatar?: string;
  payload?: any;
}) {
  if (typeof window === 'undefined') return;
  // Règle absolue : L'expéditeur ne reçoit JAMAIS sa propre notification
  if (notif.senderUserId && notif.targetUserId && notif.senderUserId === notif.targetUserId) {
    return;
  }
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const currentNotifs: GlobalNotificationItem[] = raw ? JSON.parse(raw) : [];
    const notifId = notif.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const nowIso = new Date().toISOString();
    const newNotif: any = {
      id: notifId,
      title: notif.title,
      description: notif.description,
      timestamp: "À l'instant",
      time: "À l'instant",
      created_at: nowIso,
      category: notif.category === 'candidature' ? 'demande' : notif.category,
      read: false,
      is_read: false,
      unread: true,
      targetTab: notif.targetTab || (notif.category === 'demande' || notif.category === 'candidature' ? 'applications' : 'contracts'),
      targetUserId: notif.targetUserId,
      targetRole: notif.targetRole,
      senderUserId: notif.senderUserId,
      senderAvatar: notif.senderAvatar,
      payload: notif.payload
    };
    const fp = getNotificationFingerprint(newNotif);
    const filtered = (Array.isArray(currentNotifs) ? currentNotifs : []).filter(
      (n: any) => n && n.id !== notifId && getNotificationFingerprint(n) !== fp
    );
    const combined = [newNotif, ...filtered.slice(0, 49)];
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(combined));
    window.dispatchEvent(
      new CustomEvent('locatrust:notifications-updated', {
        detail: { notifications: combined }
      })
    );

    // Synchronisation multi-appareils via /api/sync
    try {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push_notification',
          notification: newNotif
        })
      }).catch(() => {});
    } catch {}

    // Inscription directe dans la table notifications Supabase avec le même UUID
    if (notif.targetUserId && isValidUuid(notif.targetUserId)) {
      const dbNotifId = isValidUuid(notifId) ? notifId : crypto.randomUUID();
      try {
        supabase
          .from('notifications')
          .insert({
            id: dbNotifId,
            user_id: notif.targetUserId,
            title: notif.title,
            message: notif.description,
            type: notif.category,
            is_read: false
          })
          .then(({ error }) => {
            if (error) {
              supabase
                .from('notifications')
                .insert({
                  id: dbNotifId,
                  user_id: notif.targetUserId,
                  title: notif.title,
                  content: notif.description,
                  type: notif.category,
                  read: false
                })
                .then();
            }
          });
      } catch {}
    }
  } catch (e) {
    console.warn('Error pushing notification:', e);
  }
}
