'use client';

import { supabase } from '@/src/lib/supabase';
import { broadcastLiveEvent } from '@/lib/supabaseRealtime';

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
  if (!userId || !isValidUuid(userId)) {
    return { success: false, error: 'UUID utilisateur invalide.' };
  }

  // Éviter les requêtes concurrentes en boucle
  const now = Date.now();
  if (isSyncing && now - lastSyncTimestamp < 3000) {
    return { success: true };
  }

  isSyncing = true;
  lastSyncTimestamp = now;

  try {
    // 0. SYNCHRONISATION SERVEUR CENTRAL (/api/sync) — MULTI-APPAREILS
    try {
      const syncRes = await fetch('/api/sync');
      if (syncRes.ok) {
        const syncJson = await syncRes.json();
        if (syncJson?.success && syncJson?.data) {
          if (typeof window !== 'undefined') {
            // A. Paiements
            if (Array.isArray(syncJson.data.payments)) {
              try {
                const rawP = localStorage.getItem('locatrust_rent_payments');
                const localP = rawP ? JSON.parse(rawP) : [];
                const srvIds = new Set(syncJson.data.payments.map((p: any) => p.id || p.reference));
                const mergedP = [
                  ...syncJson.data.payments,
                  ...localP.filter((lp: any) => !srvIds.has(lp.id) && !srvIds.has(lp.reference))
                ];
                localStorage.setItem('locatrust_rent_payments', JSON.stringify(mergedP));
                window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: { payments: mergedP } }));
              } catch {}
            }

            // B. Cautions
            if (Array.isArray(syncJson.data.cautions)) {
              try {
                const rawC = localStorage.getItem('locatrust_deposits_v1') || localStorage.getItem('locatrust_caution_deposits');
                const localC = rawC ? JSON.parse(rawC) : [];
                const srvCIds = new Set(syncJson.data.cautions.map((c: any) => c.id || c.contract_number));
                const mergedC = [
                  ...syncJson.data.cautions,
                  ...localC.filter((lc: any) => !srvCIds.has(lc.id) && !srvCIds.has(lc.contract_number))
                ];
                localStorage.setItem('locatrust_deposits_v1', JSON.stringify(mergedC));
                localStorage.setItem('locatrust_caution_deposits', JSON.stringify(mergedC));
                window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: { cautions: mergedC } }));
              } catch {}
            }

            // C. Quittances
            if (Array.isArray(syncJson.data.receipts)) {
              try {
                const rawR = localStorage.getItem('locatrust_receipts');
                const localR = rawR ? JSON.parse(rawR) : [];
                const srvRNums = new Set(syncJson.data.receipts.map((r: any) => r.receipt_number));
                const mergedR = [
                  ...syncJson.data.receipts,
                  ...localR.filter((lr: any) => !srvRNums.has(lr.receipt_number || lr.receiptNumber))
                ];
                localStorage.setItem('locatrust_receipts', JSON.stringify(mergedR));
                window.dispatchEvent(new CustomEvent('locatrust:receipts-updated', { detail: { receipts: mergedR } }));
              } catch {}
            }

            // D. Notifications
            if (Array.isArray(syncJson.data.notifications)) {
              try {
                const rawN = localStorage.getItem('locatrust_notifications');
                const localN = rawN ? JSON.parse(rawN) : [];
                const srvNIds = new Set(syncJson.data.notifications.map((n: any) => n.id));
                const mergedN = [
                  ...syncJson.data.notifications,
                  ...localN.filter((ln: any) => !srvNIds.has(ln.id))
                ];
                localStorage.setItem('locatrust_notifications', JSON.stringify(mergedN));
                window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: mergedN } }));
              } catch {}
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn('API /api/sync fetch error in unifiedSyncEngine:', syncErr);
    }

    // 1. SYNCHRONISATION DES LOGEMENTS (PROPERTIES)
    const { data: serverProps, error: propErr } = await supabase
      .from('properties')
      .select('*')
      .or(`owner_id.eq.${userId},agency_id.eq.${userId},status.eq.disponible`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!propErr && Array.isArray(serverProps) && serverProps.length > 0) {
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('locatrust_properties');
          const localProps = rawLocal ? JSON.parse(rawLocal) : [];
          const serverPropIds = new Set(serverProps.map(p => p.id));
          // Conserver les props locaux qui ne sont pas encore sur le serveur
          const mergedProps = [
            ...serverProps,
            ...localProps.filter((lp: any) => lp?.id && !serverPropIds.has(lp.id) && !isValidUuid(lp.id))
          ];
          localStorage.setItem('locatrust_properties', JSON.stringify(mergedProps));
          window.dispatchEvent(new CustomEvent('locatrust:properties-updated', { detail: { properties: mergedProps } }));
        } catch {}
      }
    }

    // 2. SYNCHRONISATION DES CONTRATS (CONTRACTS)
    const { data: serverContracts, error: cntErr } = await supabase
      .from('contracts')
      .select('*, property:property_id(*), owner:owner_id(*), tenant:tenant_id(*)')
      .or(`owner_id.eq.${userId},tenant_id.eq.${userId},agency_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!cntErr && Array.isArray(serverContracts)) {
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('locatrust_contracts');
          const localContracts = rawLocal ? JSON.parse(rawLocal) : [];
          const serverCntNumbers = new Set(serverContracts.map(c => c.contract_number));
          const serverCntIds = new Set(serverContracts.map(c => c.id));

          // Harmoniser la structure pour qu'elle corresponde aux attentes des composants React
          const normalizedServerContracts = serverContracts.map(c => ({
            ...c,
            contractNumber: c.contract_number,
            rent: c.monthly_rent,
            rent_amount: c.monthly_rent,
            caution: c.caution_amount,
            caution_amount: c.caution_amount,
            charges: c.charges_amount,
            status: c.status || 'actif',
            owner_signed: Boolean(c.owner_signed || c.owner_signature),
            tenant_signed: Boolean(c.tenant_signed || c.tenant_signature),
            property: c.property || {
              id: c.property_id,
              title: 'Logement LocaTrust',
              city: 'Abidjan',
              commune: 'Cocody'
            },
            owner: c.owner || {
              id: c.owner_id,
              full_name: 'Bailleur'
            },
            tenant: c.tenant || {
              id: c.tenant_id,
              full_name: 'Locataire'
            }
          }));

          const mergedContracts = [
            ...normalizedServerContracts,
            ...localContracts.filter((lc: any) =>
              lc?.id &&
              !serverCntIds.has(lc.id) &&
              !serverCntNumbers.has(lc.contract_number || lc.contractNumber)
            )
          ];

          localStorage.setItem('locatrust_contracts', JSON.stringify(mergedContracts));
          window.dispatchEvent(new CustomEvent('locatrust:contracts-updated', { detail: { contracts: mergedContracts } }));
        } catch {}
      }
    }

    // 3. SYNCHRONISATION DES CANDIDATURES LOCATIVES (RENTAL APPLICATIONS)
    const { data: serverApps, error: appErr } = await supabase
      .from('rental_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (!appErr && Array.isArray(serverApps)) {
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('locatrust_rental_applications');
          const localApps = rawLocal ? JSON.parse(rawLocal) : [];
          const serverAppIds = new Set(serverApps.map(a => a.id));

          const mergedApps = [
            ...serverApps,
            ...localApps.filter((la: any) => la?.id && !serverAppIds.has(la.id))
          ];

          localStorage.setItem('locatrust_rental_applications', JSON.stringify(mergedApps));
          window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: { applications: mergedApps } }));
        } catch {}
      }
    }

    // 4. SYNCHRONISATION DES CAUTIONS (CAUTIONS / DEPOSITS)
    const { data: serverCautions, error: cauErr } = await supabase
      .from('cautions')
      .select('*, contract:contract_id(*)')
      .order('created_at', { ascending: false });

    if (!cauErr && Array.isArray(serverCautions)) {
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('locatrust_deposits_v1') || localStorage.getItem('locatrust_caution_deposits');
          const localDeps = rawLocal ? JSON.parse(rawLocal) : [];
          const serverCauIds = new Set(serverCautions.map(c => c.id));

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

          const mergedCautions = [
            ...normalizedServerCautions,
            ...localDeps.filter((ld: any) => ld?.id && !serverCauIds.has(ld.id))
          ];

          localStorage.setItem('locatrust_deposits_v1', JSON.stringify(mergedCautions));
          localStorage.setItem('locatrust_caution_deposits', JSON.stringify(mergedCautions));
          window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: { cautions: mergedCautions } }));
        } catch {}
      }
    }

    // 5. SYNCHRONISATION DES PAIEMENTS DE LOYERS (RENT PAYMENTS)
    const { data: serverPayments, error: pmtErr } = await supabase
      .from('rent_payments')
      .select('*, contract:contract_id(*)')
      .order('created_at', { ascending: false });

    if (!pmtErr && Array.isArray(serverPayments)) {
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('locatrust_rent_payments');
          const localPmts = rawLocal ? JSON.parse(rawLocal) : [];
          const serverPmtIds = new Set(serverPayments.map(p => p.id));

          const mergedPayments = [
            ...serverPayments,
            ...localPmts.filter((lp: any) => lp?.id && !serverPmtIds.has(lp.id))
          ];

          localStorage.setItem('locatrust_rent_payments', JSON.stringify(mergedPayments));
          window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: { payments: mergedPayments } }));
        } catch {}
      }
    }

    // 6. SYNCHRONISATION DES MESSAGES & CONVERSATIONS (MESSAGES)
    const { data: userConvs, error: convErr } = await supabase
      .from('conversations')
      .select('id, participant_a, participant_b, property_id')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);

    if (!convErr && Array.isArray(userConvs) && userConvs.length > 0) {
      const convIds = userConvs.map(c => c.id);
      const { data: serverMessages, error: msgErr } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      if (!msgErr && Array.isArray(serverMessages)) {
        if (typeof window !== 'undefined') {
          try {
            const rawLocal = localStorage.getItem('locatrust_chat_messages_v4');
            const localMsgs = rawLocal ? JSON.parse(rawLocal) : [];
            const serverMsgIds = new Set(serverMessages.map(m => m.id));

            // Décoder le contenu structuré des messages si présent
            const normalizedMsgs = serverMessages.map(m => {
              let parsedContent: any = null;
              if (typeof m.content === 'string' && (m.content.trim().startsWith('{') || m.content.trim().startsWith('['))) {
                try {
                  parsedContent = JSON.parse(m.content.trim());
                } catch {}
              }

              const conv = userConvs.find(c => c.id === m.conversation_id);
              const receiverId = conv ? (conv.participant_a === m.sender_id ? conv.participant_b : conv.participant_a) : '';

              return {
                id: m.id,
                sender_id: m.sender_id,
                receiver_id: receiverId,
                text: parsedContent?.text || m.content,
                media_url: m.attachment_url,
                created_at: m.created_at,
                contract: parsedContent?.contract,
                quittance: parsedContent?.quittance,
                restitution: parsedContent?.restitution,
                declaration: parsedContent?.declaration,
                attachment: parsedContent?.attachment
              };
            });

            const mergedMsgs = [
              ...normalizedMsgs,
              ...localMsgs.filter((lm: any) => lm?.id && !serverMsgIds.has(lm.id))
            ];

            localStorage.setItem('locatrust_chat_messages_v4', JSON.stringify(mergedMsgs));
            window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: { messages: mergedMsgs } }));
          } catch {}
        }
      }
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
          const serverNotifIds = new Set(serverNotifs.map(n => n.id));

          const normalizedNotifs = serverNotifs.map(n => ({
            id: n.id,
            title: n.title,
            description: n.content || n.title,
            unread: !n.read,
            time: n.created_at ? new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : "À l'instant",
            type: n.type || 'info',
            payload: n.payload
          }));

          const mergedNotifs = [
            ...normalizedNotifs,
            ...localNotifs.filter((ln: any) => ln?.id && !serverNotifIds.has(ln.id))
          ];

          localStorage.setItem('locatrust_notifications', JSON.stringify(mergedNotifs));
          window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: mergedNotifs } }));
        } catch {}
      }
    }

    // 8. TENTATIVE DE MIGRATION VERS SUPABASE DES ENTITÉS LOCALES EN ATTENTE
    await pushPendingLocalDataToServer(userId);

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
          const tenantId = isValidUuid(dep.tenant_id) ? dep.tenant_id : (dep.tenant?.id && isValidUuid(dep.tenant.id) ? dep.tenant.id : (userId.includes('tenant') ? userId : null));
          const ownerId = isValidUuid(dep.owner_id) ? dep.owner_id : (userId.includes('tenant') ? null : userId);

          // Si le dépôt a un id déjà en UUID, vérifier s'il existe dans Supabase
          if (isValidUuid(dep.id)) {
            const { data: existing } = await supabase.from('cautions').select('id').eq('id', dep.id).maybeSingle();
            if (existing) {
              // Mettre à jour si des signatures locales existent
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
  } catch (err) {
    console.warn('pushPendingLocalDataToServer notice:', err);
  }
}
