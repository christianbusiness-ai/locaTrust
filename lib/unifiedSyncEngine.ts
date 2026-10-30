'use client';

import { supabase } from '@/src/lib/supabase';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';
import { getContracts, getMaintenanceTickets } from '@/src/lib/db';
import {
  isMessageRead,
  isNotificationRead,
  deduplicateMessageList,
  mergeServerReadState,
  ensureCounterV2Migration,
  setActiveMessagingUser,
  getStoredMessages,
  saveStoredMessages
} from '@/lib/messagingStore';
import { deduplicateAndNormalizeNotifications } from '@/lib/waitingListNotifications';
import { isLoggingOutInProgress } from '@/src/lib/sessionSecurity';
import { syncQuotaInBackground } from '@/lib/quotaEngine';

export const isValidUuid = (str?: string): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

export const ensureUuid = (id?: string): string => {
  if (isValidUuid(id)) return id!;
  return crypto.randomUUID();
};

let isSyncing = false;
let lastSyncTimestamp = 0;

/**
 * MOTEUR CENTRALISÉ DE SYNCHRONISATION MULTI-APPAREILS (PC ↔ MOBILE ↔ TABLETTE)
 * Source unique de vérité : Serveur PostgreSQL Supabase.
 * Cache local : LocalStorage + Événements DOM CustomEvent pour réactivité instantanée.
 */
