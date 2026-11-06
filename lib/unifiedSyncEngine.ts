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
  saveStoredMessages,
  findOrCreateSupabaseConversation,
  insertMessageRowResilient
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

    if (!propErr && typeof window !== 'undefined' && Array.isArray(serverProps)) {
      try {
        localStorage.setItem('locatrust_properties', JSON.stringify(serverProps));
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated', { detail: { properties: serverProps } }));
      } catch {}
    }

    // 2. SYNCHRONISATION DES CONTRATS (CONTRACTS)
    try {
      const { data: serverContracts, error: cntErr } = await getContracts(userId, role as any);
      if (!cntErr && typeof window !== 'undefined' && Array.isArray(serverContracts)) {
        localStorage.setItem('locatrust_contracts', JSON.stringify(serverContracts));
        window.dispatchEvent(new CustomEvent('locatrust:contracts-updated', { detail: { contracts: serverContracts } }));
      }
    } catch (cntErr) {
      console.warn('Erreur synchronisation contrats:', cntErr);
    }

    // 2bis. SYNCHRONISATION DE LA MAINTENANCE (MAINTENANCE TICKETS)
    try {
      const { data: serverTickets, error: tckErr } = await getMaintenanceTickets(userId);
      if (!tckErr && typeof window !== 'undefined' && Array.isArray(serverTickets)) {
        localStorage.setItem('locatrust_maintenance_tickets', JSON.stringify(serverTickets));
        window.dispatchEvent(new CustomEvent('locatrust:maintenance-updated', { detail: { tickets: serverTickets } }));
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
      const ownedPropIds = Array.isArray(serverProps)
        ? serverProps.map((p: any) => p?.id).filter((id: any) => isValidUuid(id))
        : [];
      if (ownedPropIds.length > 0) {
        appQuery = appQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId},property_id.in.(${ownedPropIds.join(',')})`);
      } else {
        appQuery = appQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
      }
    }

    const { data: serverAppsRaw, error: appErr } = await appQuery;

    if (!appErr && typeof window !== 'undefined' && Array.isArray(serverAppsRaw)) {
      const serverApps = serverAppsRaw.filter(
        (a: any) =>
          a &&
          a.id !== '11111111-2222-4333-8444-555555555555' &&
          a.id !== 'bab5a822-a484-49f3-929b-72ad62e0e97b' &&
          !String(a.id || '').startsWith('app_demo_')
      );
      try {
        // Pousser toute candidature locale récente non encore enregistrée sur Supabase avant d'écraser
        const rawLocalApps = localStorage.getItem('locatrust_rental_applications');
        if (rawLocalApps) {
          const parsedLocal = JSON.parse(rawLocalApps);
          if (Array.isArray(parsedLocal)) {
            const { createRentalApplication } = await import('@/lib/supabase/services');
            for (const la of parsedLocal) {
              if (
                la &&
                la.tenant_id === userId &&
                isValidUuid(la.property_id) &&
                !serverApps.some((sa: any) => sa.id === la.id || (sa.property_id === la.property_id && sa.tenant_id === la.tenant_id))
              ) {
                const res = await createRentalApplication(la);
                if (res?.data) {
                  serverApps.unshift(res.data);
                } else {
                  serverApps.unshift(la);
                }
              }
            }
          }
        }
        localStorage.setItem('locatrust_rental_applications', JSON.stringify(serverApps));
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { updatedApps: serverApps, applications: serverApps } }));
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

    if (!cauErr && typeof window !== 'undefined' && Array.isArray(serverCautions)) {
      try {
        const normalizedServerCautions = serverCautions.map(c => ({
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

        localStorage.setItem('locatrust_deposits_v1', JSON.stringify(normalizedServerCautions));
        localStorage.setItem('locatrust_caution_deposits', JSON.stringify(normalizedServerCautions));
        window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: { cautions: normalizedServerCautions } }));
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

    if (!pmtErr && typeof window !== 'undefined' && Array.isArray(serverPayments)) {
      try {
        localStorage.setItem('locatrust_rent_payments', JSON.stringify(serverPayments));
        window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: { payments: serverPayments } }));
      } catch {}
    }

    // 5bis. SYNCHRONISATION DES QUITTANCES (RECEIPTS)
    try {
      let rcQuery = supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (role === 'locataire') {
        rcQuery = rcQuery.eq('tenant_id', userId);
      } else {
        rcQuery = rcQuery.or(`owner_id.eq.${userId},agency_id.eq.${userId}`);
      }

      const { data: serverReceipts, error: rcErr } = await rcQuery;
      if (!rcErr && typeof window !== 'undefined' && Array.isArray(serverReceipts)) {
        localStorage.setItem('locatrust_receipts', JSON.stringify(serverReceipts));
        localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify(serverReceipts));
        window.dispatchEvent(new CustomEvent('locatrust:receipts-updated', { detail: { receipts: serverReceipts } }));
      }
    } catch {}

    // 5ter. SYNCHRONISATION DES MANDATS D'AGENCE (AGENCY MANDATES)
    try {
      const { data: serverMandates, error: mndErr } = await supabase
        .from('agency_mandates')
        .select('*')
        .or(`agency_id.eq.${userId},owner_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (!mndErr && typeof window !== 'undefined' && Array.isArray(serverMandates)) {
        localStorage.setItem('locatrust_agency_mandates', JSON.stringify(serverMandates));
        window.dispatchEvent(new CustomEvent('locatrust:mandates-updated', { detail: { mandates: serverMandates } }));
      }
    } catch {}

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
    const localMsgs: any[] = typeof window !== 'undefined' ? getStoredMessages(userId) : [];

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
            const localMap = new Map<string, any>();
            if (Array.isArray(localMsgs)) {
              localMsgs.forEach((lm: any) => {
                if (lm?.id) localMap.set(lm.id, lm);
              });
            }

            // Réconcilier les messages locaux avec leurs équivalents serveur (sans jamais supprimer les messages locaux récents)
            const reconciledLocal = (Array.isArray(localMsgs) ? localMsgs : []).map((local: any) => {
              const matchingDbMsg = serverMessages.find(
                (m: any) =>
                  m.id === local.id ||
                  (m.sender_id === local.sender_id &&
                    (m.content === local.text || (typeof m.content === 'string' && m.content.includes(local.text))) &&
                    Math.abs(new Date(local.created_at).getTime() - new Date(m.created_at).getTime()) < 120000)
              );
              if (matchingDbMsg && matchingDbMsg.id !== local.id) {
                return { ...local, id: matchingDbMsg.id };
              }
              return local;
            });

            // Décoder le contenu structuré des messages serveur
            const rawServerCandidates = serverMessages
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

                const dbReadFlag = Boolean(m.read === true || m.is_read === true || m.status === 'read');
                return {
                  id: m.id,
                  sender_id: m.sender_id,
                  receiver_id: receiverId,
                  text: parsedContent?.text || m.content,
                  media_url: m.attachment_url,
                  created_at: m.created_at,
                  status: dbReadFlag ? ('read' as const) : ((m.status as any) || 'delivered'),
                  is_read: dbReadFlag,
                  read: dbReadFlag,
                  contract: parsedContent?.contract,
                  quittance: parsedContent?.quittance,
                  restitution: parsedContent?.restitution,
                  declaration: parsedContent?.declaration,
                  attachment: parsedContent?.attachment
                };
              })
              .filter(Boolean) as any[];

            const allContextMsgs = [...reconciledLocal, ...rawServerCandidates];

            const normalizedMsgs = rawServerCandidates.map(candidateMsg => {
              const existingLocal = localMap.get(candidateMsg.id);
              const alreadyRead =
                candidateMsg.read === true ||
                candidateMsg.is_read === true ||
                (existingLocal && isMessageRead(existingLocal, userId, allContextMsgs)) ||
                isMessageRead(candidateMsg, userId, allContextMsgs);

              return {
                ...candidateMsg,
                status: alreadyRead ? ('read' as const) : (candidateMsg.status || 'delivered'),
                is_read: alreadyRead,
                read: alreadyRead,
                read_at: existingLocal?.read_at || (alreadyRead ? candidateMsg.created_at : null)
              };
            });

            // Fusionner impérativement les messages locaux et serveur (sans jamais écraser ni perdre un message récent)
            const cleanMsgs = deduplicateMessageList([...reconciledLocal, ...normalizedMsgs]);

            saveStoredMessages(cleanMsgs, userId, { silent: true });
            window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: { fromLocalSave: true, messages: cleanMsgs } }));
            window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: { fromLocalSave: true, messages: cleanMsgs } }));
          } catch {}
        }
      }
    } else if (typeof window !== 'undefined' && Array.isArray(localMsgs) && localMsgs.length > 0) {
      try {
        const cleanLocal = deduplicateMessageList(localMsgs);
        saveStoredMessages(cleanLocal, userId, { silent: true });
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
          let existingLocalNotifs: any[] = [];
          try {
            const rawLocalNotifs = localStorage.getItem('locatrust_notifications');
            if (rawLocalNotifs) {
              const parsed = JSON.parse(rawLocalNotifs);
              if (Array.isArray(parsed)) {
                existingLocalNotifs = parsed.filter((ln: any) => ln && (!ln.targetUserId || ln.targetUserId === userId));
              }
            }
          } catch {}

          const normalizedNotifs = serverNotifs.map(n => {
            const resolvedPayload = n.payload || n.data || {};
            const resolvedSenderId = resolvedPayload?.contactId || resolvedPayload?.sender_id || n.sender_id;
            const resolvedTargetTab =
              n.type === 'caution'
                ? 'guarantees'
                : n.type === 'contrat'
                ? 'contracts'
                : n.type === 'paiement'
                ? 'payments'
                : String(n.title || '').toLowerCase().includes('message')
                ? 'messages'
                : 'applications';

            const candidate = {
              id: n.id,
              title: n.title,
              description: n.content || n.message || n.title,
              created_at: n.created_at,
              read: Boolean(n.read || n.is_read),
              is_read: Boolean(n.read || n.is_read),
              targetUserId: n.user_id || userId,
              senderUserId: resolvedSenderId,
              targetTab: resolvedTargetTab,
              payload: resolvedPayload,
              data: resolvedPayload
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
              targetTab: resolvedTargetTab,
              targetUserId: n.user_id || userId,
              senderUserId: resolvedSenderId,
              payload: resolvedPayload
            };
          });

          const cleanNotifs = deduplicateAndNormalizeNotifications([...normalizedNotifs, ...existingLocalNotifs], userId);

          localStorage.setItem('locatrust_notifications', JSON.stringify(cleanNotifs));
          window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: cleanNotifs } }));
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

    // F. Messages locaux envoyés par l'utilisateur non encore inscrits dans Supabase (rattrapage silencieux sans re-diffusion)
    if (isValidUuid(userId)) {
      try {
        const localMsgs = getStoredMessages(userId);
        const myUnsyncedCandidates = (Array.isArray(localMsgs) ? localMsgs : []).filter(
          (m) => m && m.sender_id === userId && isValidUuid(m.receiver_id) && m.receiver_id !== userId && m.text
        );
        if (myUnsyncedCandidates.length > 0) {
          let userRole = 'locataire';
          try {
            const uRaw = localStorage.getItem('locatrust_user');
            if (uRaw) {
              const pu = JSON.parse(uRaw);
              userRole = pu?.account_type || pu?.role || 'locataire';
            }
          } catch {}

          for (const m of myUnsyncedCandidates.slice(-20)) {
            if (isValidUuid(m.id)) {
              const { data: existingMsg } = await supabase
                .from('messages')
                .select('id')
                .eq('id', m.id)
                .limit(1);
              if (Array.isArray(existingMsg) && existingMsg.length > 0) {
                continue;
              }
            }
            const convId = await findOrCreateSupabaseConversation(m.sender_id, m.receiver_id, userRole);
            if (!convId) continue;

            // Vérifier qu'un message identique n'est pas déjà dans cette conversation
            const { data: sameContentRows } = await supabase
              .from('messages')
              .select('id, created_at')
              .eq('conversation_id', convId)
              .eq('sender_id', m.sender_id)
              .eq('content', m.text)
              .limit(1);
            if (Array.isArray(sameContentRows) && sameContentRows.length > 0) {
              continue;
            }

            await insertMessageRowResilient({
              id: isValidUuid(m.id) ? m.id : undefined,
              conversationId: convId,
              senderId: m.sender_id,
              receiverId: m.receiver_id,
              content: m.text,
              createdAt: m.created_at,
              read: Boolean(m.read || m.is_read)
            });
          }
        }
      } catch (msgErr) {
        console.warn('pushPendingLocalDataToServer messages notice:', msgErr);
      }
    }
  } catch (err) {
    console.warn('pushPendingLocalDataToServer notice:', err);
  }
}