export async function syncUserData(userId: string, role?: string): Promise<{ success: boolean; error?: string }> {
  if (!userId || !isValidUuid(userId) || isLoggingOutInProgress()) {
    return { success: false, error: 'UUID utilisateur invalide ou déconnexion en cours.' };
  }

  // Éviter les requêtes concurrentes en boucle
  const now = Date.now();
  if (isSyncing && now - lastSyncTimestamp < 3000) {
    return { success: true };
  }

  isSyncing = true;
  lastSyncTimestamp = now;

  ensureCounterV2Migration(userId);

  try {
    // 0. SYNCHRONISATION SERVEUR CENTRAL (/api/sync) — MULTI-APPAREILS ISOLÉE PAR UTILISATEUR
    try {
      const syncRes = await fetch(`/api/sync?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role || '')}`);
      if (isLoggingOutInProgress()) {
        return { success: false };
      }
      if (syncRes.ok) {
        const syncJson = await syncRes.json();
        if (isLoggingOutInProgress()) {
          return { success: false };
        }
        if (syncJson?.success && syncJson?.data) {
          if (typeof window !== 'undefined') {
            if (syncJson.data.readState) {
              mergeServerReadState(userId, syncJson.data.readState);
            }

            const isMine = (x: any) =>
              x &&
              (x.owner_id === userId ||
                x.agency_id === userId ||
                x.tenant_id === userId ||
                x.user_id === userId ||
                x.targetUserId === userId ||
                x.senderUserId === userId);

            // Règle stricte pour les notifications : uniquement celles où l'utilisateur est DESTINATAIRE (jamais expéditeur)
            const isNotificationForMe = (n: any) =>
              n &&
              n.senderUserId !== userId &&
              (n.targetUserId === userId ||
                n.user_id === userId ||
                n.payload?.agencyId === userId ||
                n.payload?.ownerId === userId ||
                (!n.targetUserId && !n.user_id && n.targetRole === role));

            // A. Paiements
            if (Array.isArray(syncJson.data.payments)) {
              try {
                const srvPayments = syncJson.data.payments.filter(isMine);
                const rawP = localStorage.getItem('locatrust_rent_payments');
                const localP = rawP ? JSON.parse(rawP) : [];
                const validLocalP = localP.filter(isMine);
                const srvIds = new Set(srvPayments.map((p: any) => p.id || p.reference));
                const mergedP = [
                  ...srvPayments,
                  ...validLocalP.filter((lp: any) => !srvIds.has(lp.id) && !srvIds.has(lp.reference))
                ];
                localStorage.setItem('locatrust_rent_payments', JSON.stringify(mergedP));
                window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: { payments: mergedP } }));
              } catch {}
            }

            // B. Cautions
            if (Array.isArray(syncJson.data.cautions)) {
              try {
                const srvCautions = syncJson.data.cautions.filter(isMine);
                const rawC = localStorage.getItem('locatrust_deposits_v1') || localStorage.getItem('locatrust_caution_deposits');
                const localC = rawC ? JSON.parse(rawC) : [];
                const validLocalC = localC.filter(isMine);
                const srvCIds = new Set(srvCautions.map((c: any) => c.id || c.contract_number));
                const mergedC = [
                  ...srvCautions,
                  ...validLocalC.filter((lc: any) => !srvCIds.has(lc.id) && !srvCIds.has(lc.contract_number))
                ];
                localStorage.setItem('locatrust_deposits_v1', JSON.stringify(mergedC));
                localStorage.setItem('locatrust_caution_deposits', JSON.stringify(mergedC));
                window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: { cautions: mergedC } }));
              } catch {}
            }

            // C. Quittances
            if (Array.isArray(syncJson.data.receipts)) {
              try {
                const srvReceipts = syncJson.data.receipts.filter(isMine);
                const rawR = localStorage.getItem('locatrust_receipts');
                const localR = rawR ? JSON.parse(rawR) : [];
                const validLocalR = localR.filter(isMine);
                const srvRNums = new Set(srvReceipts.map((r: any) => r.receipt_number));
                const mergedR = [
                  ...srvReceipts,
                  ...validLocalR.filter((lr: any) => !srvRNums.has(lr.receipt_number || lr.receiptNumber))
                ];
                localStorage.setItem('locatrust_receipts', JSON.stringify(mergedR));
                window.dispatchEvent(new CustomEvent('locatrust:receipts-updated', { detail: { receipts: mergedR } }));
              } catch {}
            }

            // D. Notifications (filtrées strictement pour le destinataire et préservant le statut lu)
            if (Array.isArray(syncJson.data.notifications)) {
              try {
                const srvNotifications = syncJson.data.notifications.filter(isNotificationForMe);
                const rawN = localStorage.getItem('locatrust_notifications');
                const localN = rawN ? JSON.parse(rawN) : [];
                const validLocalN = (Array.isArray(localN) ? localN : []).filter(isNotificationForMe);
                const mergedN = deduplicateAndNormalizeNotifications(
                  [...srvNotifications, ...validLocalN],
                  userId
                );
                localStorage.setItem('locatrust_notifications', JSON.stringify(mergedN));
                window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: mergedN } }));
              } catch {}
            }

            // D-bis. Messages issus de /api/sync (préservant le statut lu)
            if (Array.isArray(syncJson.data.messages) && syncJson.data.messages.length > 0) {
              try {
                const rawLocalM = localStorage.getItem('locatrust_chat_messages_v4');
                const localMsgs = rawLocalM ? JSON.parse(rawLocalM) : [];
                const srvMsgs = syncJson.data.messages
                  .filter((m: any) => m && (m.sender_id === userId || m.receiver_id === userId))
                  .map((m: any) => {
                    const alreadyRead = isMessageRead(m, userId, localMsgs);
                    return {
                      ...m,
                      status: alreadyRead ? 'read' : (m.status || 'delivered'),
                      is_read: alreadyRead,
                      read: alreadyRead
                    };
                  });
                const mergedMsgs = deduplicateMessageList([...srvMsgs, ...(Array.isArray(localMsgs) ? localMsgs : [])]);
                localStorage.setItem('locatrust_chat_messages_v4', JSON.stringify(mergedMsgs));
                window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: { messages: mergedMsgs } }));
                window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: { messages: mergedMsgs } }));
              } catch {}
            }

            // E. Maintenance & Incidents
            if (Array.isArray(syncJson.data.maintenance)) {
              try {
                const srvMaintenance = syncJson.data.maintenance.filter(isMine);
                const rawM = localStorage.getItem('locatrust_maintenance_tickets');
                const localM = rawM ? JSON.parse(rawM) : [];
                const validLocalM = localM.filter(isMine);
                const srvMIds = new Set(srvMaintenance.map((m: any) => m.id || m.ticketNumber));
                const mergedM = [
                  ...srvMaintenance,
                  ...validLocalM.filter((lm: any) => !srvMIds.has(lm.id) && !srvMIds.has(lm.ticketNumber))
                ];
                localStorage.setItem('locatrust_maintenance_tickets', JSON.stringify(mergedM));
                window.dispatchEvent(new CustomEvent('locatrust:maintenance-updated', { detail: { tickets: mergedM } }));
              } catch {}
            }

            // F. Contrats
            if (Array.isArray(syncJson.data.contracts)) {
              try {
                const srvContracts = syncJson.data.contracts.filter(isMine);
                const rawCnt = localStorage.getItem('locatrust_contracts');
                const localCnt = rawCnt ? JSON.parse(rawCnt) : [];
                const validLocalCnt = localCnt.filter(isMine);
                const srvCntNums = new Set(srvContracts.map((c: any) => c.contract_number || c.contractNumber));
                const mergedCnt = [
                  ...srvContracts,
                  ...validLocalCnt.filter((lc: any) => !srvCntNums.has(lc.contract_number || lc.contractNumber))
                ];
                localStorage.setItem('locatrust_contracts', JSON.stringify(mergedCnt));
                window.dispatchEvent(new CustomEvent('locatrust:contracts-updated', { detail: { contracts: mergedCnt } }));
              } catch {}
            }

            // G. Candidatures de location (Applications)
            if (Array.isArray(syncJson.data.applications)) {
              try {
                const srvApps = syncJson.data.applications.filter(isMine);
                const rawA = localStorage.getItem('locatrust_rental_applications');
                const localA = rawA ? JSON.parse(rawA) : [];
                const validLocalA = localA.filter(isMine);
                const srvAIds = new Set(srvApps.map((a: any) => a.id));
                const mergedA = [
                  ...srvApps,
                  ...validLocalA.filter((la: any) => la?.id && !srvAIds.has(la.id))
                ];
                localStorage.setItem('locatrust_rental_applications', JSON.stringify(mergedA));
                window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { updatedApps: mergedA, applications: mergedA } }));
              } catch {}
            }
          }
        }
      }
    } catch (syncErr) {
      if (!isLoggingOutInProgress()) {
        console.warn('API /api/sync fetch error in unifiedSyncEngine:', syncErr);
      }
    }

    if (isLoggingOutInProgress()) {
      return { success: false };
    }

    // 1. SYNCHRONISATION DES LOGEMENTS (PROPERTIES) STRICTEMENT ISOLÉE PAR UTILISATEUR
    let pQuery = supabase
      .from('properties')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (role === 'locataire') {
      pQuery = pQuery.eq('status', 'disponible');
    } else {
      pQuery = pQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
    }

    const { data: serverProps, error: propErr } = await pQuery;

    if (!propErr && typeof window !== 'undefined') {
      try {
        const rawLocal = localStorage.getItem('locatrust_properties');
        const localProps = rawLocal ? JSON.parse(rawLocal) : [];
        const isMyProp = (p: any) => p && (p.owner_id === userId || p.agency_id === userId);
        const validLocalProps = localProps.filter((lp: any) => isMyProp(lp) && !isValidUuid(lp.id));
        const serverPropIds = new Set((serverProps || []).map(p => p.id));
        const mergedProps = [
          ...(serverProps || []),
          ...validLocalProps.filter((lp: any) => !serverPropIds.has(lp.id))
        ];
        localStorage.setItem('locatrust_properties', JSON.stringify(mergedProps));
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated', { detail: { properties: mergedProps } }));
      } catch {}
    }

    // 2. SYNCHRONISATION DES CONTRATS (CONTRACTS)
    try {
      const { data: serverContracts, error: cntErr } = await getContracts(userId, role as any);
      if (!cntErr && Array.isArray(serverContracts) && serverContracts.length > 0) {
        if (typeof window !== 'undefined') {
          const rawLocal = localStorage.getItem('locatrust_contracts');
          const localContracts = rawLocal ? JSON.parse(rawLocal) : [];
          const serverCntNumbers = new Set(serverContracts.map((c: any) => c.contract_number || c.contractNumber));
          const serverCntIds = new Set(serverContracts.map((c: any) => c.id));

          const mergedContracts = [
            ...serverContracts,
            ...localContracts.filter((lc: any) =>
              lc?.id &&
              !serverCntIds.has(lc.id) &&
              !serverCntNumbers.has(lc.contract_number || lc.contractNumber)
            )
          ];

          localStorage.setItem('locatrust_contracts', JSON.stringify(mergedContracts));
          window.dispatchEvent(new CustomEvent('locatrust:contracts-updated', { detail: { contracts: mergedContracts } }));
        }
      }
    } catch (cntErr) {
      console.warn('Erreur synchronisation contrats:', cntErr);
    }

    // 2bis. SYNCHRONISATION DE LA MAINTENANCE (MAINTENANCE TICKETS)
    try {
      const { data: serverTickets, error: tckErr } = await getMaintenanceTickets(userId);
      if (!tckErr && Array.isArray(serverTickets) && serverTickets.length > 0) {
        if (typeof window !== 'undefined') {
          const rawLocal = localStorage.getItem('locatrust_maintenance_tickets');
          const localTickets = rawLocal ? JSON.parse(rawLocal) : [];
          const serverTckIds = new Set(serverTickets.map((t: any) => t.id || t.ticketNumber));

          const mergedTickets = [
            ...serverTickets,
            ...localTickets.filter((lt: any) =>
              lt?.id &&
              !serverTckIds.has(lt.id) &&
              !serverTckIds.has(lt.ticketNumber)
            )
          ];

          localStorage.setItem('locatrust_maintenance_tickets', JSON.stringify(mergedTickets));
          window.dispatchEvent(new CustomEvent('locatrust:maintenance-updated', { detail: { tickets: mergedTickets } }));
        }
      }
    } catch (maintErr) {
      console.warn('Erreur synchronisation maintenance tickets:', maintErr);
    }

    // 3. SYNCHRONISATION DES CANDIDATURES LOCATIVES (RENTAL APPLICATIONS)
    let appQuery = supabase
      .from('rental_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (role === 'locataire') {
      appQuery = appQuery.eq('tenant_id', userId);
    } else {
      appQuery = appQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
    }

    const { data: serverApps, error: appErr } = await appQuery;

    if (!appErr && typeof window !== 'undefined') {
      try {
        const myPropIds = new Set((serverProps || []).map((p: any) => p.id));
        const rawLocal = localStorage.getItem('locatrust_rental_applications');
        const localApps = rawLocal ? JSON.parse(rawLocal) : [];
        const isMyApp = (a: any) =>
          a &&
          (a.owner_id === userId ||
            a.agency_id === userId ||
            a.tenant_id === userId ||
            (a.property_id && myPropIds.has(a.property_id)));
        const validLocalApps = localApps.filter(isMyApp);
        const serverAppIds = new Set((serverApps || []).map(a => a.id));

        const mergedApps = [
          ...(serverApps || []),
          ...validLocalApps.filter((la: any) => la?.id && !serverAppIds.has(la.id))
        ];

        localStorage.setItem('locatrust_rental_applications', JSON.stringify(mergedApps));
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { updatedApps: mergedApps, applications: mergedApps } }));
      } catch {}
    }

    // 4. SYNCHRONISATION DES CAUTIONS (CAUTIONS / DEPOSITS)
    let cauQuery = supabase
      .from('cautions')
      .select('*, contract:contract_id(*)')
      .order('created_at', { ascending: false });

    if (role === 'locataire') {
      cauQuery = cauQuery.eq('tenant_id', userId);
    } else {
      cauQuery = cauQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
    }

    const { data: serverCautions, error: cauErr } = await cauQuery;

    if (!cauErr && typeof window !== 'undefined') {
      try {
        const rawLocal = localStorage.getItem('locatrust_deposits_v1') || localStorage.getItem('locatrust_caution_deposits');
        const localDeps = rawLocal ? JSON.parse(rawLocal) : [];
        const isMyCaution = (c: any) =>
          c && (c.owner_id === userId || c.agency_id === userId || c.tenant_id === userId);
        const validLocalDeps = localDeps.filter(isMyCaution);
        const serverCauIds = new Set((serverCautions || []).map(c => c.id));

        const normalizedServerCautions = (serverCautions || []).map(c => ({
          ...c,
          contract_number: c.contract?.contract_number || c.contract_number,
          property: c.contract?.property || {
            title: 'Logement LocaTrust',
            address: 'Abidjan'
          },
          amount_requested: c.amount_requested,
          amount_paid: c.amount_paid,
          status: c.status || 'caution_a_confirmer',
          owner_signature: c.owner_signature,
          tenant_signature: c.tenant_signature,
          declared_reference: c.declared_reference,
          proof_url: c.proof_url
        }));

        const mergedCautions = [
          ...normalizedServerCautions,
          ...validLocalDeps.filter((ld: any) => ld?.id && !serverCauIds.has(ld.id))
        ];

        localStorage.setItem('locatrust_deposits_v1', JSON.stringify(mergedCautions));
        localStorage.setItem('locatrust_caution_deposits', JSON.stringify(mergedCautions));
        window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: { cautions: mergedCautions } }));
      } catch {}
    }

    // 5. SYNCHRONISATION DES PAIEMENTS DE LOYERS (RENT PAYMENTS)
    let pmQuery = supabase
      .from('rent_payments')
      .select('*, contract:contract_id(*)')
      .order('created_at', { ascending: false });

    if (role === 'locataire') {
      pmQuery = pmQuery.eq('tenant_id', userId);
    } else {
      pmQuery = pmQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
    }

    const { data: serverPayments, error: pmtErr } = await pmQuery;

    if (!pmtErr && typeof window !== 'undefined') {
      try {
        const rawLocal = localStorage.getItem('locatrust_rent_payments');
        const localPmts = rawLocal ? JSON.parse(rawLocal) : [];
        const isMyPayment = (p: any) =>
          p && (p.owner_id === userId || p.agency_id === userId || p.tenant_id === userId);
        const validLocalPmts = localPmts.filter(isMyPayment);
        const serverPmtIds = new Set((serverPayments || []).map(p => p.id));

        const mergedPayments = [
          ...(serverPayments || []),
          ...validLocalPmts.filter((lp: any) => lp?.id && !serverPmtIds.has(lp.id))
        ];

        localStorage.setItem('locatrust_rent_payments', JSON.stringify(mergedPayments));
        window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: { payments: mergedPayments } }));
      } catch {}
    }

    // 6. SYNCHRONISATION DES MESSAGES & CONVERSATIONS (ISOLATION STRICTE PAR UTILISATEUR)
    setActiveMessagingUser(userId);
    const convMapById = new Map<string, { id: string; participant_a: string; participant_b: string; property_id?: string }>();
    try {
      const { data: c1 } = await supabase
        .from('conversations')
        .select('id, participant_a, participant_b, property_id')
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
      if (Array.isArray(c1)) {
        c1.forEach((c: any) => {
          if (c?.id && (c.participant_a === userId || c.participant_b === userId) && c.participant_a !== c.participant_b) {
            convMapById.set(c.id, {
              id: c.id,
              participant_a: c.participant_a,
              participant_b: c.participant_b,
              property_id: c.property_id
            });
          }
        });
      }
    } catch {}

    try {
      const { data: c2 } = await supabase
        .from('conversations')
        .select('id, tenant_id, owner_id, property_id')
        .or(`tenant_id.eq.${userId},owner_id.eq.${userId}`);
      if (Array.isArray(c2)) {
        c2.forEach((c: any) => {
          if (c?.id && (c.tenant_id === userId || c.owner_id === userId) && c.tenant_id !== c.owner_id && !convMapById.has(c.id)) {
            convMapById.set(c.id, {
              id: c.id,
              participant_a: c.tenant_id,
              participant_b: c.owner_id,
              property_id: c.property_id
            });
          }
        });
      }
    } catch {}

    const userConvs = Array.from(convMapById.values());

    if (userConvs.length > 0) {
      const convIds = userConvs.map(c => c.id);
      const { data: serverMessages, error: msgErr } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      if (!msgErr && Array.isArray(serverMessages)) {
        if (typeof window !== 'undefined') {
          try {
            const localMsgs: any[] = getStoredMessages(userId);
            const localMap = new Map<string, any>();
            if (Array.isArray(localMsgs)) {
              localMsgs.forEach((lm: any) => {
                if (lm?.id) localMap.set(lm.id, lm);
              });
            }

            // Décoder le contenu structuré des messages et PRÉSERVER impérativement le statut lu
            const normalizedMsgs = serverMessages
              .map(m => {
                const conv = userConvs.find(c => c.id === m.conversation_id);
                if (!conv) return null;
                const otherId = conv.participant_a === userId ? conv.participant_b : conv.participant_a;
                if (!otherId || otherId === userId || !isValidUuid(otherId)) return null;
                const receiverId = m.sender_id === userId ? otherId : userId;
                if (m.sender_id !== userId && m.sender_id !== otherId) return null;

                let parsedContent: any = null;
                if (typeof m.content === 'string' && (m.content.trim().startsWith('{') || m.content.trim().startsWith('['))) {
                  try {
                    parsedContent = JSON.parse(m.content.trim());
                    if (Array.isArray(parsedContent)) parsedContent = parsedContent[0];
                  } catch {}
                }

                const existingLocal = localMap.get(m.id);

                const candidateMsg: any = {
                  id: m.id,
                  sender_id: m.sender_id,
                  receiver_id: receiverId,
                  text: parsedContent?.text || m.content,
                  created_at: m.created_at,
                  status: m.status || 'delivered',
                  is_read: Boolean(m.is_read || m.read || m.status === 'read')
                };

                const alreadyRead =
                  (existingLocal && isMessageRead(existingLocal, userId, localMsgs)) ||
                  isMessageRead(candidateMsg, userId, localMsgs);

                return {
                  id: m.id,
                  sender_id: m.sender_id,
                  receiver_id: receiverId,
                  text: parsedContent?.text || m.content,
                  media_url: m.attachment_url,
                  created_at: m.created_at,
                  status: alreadyRead ? ('read' as const) : ((m.status as any) || 'delivered'),
                  is_read: alreadyRead,
                  read: alreadyRead,
                  read_at: existingLocal?.read_at || (alreadyRead ? m.created_at : null),
                  contract: parsedContent?.contract,
                  quittance: parsedContent?.quittance,
                  restitution: parsedContent?.restitution,
                  declaration: parsedContent?.declaration,
                  attachment: parsedContent?.attachment
                };
              })
              .filter(Boolean) as any[];

            const mergedMsgs = deduplicateMessageList([
              ...normalizedMsgs,
              ...(Array.isArray(localMsgs) ? localMsgs : [])
            ]);

            saveStoredMessages(mergedMsgs, userId);
            window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: { messages: mergedMsgs } }));
            window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: { messages: mergedMsgs } }));
          } catch {}
        }
      }
    } else if (typeof window !== 'undefined') {
      // Aucun fil de conversation sur Supabase pour ce compte : garantir que seuls ses éventuels messages locaux légitimes subsistent
      try {
        const localMsgs = getStoredMessages(userId);
        saveStoredMessages(localMsgs, userId);
        window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: { messages: localMsgs } }));
        window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: { messages: localMsgs } }));
      } catch {}
    }

    // 7. SYNCHRONISATION DES NOTIFICATIONS
    const { data: serverNotifs, error: notifErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!notifErr && Array.isArray(serverNotifs)) {
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('locatrust_notifications');
          const localNotifs = rawLocal ? JSON.parse(rawLocal) : [];

          const normalizedNotifs = serverNotifs.map(n => {
            const candidate = {
              id: n.id,
              title: n.title,
              description: n.content || n.message || n.title,
              created_at: n.created_at,
              read: Boolean(n.read || n.is_read),
              is_read: Boolean(n.read || n.is_read),
              targetUserId: n.user_id || userId
            };
            const isRead = isNotificationRead(candidate, userId);
            return {
              id: n.id,
              title: n.title,
              description: n.content || n.message || n.title,
              read: isRead,
              is_read: isRead,
              unread: !isRead,
              created_at: n.created_at,
              timestamp: n.created_at ? new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : "À l'instant",
              time: n.created_at ? new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : "À l'instant",
              type: n.type || 'info',
              category: n.type === 'caution' ? 'caution' : n.type === 'contrat' ? 'contrat' : n.type === 'paiement' ? 'paiement' : 'demande',
              targetTab: n.type === 'caution' ? 'guarantees' : n.type === 'contrat' ? 'contracts' : n.type === 'paiement' ? 'payments' : (String(n.title || '').toLowerCase().includes('message') ? 'messages' : 'applications'),
              targetUserId: n.user_id || userId,
              payload: n.payload
            };
          });

          const mergedNotifs = deduplicateAndNormalizeNotifications(
            [...normalizedNotifs, ...(Array.isArray(localNotifs) ? localNotifs : [])],
            userId
          );

          localStorage.setItem('locatrust_notifications', JSON.stringify(mergedNotifs));
          window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: mergedNotifs } }));
        } catch {}
      }
    }

    // 8. TENTATIVE DE MIGRATION VERS SUPABASE DES ENTITÉS LOCALES EN ATTENTE
    await pushPendingLocalDataToServer(userId);

    // 9. CALCUL ET SYNCHRONISATION AUTOMATIQUE DU QUOTA EN ARRIÈRE-PLAN
    if (role !== 'locataire') {
      syncQuotaInBackground(userId, role).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    console.warn('unifiedSyncEngine error:', err);
    return { success: false, error: err?.message };
  } finally {
    isSyncing = false;
  }
}

/**
 * Pousse vers Supabase les entités créées localement (contrats, cautions, paiements)
 * qui n'avaient pas encore été synchronisées sur le serveur.
 */
async function pushPendingLocalDataToServer(userId: string) {
  if (typeof window === 'undefined') return;

  try {
    // A. Contrats locaux non encore présents dans Supabase
    const rawContracts = localStorage.getItem('locatrust_contracts');
    if (rawContracts) {
      const contracts = JSON.parse(rawContracts);
      if (Array.isArray(contracts)) {
        for (const c of contracts) {
          // Si le contrat a un numéro officiel mais n'est pas encore sur Supabase
          if (c.contract_number && (c.owner_id === userId || c.tenant_id === userId)) {
            const { data: existing } = await supabase
              .from('contracts')
              .select('id')
              .eq('contract_number', c.contract_number)
              .maybeSingle();

            if (!existing) {
              const contractId = isValidUuid(c.id) ? c.id : crypto.randomUUID();
              const propId = isValidUuid(c.property_id) ? c.property_id : (c.property?.id && isValidUuid(c.property.id) ? c.property.id : null);
              const ownerId = isValidUuid(c.owner_id) ? c.owner_id : (c.owner?.id && isValidUuid(c.owner.id) ? c.owner.id : userId);
              const tenantId = isValidUuid(c.tenant_id) ? c.tenant_id : (c.tenant?.id && isValidUuid(c.tenant.id) ? c.tenant.id : null);

              if (propId && ownerId && tenantId) {
                await supabase.from('contracts').insert({
                  id: contractId,
                  contract_number: c.contract_number,
                  property_id: propId,
                  owner_id: ownerId,
                  tenant_id: tenantId,
                  monthly_rent: Number(c.rent || c.monthly_rent || 0),
                  caution_amount: Number(c.caution || c.caution_amount || 0),
                  charges_amount: Number(c.charges || c.charges_amount || 0),
                  duration_months: Number(c.duration_months || 12),
                  start_date: c.start_date || new Date().toISOString().split('T')[0],
                  status: c.status || 'actif',
                  owner_signed: Boolean(c.owner_signed || c.owner_signature),
                  tenant_signed: Boolean(c.tenant_signed || c.tenant_signature),
                  owner_signature: c.owner_signature || null,
                  tenant_signature: c.tenant_signature || null
                });
              }
            }
          }
        }
      }
    }

    // B. Cautions locales non encore présentes dans Supabase
    const rawCautions = localStorage.getItem('locatrust_deposits_v1') || localStorage.getItem('locatrust_caution_deposits');
    if (rawCautions) {
      const cautions = JSON.parse(rawCautions);
      if (Array.isArray(cautions)) {
        for (const dep of cautions) {
          const isMyCaution = dep && (dep.owner_id === userId || dep.agency_id === userId || dep.tenant_id === userId);
          if (!isMyCaution) continue;

          // Si le dépôt a un id déjà en UUID, vérifier s'il existe dans Supabase
          if (isValidUuid(dep.id)) {
            const { data: existing } = await supabase.from('cautions').select('id').eq('id', dep.id).maybeSingle();
            if (existing) {
              if (dep.tenant_signature || dep.owner_signature) {
                await supabase.from('cautions').update({
                  status: dep.status || 'paye_complet',
                  tenant_signature: dep.tenant_signature || null,
                  owner_signature: dep.owner_signature || null,
                  tenant_signed_at: dep.tenant_signed_at || null,
                  confirmed_at: dep.confirmed_at || null
                }).eq('id', dep.id);
              }
            }
          }
        }
      }
    }

    // C. Règlements de loyers locaux non encore inscrits dans Supabase
    const rawPayments = localStorage.getItem('locatrust_rent_payments');
    if (rawPayments) {
      try {
        const localPmts = JSON.parse(rawPayments);
        if (Array.isArray(localPmts)) {
          const { createRentPayment } = await import('@/src/lib/db');
          let modified = false;
          for (const p of localPmts) {
            const isMyPmt = p && (p.owner_id === userId || p.agency_id === userId || p.tenant_id === userId);
            if (!isMyPmt) continue;

            if (p.reference) {
              const { data: existing } = await supabase
                .from('rent_payments')
                .select('id')
                .eq('reference', p.reference)
                .maybeSingle();

              if (!existing) {
                const res = await createRentPayment(p);
                if (res?.data?.id) {
                  p.id = res.data.id;
                  modified = true;
                }
              }
            }
          }
          if (modified) {
            localStorage.setItem('locatrust_rent_payments', JSON.stringify(localPmts));
          }
        }
      } catch (pmtErr) {
        console.warn('pushPendingLocalDataToServer payments notice:', pmtErr);
      }
    }

    // D. Quittances locales non encore inscrites dans Supabase
    const rawReceipts = localStorage.getItem('locatrust_receipts') || localStorage.getItem('locatrust_tenant_receipts_v2');
    if (rawReceipts) {
      try {
        const localRcps = JSON.parse(rawReceipts);
        if (Array.isArray(localRcps)) {
          for (const r of localRcps) {
            const isMyRcp = r && (r.owner_id === userId || r.agency_id === userId || r.tenant_id === userId);
            if (!isMyRcp) continue;

            const rNum = r.receipt_number || r.receiptNumber;
            if (rNum) {
              const { data: existing } = await supabase
                .from('receipts')
                .select('id')
                .eq('receipt_number', rNum)
                .maybeSingle();

              if (!existing) {
                await supabase.from('receipts').insert({
                  receipt_number: rNum,
                  type: r.type || 'loyer',
                  amount: Number(r.amount || r.amount_paid || 0),
                  token: r.token || `tok_rec_${Date.now()}`
                });
              }
            }
          }
        }
      } catch (rcpErr) {
        console.warn('pushPendingLocalDataToServer receipts notice:', rcpErr);
      }
    }

    // E. Tickets de maintenance locaux non encore inscrits dans Supabase
    const rawTickets = localStorage.getItem('locatrust_maintenance_tickets');
    if (rawTickets) {
      try {
        const localTickets = JSON.parse(rawTickets);
        if (Array.isArray(localTickets)) {
          const { createMaintenanceTicket } = await import('@/src/lib/db');
          for (const t of localTickets) {
            if (t.id && isValidUuid(t.id)) {
              const { data: existing } = await supabase
                .from('maintenance_tickets')
                .select('id')
                .eq('id', t.id)
                .maybeSingle();

              if (!existing) {
                await createMaintenanceTicket(t);
              }
            }
          }
        }
      } catch (tckErr) {
        console.warn('pushPendingLocalDataToServer maintenance notice:', tckErr);
      }
    }
  } catch (err) {
    console.warn('pushPendingLocalDataToServer notice:', err);
  }
}
