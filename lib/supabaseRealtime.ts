import { supabase } from '@/src/lib/supabase';

export type LiveEventType =
  | 'PAYMENT_DECLARED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_REJECTED'
  | 'RECEIPT_TRANSMITTED'
  | 'RECEIPT_SIGNED_BY_TENANT'
  | 'CAUTION_DECLARED'
  | 'CAUTION_CONFIRMED'
  | 'CAUTION_REJECTED'
  | 'CAUTION_RESTITUTED'
  | 'CAUTION_RECEIPT_TRANSMITTED'
  | 'CAUTION_SIGNED_BY_TENANT'
  | 'CONTRACT_FINALIZED'
  | 'CONTRACT_TRANSMITTED'
  | 'CONTRACT_SIGNED_BY_TENANT'
  | 'PROPERTY_RENTED'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_UPDATED'
  | 'AVATAR_UPDATED'
  | 'ACCOUNTING_YEAR_UPDATED'
  | 'NEW_MESSAGE'
  | 'MESSAGES_READ'
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_READ'
  | 'CALL_INCOMING'
  | 'CALL_ACCEPTED'
  | 'CALL_OFFER'
  | 'CALL_ANSWER'
  | 'CALL_ICE_CANDIDATE'
  | 'CALL_REJECTED'
  | 'CALL_ENDED';

interface BroadcastPayload {
  event: LiveEventType;
  actorId?: string;
  targetUserId?: string;
  propertyId?: string;
  contractId?: string;
  paymentId?: string;
  depositId?: string;
  data?: any;
  timestamp: string;
}

const GLOBAL_REALTIME_CHANNEL = 'locatrust_live_sync';

let sharedLiveChannel: ReturnType<typeof supabase.channel> | null = null;
let currentActiveUserId: string | undefined = undefined;

function dispatchDomEventForType(event: LiveEventType, payload?: BroadcastPayload) {
  if (typeof window === 'undefined') return;

  try {
    switch (event) {
      case 'PAYMENT_DECLARED':
        if (typeof window !== 'undefined') {
          const senderId = payload?.actorId || 'usr_tenant';
          const receiverId = payload?.targetUserId || 'usr_owner';
          const amount = payload?.data?.amount;
          const ref = payload?.data?.reference || payload?.data?.transactionRef;
          const paymentObj = payload?.data?.payment;

          // 1. Ingestion directe dans locatrust_rent_payments pour disponibilité immédiate sur téléphone/tablette
          if (paymentObj) {
            try {
              const curPmtsRaw = localStorage.getItem('locatrust_rent_payments');
              const curPmts = curPmtsRaw ? JSON.parse(curPmtsRaw) : [];
              const exists = curPmts.some((p: any) => p.id === paymentObj.id || (paymentObj.reference && p.reference === paymentObj.reference));
              if (!exists) {
                const updatedPmts = [paymentObj, ...curPmts];
                localStorage.setItem('locatrust_rent_payments', JSON.stringify(updatedPmts));
              }
            } catch {}
          }

          // 2. Notification in-app pour propriétaire ET agence (ex: compte KK)
          try {
            const notifsRaw = localStorage.getItem('locatrust_notifications');
            const curNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
            const notifId = `notif_pmt_dec_${payload?.paymentId || Date.now()}`;
            const exists = curNotifs.some((n: any) => n.id === notifId);
            if (!exists) {
              const baseNotif = {
                id: notifId,
                title: '💳 Nouveau paiement de loyer déclaré',
                description: `Paiement déclaré${amount ? ` de ${Number(amount).toLocaleString('fr-FR')} FCFA` : ''}${ref ? ` (Réf: ${ref})` : ''}. Cliquez pour vérifier et valider la quittance.`,
                time: "À l'instant",
                unread: true,
                type: 'paiement',
                category: 'paiement',
                targetTab: 'payments',
                targetUserId: receiverId,
                senderUserId: senderId,
                payload: { paymentId: payload?.paymentId, amount }
              };
              const notifProp = { ...baseNotif, targetRole: 'proprietaire' };
              const notifAgency = { ...baseNotif, id: `${notifId}_agency`, targetRole: 'agence' };
              const merged = [notifProp, notifAgency, ...curNotifs];
              localStorage.setItem('locatrust_notifications', JSON.stringify(merged));
              window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: merged } }));
            }
          } catch {}

          window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: payload }));
        }
        break;

      case 'PAYMENT_CONFIRMED':
        if (typeof window !== 'undefined') {
          const pmtId = payload?.paymentId;
          const rcpData = payload?.data?.receipt;
          const pmtData = payload?.data?.payment;
          const rcpNum = payload?.data?.receipt_number || payload?.data?.receiptNumber || rcpData?.receiptNumber;
          const senderId = payload?.actorId || 'usr_owner';
          const receiverId = payload?.targetUserId || 'usr_tenant';
          const amount = payload?.data?.amount || rcpData?.amount;
          const actor = payload?.data?.actorName || 'votre bailleur';

          // 1. Ingestion directe dans locatrust_tenant_receipts_v2 et locatrust_receipts
          if (rcpNum) {
            try {
              const curRaw = localStorage.getItem('locatrust_tenant_receipts_v2');
              const cur = curRaw ? JSON.parse(curRaw) : [];
              const receiptObj = rcpData || {
                receiptNumber: rcpNum,
                type: 'loyer',
                amount: amount || 0,
                propertyTitle: pmtData?.property?.title || 'Logement loué',
                ownerName: actor,
                tenantName: 'christian',
                periodsCovered: pmtData?.period_text || 'Mois en cours',
                date: new Date().toISOString(),
                token: `tok_rec_${rcpNum}`
              };
              const filtered = cur.filter((r: any) => (r.receiptNumber !== rcpNum && r.receipt_number !== rcpNum));
              localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify([receiptObj, ...filtered]));
            } catch {}

            try {
              const curRcpRaw = localStorage.getItem('locatrust_receipts');
              const curRcps = curRcpRaw ? JSON.parse(curRcpRaw) : [];
              const rcpRow = {
                id: `rcp_${rcpNum}_${Date.now()}`,
                receipt_number: rcpNum,
                type: 'loyer',
                amount: amount || 0,
                period_covered: pmtData?.period_text || 'Mois en cours',
                tenant_id: receiverId,
                owner_id: senderId,
                token: `tok_rec_${rcpNum}`,
                created_at: new Date().toISOString()
              };
              const filteredRcps = curRcps.filter((r: any) => r.receipt_number !== rcpNum);
              localStorage.setItem('locatrust_receipts', JSON.stringify([rcpRow, ...filteredRcps]));
            } catch {}
          }

          // 2. Notification in-app pour le locataire
          try {
            const notifsRaw = localStorage.getItem('locatrust_notifications');
            const curNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
            const notifId = `notif_rent_val_${rcpNum || pmtId || Date.now()}`;
            const exists = curNotifs.some((n: any) => n.id === notifId);
            if (!exists) {
              const rentNotif = {
                id: notifId,
                title: '📄 Quittance de loyer officielle disponible !',
                description: `Votre règlement de loyer${amount ? ` de ${Number(amount).toLocaleString('fr-FR')} FCFA` : ''} a été validé par ${actor}. Votre quittance N° ${rcpNum || 'officielle'} est disponible pour téléchargement.`,
                time: "À l'instant",
                unread: true,
                type: 'paiement_valide',
                category: 'paiement',
                targetTab: 'receipts',
                targetRole: 'locataire',
                targetUserId: receiverId,
                senderUserId: senderId,
                payload: { paymentId: pmtId, receiptNumber: rcpNum, amount }
              };
              localStorage.setItem('locatrust_notifications', JSON.stringify([rentNotif, ...curNotifs]));

              try {
                const rawTenantNotifs = localStorage.getItem('locatrust_tenant_notifications');
                const parsedTenantNotifs = rawTenantNotifs ? JSON.parse(rawTenantNotifs) : [];
                const tenantViewNotif = {
                  id: rentNotif.id,
                  title: rentNotif.title,
                  description: rentNotif.description,
                  category: 'paiement',
                  timestamp: "À l'instant",
                  read: false,
                  actionText: 'Télécharger ma quittance',
                  targetTab: 'receipts'
                };
                localStorage.setItem('locatrust_tenant_notifications', JSON.stringify([tenantViewNotif, ...parsedTenantNotifs]));
              } catch {}

              window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: [rentNotif, ...curNotifs] } }));
            }
          } catch {}

          window.dispatchEvent(new CustomEvent('locatrust:receipts_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: payload }));
        }
        break;

      case 'RECEIPT_TRANSMITTED':
        if (typeof window !== 'undefined') {
          const pmtId = payload?.paymentId;
          const rcpData = payload?.data?.receipt;
          const rcpNum = payload?.data?.receipt_number || payload?.data?.receiptNumber || rcpData?.receiptNumber;
          const senderId = payload?.actorId || 'usr_owner';
          const receiverId = payload?.targetUserId || 'usr_tenant';
          const amount = payload?.data?.amount || rcpData?.amount;
          const actor = payload?.data?.actorName || 'votre bailleur';

          // 1. Ingestion directe dans locatrust_rent_payments avec statut 'en_attente_signature_locataire'
          try {
            const curPmtsRaw = localStorage.getItem('locatrust_rent_payments');
            let curPmts = curPmtsRaw ? JSON.parse(curPmtsRaw) : [];
            if (Array.isArray(curPmts)) {
              curPmts = curPmts.map((p: any) => {
                if (p.id === pmtId || (rcpNum && p.reference === rcpNum)) {
                  return { ...p, status: 'en_attente_signature_locataire', receipt_number: rcpNum };
                }
                return p;
              });
              localStorage.setItem('locatrust_rent_payments', JSON.stringify(curPmts));
            }
          } catch {}

          // 2. Notification in-app pour inviter le locataire à signer
          try {
            const notifsRaw = localStorage.getItem('locatrust_notifications');
            const curNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
            const notifId = `notif_sign_rec_${rcpNum || pmtId || Date.now()}`;
            const signNotif = {
              id: notifId,
              title: '🛡️ Quittance de loyer reçue pour signature',
              description: `Votre quittance N° ${rcpNum || 'officielle'}${amount ? ` (${Number(amount).toLocaleString('fr-FR')} FCFA)` : ''} a été validée par ${actor}. Veuillez y apposer votre signature manuscrite pour la sceller.`,
              time: "À l'instant",
              unread: true,
              type: 'quittance_signature_requise',
              category: 'paiement',
              targetTab: 'payments',
              targetRole: 'locataire',
              targetUserId: receiverId,
              senderUserId: senderId,
              payload: { action: 'sign_receipt', paymentId: pmtId, receiptNumber: rcpNum, amount }
            };
            const updatedNotifs = [signNotif, ...curNotifs.filter((n: any) => n.id !== notifId)];
            localStorage.setItem('locatrust_notifications', JSON.stringify(updatedNotifs));
            window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: updatedNotifs } }));
          } catch {}

          window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:receipts_updated', { detail: payload }));
        }
        break;

      case 'RECEIPT_SIGNED_BY_TENANT':
        if (typeof window !== 'undefined') {
          const pmtId = payload?.paymentId;
          const rcpNum = payload?.data?.receipt_number;
          const tenantName = payload?.data?.actorName || 'Le locataire';

          // 1. Mettre à jour locatrust_rent_payments au statut confirme
          try {
            const curPmtsRaw = localStorage.getItem('locatrust_rent_payments');
            let curPmts = curPmtsRaw ? JSON.parse(curPmtsRaw) : [];
            if (Array.isArray(curPmts)) {
              curPmts = curPmts.map((p: any) => {
                if (p.id === pmtId || (rcpNum && p.reference === rcpNum)) {
                  return { ...p, status: 'confirme', confirmed_at: new Date().toISOString() };
                }
                return p;
              });
              localStorage.setItem('locatrust_rent_payments', JSON.stringify(curPmts));
            }
          } catch {}

          // 2. Notification pour bailleur et agence
          try {
            const notifsRaw = localStorage.getItem('locatrust_notifications');
            const curNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
            const notifId = `notif_sealed_${rcpNum || pmtId || Date.now()}`;
            const sealedNotif = {
              id: notifId,
              title: '✅ Quittance scellée et signée par le locataire',
              description: `${tenantName} a apposé sa signature manuscrite sur la quittance N° ${rcpNum || 'officielle'}. Le document est officiellement scellé et téléchargeable.`,
              time: "À l'instant",
              unread: true,
              type: 'paiement',
              category: 'paiement',
              targetTab: 'receipts',
              targetRole: 'agence',
              payload: { paymentId: pmtId, receiptNumber: rcpNum }
            };
            const updatedNotifs = [sealedNotif, { ...sealedNotif, id: `${notifId}_owner`, targetRole: 'proprietaire' }, ...curNotifs.filter((n: any) => n.id !== notifId)];
            localStorage.setItem('locatrust_notifications', JSON.stringify(updatedNotifs));
            window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: updatedNotifs } }));
          } catch {}

          window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:receipts_updated', { detail: payload }));
        }
        break;

      case 'PAYMENT_REJECTED':
        window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: payload }));
        break;

      case 'CAUTION_DECLARED':
        if (typeof window !== 'undefined') {
          const senderId = payload?.actorId || 'usr_tenant';
          const receiverId = payload?.targetUserId || 'usr_owner';
          const amount = payload?.data?.amount;
          const cautionObj = payload?.data?.caution;

          // 1. Ingestion directe dans locatrust_caution_deposits & locatrust_deposits_v1
          if (cautionObj) {
            try {
              const curDepsRaw = localStorage.getItem('locatrust_deposits_v1') || localStorage.getItem('locatrust_caution_deposits');
              const curDeps = curDepsRaw ? JSON.parse(curDepsRaw) : [];
              const exists = curDeps.some((d: any) => d.id === cautionObj.id || (cautionObj.reference && d.reference === cautionObj.reference));
              if (!exists) {
                const updatedDeps = [cautionObj, ...curDeps];
                localStorage.setItem('locatrust_deposits_v1', JSON.stringify(updatedDeps));
                localStorage.setItem('locatrust_caution_deposits', JSON.stringify(updatedDeps));
              }
            } catch {}
          }

          // 2. Notification in-app pour propriétaire ET agence (ex: compte KK)
          try {
            const notifsRaw = localStorage.getItem('locatrust_notifications');
            const curNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
            const notifId = `notif_caut_dec_${payload?.depositId || Date.now()}`;
            const exists = curNotifs.some((n: any) => n.id === notifId);
            if (!exists) {
              const baseNotif = {
                id: notifId,
                title: '🛡️ Règlement de caution déclaré',
                description: `Paiement de caution soumis${amount ? ` (${Number(amount).toLocaleString('fr-FR')} FCFA)` : ''}. Cliquez pour vérifier et émettre le reçu officiel.`,
                time: "À l'instant",
                unread: true,
                type: 'caution',
                category: 'caution',
                targetTab: 'cautions',
                targetUserId: receiverId,
                senderUserId: senderId,
                payload: { depositId: payload?.depositId, amount }
              };
              const notifProp = { ...baseNotif, targetRole: 'proprietaire' };
              const notifAgency = { ...baseNotif, id: `${notifId}_agency`, targetRole: 'agence' };
              const merged = [notifProp, notifAgency, ...curNotifs];
              localStorage.setItem('locatrust_notifications', JSON.stringify(merged));
              window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: merged } }));
            }
          } catch {}
          window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: payload }));
        }
        break;

      case 'CAUTION_REJECTED':
      case 'CAUTION_RESTITUTED':
        window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: payload }));
        break;

      case 'CONTRACT_FINALIZED':
      case 'CONTRACT_TRANSMITTED':
      case 'CONTRACT_SIGNED_BY_TENANT':
        window.dispatchEvent(new CustomEvent('locatrust:contracts-updated', { detail: payload }));
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: payload }));
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated', { detail: payload }));
        break;

      case 'PROPERTY_RENTED':
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated', { detail: payload }));
        break;

      case 'APPLICATION_SUBMITTED':
      case 'APPLICATION_UPDATED':
        if (typeof window !== 'undefined' && payload?.data) {
          try {
            const raw = localStorage.getItem('locatrust_rental_applications');
            const apps = raw ? JSON.parse(raw) : [];
            const newApp = payload.data;
            const updated = [newApp, ...apps.filter((a: any) => a.id !== newApp.id)];
            localStorage.setItem('locatrust_rental_applications', JSON.stringify(updated));
          } catch {}
        }
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: payload }));
        break;

      case 'AVATAR_UPDATED':
        if (typeof window !== 'undefined') {
          const newAvatar = payload?.data?.avatarUrl;
          const actorId = payload?.actorId || payload?.data?.userId;
          const senderRole = payload?.data?.role;
          const myId = currentActiveUserId;

          if (newAvatar) {
            try {
              if (actorId) {
                localStorage.setItem(`locatrust_user_avatar_${actorId}`, newAvatar);
              }
              if (senderRole === 'agence' || actorId === 'usr_agency') {
                localStorage.setItem('locatrust_agency_avatar', newAvatar);
                localStorage.setItem('locatrust_user_avatar_usr_agency', newAvatar);
              } else if (senderRole === 'proprietaire' || actorId === 'usr_owner') {
                localStorage.setItem('locatrust_owner_avatar', newAvatar);
                localStorage.setItem('locatrust_user_avatar_usr_owner', newAvatar);
              } else if (senderRole === 'locataire' || actorId === 'usr_tenant') {
                localStorage.setItem('locatrust_tenant_avatar', newAvatar);
                localStorage.setItem('locatrust_user_avatar_usr_tenant', newAvatar);
              }

              // Seulement si c'est le compte de l'utilisateur actif lui-même
              if (actorId && actorId === myId) {
                localStorage.setItem('locatrust_user_avatar', newAvatar);
              }
            } catch {}
          }
          window.dispatchEvent(new CustomEvent('locatrust:avatar_updated', { detail: { avatarUrl: newAvatar, actorId, role: senderRole } }));
          window.dispatchEvent(new CustomEvent('locatrust:profile_updated'));
        }
        break;

      case 'ACCOUNTING_YEAR_UPDATED':
        if (typeof window !== 'undefined') {
          const yr = payload?.data?.year;
          if (yr) {
            try {
              localStorage.setItem('locatrust_current_accounting_year', yr);
              localStorage.setItem('locatrust_reference_accounting_year', yr);
            } catch {}
            window.dispatchEvent(new CustomEvent('locatrust:year_changed', {
              detail: { year: yr, isTemporary: false, currentYear: yr }
            }));
          }
        }
        break;

      case 'CAUTION_CONFIRMED':
      case 'CAUTION_RECEIPT_TRANSMITTED':
        if (typeof window !== 'undefined') {
          const q = payload?.data?.quittance;
          const incomingDeposit = payload?.data?.deposit;
          const depId = payload?.depositId || incomingDeposit?.id;
          const senderId = payload?.actorId || incomingDeposit?.owner_id || '';
          const receiverId = payload?.targetUserId || incomingDeposit?.tenant_id || '';

          // Isolation stricte : ignorer si l'événement ne concerne pas l'utilisateur connecté
          if (currentActiveUserId && senderId !== currentActiveUserId && receiverId !== currentActiveUserId) {
            break;
          }

          let actor = payload?.data?.actorName || q?.ownerName || 'Bailleur Propriétaire';
          if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(actor) || actor.startsWith('usr_')) {
            actor = 'Bailleur Propriétaire';
          }

          const amount = payload?.data?.amount || q?.amount || incomingDeposit?.amount_paid || incomingDeposit?.amount_requested || 0;
          const amountFormatted = amount ? `${Number(amount).toLocaleString('fr-FR')} FCFA` : 'garantie';

          // 0. Stocker la fiche de contact dans l'espace scopé du destinataire
          if (currentActiveUserId && senderId && senderId !== currentActiveUserId) {
            import('@/lib/messagingStore')
              .then((m) => {
                m.saveUserScopedContact(currentActiveUserId, {
                  id: senderId,
                  name: actor,
                  phone: q?.ownerPhone || '+225 07 00 00 00 00',
                  role: 'Bailleur Propriétaire',
                  propertyTitle: q?.propertyTitle || 'Logement',
                  online: true
                });
              })
              .catch(() => {});
          }

          // 1. Ingestion directe dans le registre des reçus du locataire
          if (q && q.receiptNumber) {
            try {
              const curRaw = localStorage.getItem('locatrust_tenant_receipts_v2');
              const cur = curRaw ? JSON.parse(curRaw) : [];
              const filtered = cur.filter((r: any) => r.receiptNumber !== q.receiptNumber);
              localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify([q, ...filtered]));
            } catch {}

            try {
              const curRcpRaw = localStorage.getItem('locatrust_receipts');
              const curRcps = curRcpRaw ? JSON.parse(curRcpRaw) : [];
              const rcpRow = {
                id: `rcp_caut_${q.receiptNumber}_${Date.now()}`,
                receipt_number: q.receiptNumber,
                type: 'caution',
                amount: amount,
                period_covered: 'Dépôt de garantie',
                tenant_id: receiverId,
                owner_id: senderId,
                token: `tok_caut_${q.receiptNumber}`,
                created_at: new Date().toISOString()
              };
              const filteredRcps = curRcps.filter((r: any) => r.receipt_number !== q.receiptNumber);
              localStorage.setItem('locatrust_receipts', JSON.stringify([rcpRow, ...filteredRcps]));
            } catch {}
          }

          // 2. Ingestion du message certifié dans la boîte de messagerie
          if (q) {
            try {
              const msgsRaw = localStorage.getItem('locatrust_chat_messages_v4');
              const curMsgs = msgsRaw ? JSON.parse(msgsRaw) : [];
              const exists = curMsgs.some(
                (m: any) =>
                  m.quittance?.receiptNumber === q.receiptNumber ||
                  (m.text && m.text.includes(q.receiptNumber))
              );
              if (!exists) {
                const newMsg = {
                  id: `msg_caut_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  sender_id: senderId,
                  receiver_id: receiverId,
                  text: `🛡️ Reçu Officiel de Caution Émis (N° ${q.receiptNumber})\nVotre dépôt de garantie de ${q.amount} FCFA a été certifié par votre bailleur. Veuillez consulter le document ci-dessous pour apposer votre signature locataire et débloquer le téléchargement.`,
                  created_at: new Date().toISOString(),
                  quittance: q,
                  status: 'delivered'
                };
                localStorage.setItem('locatrust_chat_messages_v4', JSON.stringify([...curMsgs, newMsg]));
              }
            } catch {}
          }

          // 3. Synchronisation complète de la caution dans les deux clés de stockage
          const applyDepositSync = (storageKey: string) => {
            try {
              const raw = localStorage.getItem(storageKey);
              let list = raw ? JSON.parse(raw) : [];
              if (!Array.isArray(list)) list = [];

              let found = false;
              list = list.map((d: any) => {
                const matches = 
                  d.id === depId || 
                  (depId && d.id && d.id.toLowerCase() === depId.toLowerCase()) ||
                  (depId && d.contract_id === payload?.contractId) ||
                  (incomingDeposit && incomingDeposit.id && d.id === incomingDeposit.id);
                if (matches) {
                  found = true;
                  return {
                    ...d,
                    ...(incomingDeposit || {}),
                    status: 'paye_complet',
                    amount_paid: amount || d.amount_paid || d.amount_requested,
                    confirmed_at: d.confirmed_at || new Date().toISOString(),
                    confirmed_by: actor,
                    owner_signature: q?.ownerSignatureUrl || incomingDeposit?.owner_signature || d.owner_signature || 'SIG_OFFICIAL_OWNER_CERTIFIED',
                    receipt_sent_to_tenant: true,
                    property: {
                      ...(d.property || {}),
                      title: q?.propertyTitle || d.property?.title || 'appartement',
                      address: q?.propertyAddress || d.property?.address || "100 villard, yamoussoukro - Côte d'Ivoire",
                      reference: q?.propertyReference || d.property?.reference || 'BIEN-1B0E4B',
                      owner_name: actor
                    }
                  };
                }
                return d;
              });

              if (!found) {
                const synDep = incomingDeposit ? {
                  ...incomingDeposit,
                  status: 'paye_complet',
                  amount_paid: amount || incomingDeposit.amount_paid || incomingDeposit.amount_requested,
                  owner_signature: q?.ownerSignatureUrl || incomingDeposit.owner_signature || 'SIG_OFFICIAL_OWNER_CERTIFIED',
                  receipt_sent_to_tenant: true,
                  confirmed_by: actor,
                  property: {
                    ...(incomingDeposit.property || {}),
                    title: q?.propertyTitle || incomingDeposit.property?.title || 'appartement',
                    address: q?.propertyAddress || incomingDeposit.property?.address || "100 villard, yamoussoukro - Côte d'Ivoire",
                    reference: q?.propertyReference || incomingDeposit.property?.reference || 'BIEN-1B0E4B',
                    owner_name: actor
                  }
                } : {
                  id: depId || `dep_${Date.now()}`,
                  contract_id: payload?.contractId || q?.contractNumber || 'LT-2026-CI-000492',
                  property_id: q?.propertyId || 'prop_default',
                  tenant_id: receiverId,
                  owner_id: senderId,
                  amount_requested: amount,
                  amount_paid: amount,
                  status: 'paye_complet',
                  receipt_sent_to_tenant: true,
                  owner_signature: q?.ownerSignatureUrl || 'SIG_OFFICIAL_OWNER_CERTIFIED',
                  owner_signed_at: new Date().toISOString(),
                  confirmed_at: new Date().toISOString(),
                  confirmed_by: actor,
                  property: {
                    title: q?.propertyTitle || 'appartement',
                    address: q?.propertyAddress || "100 villard, yamoussoukro - Côte d'Ivoire",
                    reference: q?.propertyReference || 'BIEN-1B0E4B',
                    owner_name: actor
                  },
                  tenant: {
                    id: receiverId,
                    full_name: q?.tenantName || 'christian',
                    phone: q?.tenantPhone || '0500552141',
                    cni: q?.tenantCni || 'CI123456789'
                  }
                };
                list.unshift(synDep);
              }

              localStorage.setItem(storageKey, JSON.stringify(list));
            } catch {}
          };

          applyDepositSync('locatrust_caution_deposits');
          applyDepositSync('locatrust_deposits_v1');

          // 4. Ingestion de la notification in-app pour le locataire
          try {
            const notifsRaw = localStorage.getItem('locatrust_notifications');
            const curNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
            const notifId = `notif_caut_ready_${depId || Date.now()}`;
            const exists = curNotifs.some((n: any) => n.id === notifId);
            if (!exists) {
              const tenantNotif = {
                id: notifId,
                title: '🛡️ Reçu officiel de caution reçu pour signature',
                description: `Votre caution de ${amountFormatted} a été validée par ${actor}. Cliquez pour consulter et apposer votre signature locataire.`,
                time: "À l'instant",
                unread: true,
                type: 'caution',
                category: 'caution',
                targetTab: 'guarantees',
                targetRole: 'locataire',
                targetUserId: receiverId,
                senderUserId: senderId,
                payload: { depositId: depId, amount }
              };
              localStorage.setItem('locatrust_notifications', JSON.stringify([tenantNotif, ...curNotifs]));

              try {
                const rawTenantNotifs = localStorage.getItem('locatrust_tenant_notifications');
                const parsedTenantNotifs = rawTenantNotifs ? JSON.parse(rawTenantNotifs) : [];
                const tenantViewNotif = {
                  id: tenantNotif.id,
                  title: tenantNotif.title,
                  description: tenantNotif.description,
                  category: 'caution',
                  timestamp: "À l'instant",
                  read: false,
                  actionText: 'Signer mon reçu',
                  targetTab: 'guarantees'
                };
                localStorage.setItem('locatrust_tenant_notifications', JSON.stringify([tenantViewNotif, ...parsedTenantNotifs]));
              } catch {}

              window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: [tenantNotif, ...curNotifs] } }));
            }
          } catch {}

          // 5. Cartes de contacts bidirectionnelles scopées par utilisateur
          try {
            if (q && currentActiveUserId) {
              import('@/lib/messagingStore')
                .then((m) => {
                  if (senderId && senderId !== currentActiveUserId) {
                    m.saveUserScopedContact(currentActiveUserId, {
                      id: senderId,
                      name: q.ownerName || actor || 'Bailleur Propriétaire',
                      role: 'Propriétaire Bailleur',
                      propertyTitle: q.propertyTitle,
                      phone: q.ownerPhone || '+225 07 00 00 00 00',
                      online: true
                    });
                  }
                  if (receiverId && receiverId !== currentActiveUserId) {
                    m.saveUserScopedContact(currentActiveUserId, {
                      id: receiverId,
                      name: q.tenantName || 'Locataire',
                      role: 'Locataire',
                      propertyTitle: q.propertyTitle,
                      phone: q.tenantPhone || '+225 05 00 00 00 00',
                      online: true
                    });
                  }
                })
                .catch(() => {});
            }
          } catch {}

          window.dispatchEvent(new CustomEvent('locatrust:receipts_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: payload }));
        }
        break;

      case 'CAUTION_SIGNED_BY_TENANT':
        if (typeof window !== 'undefined') {
          const depId = payload?.depositId || payload?.data?.depositId;
          const tenantSig = payload?.data?.tenantSignatureUrl || (payload?.data?.deposit as any)?.tenant_signature;
          const rcpNum = payload?.data?.receiptNumber || (payload?.data?.deposit as any)?.receipt_number;
          const incomingDeposit = payload?.data?.deposit;
          const now = new Date().toISOString();

          // 1. Mettre à jour locatrust_caution_deposits et locatrust_deposits_v1
          const updateDepositList = (key: string) => {
            try {
              const raw = localStorage.getItem(key);
              let list = raw ? JSON.parse(raw) : [];
              if (!Array.isArray(list)) list = [];
              let found = false;
              list = list.map((d: any) => {
                const cleanId = d.id ? d.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                const cleanDepId = depId ? depId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                const cleanRcp = rcpNum ? rcpNum.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                const matches =
                  (depId && d.id === depId) ||
                  (depId && d.id && d.id.toLowerCase() === depId.toLowerCase()) ||
                  (cleanId && cleanDepId && (cleanId === cleanDepId || cleanId.includes(cleanDepId) || cleanDepId.includes(cleanId))) ||
                  (rcpNum && d.receipt_number === rcpNum) ||
                  (cleanRcp && d.receipt_number && d.receipt_number.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanRcp) ||
                  (payload?.contractId && d.contract_id === payload.contractId) ||
                  (incomingDeposit && d.id === incomingDeposit.id);
                if (matches) {
                  found = true;
                  return {
                    ...d,
                    ...(incomingDeposit || {}),
                    tenant_signature: tenantSig || incomingDeposit?.tenant_signature || d.tenant_signature || 'SIG_OFFICIAL_TENANT_CERTIFIED',
                    tenant_signed_at: d.tenant_signed_at || now,
                    status: 'paye_complet'
                  };
                }
                return d;
              });
              if (!found && incomingDeposit) {
                list.unshift({
                  ...incomingDeposit,
                  tenant_signature: tenantSig || incomingDeposit.tenant_signature || 'SIG_OFFICIAL_TENANT_CERTIFIED',
                  tenant_signed_at: now,
                  status: 'paye_complet'
                });
              }
              localStorage.setItem(key, JSON.stringify(list));
            } catch {}
          };
          updateDepositList('locatrust_caution_deposits');
          updateDepositList('locatrust_deposits_v1');

          // 2. Mettre à jour locatrust_chat_messages_v4
          try {
            const rawMsgs = localStorage.getItem('locatrust_chat_messages_v4');
            if (rawMsgs) {
              const msgs = JSON.parse(rawMsgs);
              if (Array.isArray(msgs)) {
                const cleanDepId = depId ? depId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                const cleanRcp = rcpNum ? rcpNum.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                const updatedMsgs = msgs.map((m: any) => {
                  if (m.quittance) {
                    const q = m.quittance;
                    const qCleanDepId = q.depositId ? q.depositId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                    const qCleanRcp = q.receiptNumber ? q.receiptNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                    const matches =
                      (depId && q.depositId === depId) ||
                      (cleanDepId && qCleanDepId && (cleanDepId === qCleanDepId || cleanDepId.includes(qCleanDepId) || qCleanDepId.includes(cleanDepId))) ||
                      (rcpNum && q.receiptNumber === rcpNum) ||
                      (cleanRcp && qCleanRcp && (cleanRcp === qCleanRcp || cleanRcp.includes(qCleanRcp) || qCleanRcp.includes(cleanRcp))) ||
                      (payload?.contractId && q.contractNumber === payload.contractId);
                    if (matches) {
                      return {
                        ...m,
                        quittance: {
                          ...q,
                          tenantSignatureUrl: tenantSig || q.tenantSignatureUrl || 'SIG_OFFICIAL_TENANT_CERTIFIED'
                        }
                      };
                    }
                  }
                  return m;
                });
                localStorage.setItem('locatrust_chat_messages_v4', JSON.stringify(updatedMsgs));
              }
            }
          } catch {}

          // 3. Mettre à jour locatrust_tenant_receipts_v2
          try {
            const rawRcp = localStorage.getItem('locatrust_tenant_receipts_v2');
            if (rawRcp) {
              const rcps = JSON.parse(rawRcp);
              if (Array.isArray(rcps)) {
                const updatedRcps = rcps.map((r: any) => {
                  const matches =
                    (depId && r.depositId === depId) ||
                    (rcpNum && r.receiptNumber === rcpNum) ||
                    (payload?.contractId && r.contractNumber === payload.contractId);
                  if (matches) {
                    return {
                      ...r,
                      tenantSignatureUrl: tenantSig || r.tenantSignatureUrl || 'SIG_OFFICIAL_TENANT_CERTIFIED'
                    };
                  }
                  return r;
                });
                localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify(updatedRcps));
              }
            }
          } catch {}

          // 4. Notification pour le bailleur / agence
          try {
            const notifsRaw = localStorage.getItem('locatrust_notifications');
            const curNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
            const notifId = `notif_caut_signed_${depId || Date.now()}`;
            if (!curNotifs.some((n: any) => n.id === notifId)) {
              const ownerNotif = {
                id: notifId,
                title: '✅ Reçu de caution contresigné par le locataire',
                description: `Le locataire a apposé sa signature certifiée sur le reçu de caution N° ${rcpNum || 'OFFICIEL'}. Le document est officiellement scellé et téléchargeable.`,
                time: "À l'instant",
                unread: true,
                type: 'caution',
                category: 'caution',
                targetTab: 'guarantees',
                targetRole: 'proprietaire',
                targetUserId: payload?.targetUserId || 'usr_owner'
              };
              localStorage.setItem('locatrust_notifications', JSON.stringify([ownerNotif, ...curNotifs]));
              window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: [ownerNotif, ...curNotifs] } }));
            }
          } catch {}

          window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:receipts_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: payload }));
        }
        break;

      case 'NEW_MESSAGE':
        if (typeof window !== 'undefined') {
          const incomingMsg = payload?.data;
          if (incomingMsg && (incomingMsg.id || incomingMsg.text)) {
            const senderId = incomingMsg.sender_id || incomingMsg.senderId || payload?.actorId;
            const receiverId = incomingMsg.receiver_id || incomingMsg.receiverId || payload?.targetUserId;

            // ISOLATION STRICTE : si l'utilisateur actif n'est ni l'expéditeur ni le destinataire, ignorer totalement
            if (!currentActiveUserId || (senderId !== currentActiveUserId && receiverId !== currentActiveUserId)) {
              break;
            }
            if (!senderId || !receiverId || senderId === receiverId) {
              break;
            }

            // 1. Sauvegarder la fiche de contact de l'interlocuteur dans le registre scopé de l'utilisateur actif
            if (senderId !== currentActiveUserId) {
              try {
                const contactName = incomingMsg.sender_name;
                const contactAvatar = incomingMsg.sender_avatar;
                const contactRole = incomingMsg.sender_role || 'Locataire';
                const propertyTitle = incomingMsg.property_title || 'Échange direct';

                import('@/lib/messagingStore')
                  .then((m) => {
                    m.saveUserScopedContact(currentActiveUserId, {
                      id: senderId,
                      name: contactName || (contactRole.toLowerCase().includes('proprietaire') ? 'Propriétaire Bailleur' : contactRole.toLowerCase().includes('agence') ? 'Agence Immobilière Agréée' : 'Locataire'),
                      role: contactRole,
                      propertyTitle: propertyTitle,
                      avatar: contactAvatar || '',
                      online: true
                    });
                  })
                  .catch(() => {});
              } catch {}
            }

            // 2. Ingestion du message dans le stockage scopé de l'utilisateur actif
            try {
              import('@/lib/messagingStore')
                .then((m) => {
                  const curMsgs = m.getStoredMessages(currentActiveUserId);
                  const exists = curMsgs.some(
                    (existing: any) =>
                      existing.id === incomingMsg.id ||
                      (existing.sender_id === senderId &&
                        existing.text === incomingMsg.text &&
                        Math.abs(new Date(existing.created_at).getTime() - new Date(incomingMsg.created_at).getTime()) < 60000)
                  );
                  if (!exists) {
                    const formattedMsg = {
                      id: incomingMsg.id || `msg_${Date.now()}`,
                      sender_id: senderId,
                      receiver_id: receiverId,
                      text: incomingMsg.text || '',
                      created_at: incomingMsg.created_at || new Date().toISOString(),
                      status: incomingMsg.status || 'delivered',
                      quittance: incomingMsg.quittance,
                      contract: incomingMsg.contract,
                      declaration: incomingMsg.declaration
                    };
                    m.saveStoredMessages([...curMsgs, formattedMsg], currentActiveUserId);
                  }
                })
                .catch(() => {});
            } catch {}

            // 3. Si le message transporte une quittance ou un reçu de caution
            if (incomingMsg.quittance && incomingMsg.quittance.receiptNumber && receiverId === currentActiveUserId) {
              try {
                const curRaw = localStorage.getItem('locatrust_tenant_receipts_v2');
                const cur = curRaw ? JSON.parse(curRaw) : [];
                const filtered = cur.filter((r: any) => r.receiptNumber !== incomingMsg.quittance.receiptNumber);
                localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify([incomingMsg.quittance, ...filtered]));
                window.dispatchEvent(new CustomEvent('locatrust:receipts_updated', { detail: payload }));
              } catch {}
            }

            // 4. Notification in-app ciblée EXCLUSIVEMENT pour le destinataire (jamais pour l'expéditeur)
            if (senderId !== receiverId && receiverId === currentActiveUserId && senderId !== currentActiveUserId) {
              try {
                const notifsRaw = localStorage.getItem('locatrust_notifications');
                const curNotifs = notifsRaw ? JSON.parse(notifsRaw) : [];
                const notifId = incomingMsg.notificationId || `notif_msg_${incomingMsg.id || Date.now()}`;
                const senderDisplayName = incomingMsg.sender_name || 'Correspondant';
                const descText = (incomingMsg.text || '').length > 70 ? `${(incomingMsg.text || '').slice(0, 70)}...` : (incomingMsg.text || 'Message reçu');
                const nowIso = incomingMsg.created_at || new Date().toISOString();
                const exists = curNotifs.some(
                  (n: any) =>
                    n &&
                    (n.id === notifId ||
                      (n.targetUserId === receiverId &&
                        n.senderUserId === senderId &&
                        n.description === descText &&
                        n.created_at &&
                        n.created_at.slice(0, 16) === nowIso.slice(0, 16)))
                );
                if (!exists) {
                  const newNotif = {
                    id: notifId,
                    title: `Nouveau message de ${senderDisplayName}`,
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
                      messageId: incomingMsg.id
                    }
                  };
                  const mergedNotifs = [newNotif, ...curNotifs.slice(0, 49)];
                  localStorage.setItem('locatrust_notifications', JSON.stringify(mergedNotifs));
                  window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: { notifications: mergedNotifs } }));
                }
              } catch {}
            }
          }
          window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: payload }));
        }
        break;

      case 'MESSAGES_READ':
        if (typeof window !== 'undefined') {
          const readerId = payload?.data?.readerId || payload?.actorId;
          const contactId = payload?.data?.contactId;
          const messageIds: string[] = Array.isArray(payload?.data?.messageIds) ? payload.data.messageIds : [];
          if (readerId && (!currentActiveUserId || readerId === currentActiveUserId)) {
            import('@/lib/messagingStore')
              .then((m) => {
                if (contactId === '__all__') {
                  m.markAllMessagesAsReadForUser(readerId);
                } else if (contactId) {
                  m.markMessagesAsRead(contactId, readerId, messageIds);
                }
              })
              .catch(() => {});
          }
          window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: payload }));
        }
        break;

      case 'NOTIFICATION_CREATED':
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: payload }));
        }
        break;

      case 'NOTIFICATION_READ':
        if (typeof window !== 'undefined') {
          const actorId = payload?.actorId || payload?.targetUserId;
          if (!currentActiveUserId || actorId === currentActiveUserId) {
            import('@/lib/waitingListNotifications')
              .then((w) => {
                if (payload?.data?.all) {
                  w.markAllNotificationsAsRead(actorId);
                } else if (payload?.data?.notificationId) {
                  w.markNotificationAsRead(payload.data.notificationId, actorId);
                }
              })
              .catch(() => {});
          }
          window.dispatchEvent(new CustomEvent('locatrust:notifications-updated', { detail: payload }));
        }
        break;

      case 'CALL_INCOMING':
      case 'CALL_ACCEPTED':
      case 'CALL_OFFER':
      case 'CALL_ANSWER':
      case 'CALL_ICE_CANDIDATE':
      case 'CALL_REJECTED':
      case 'CALL_ENDED':
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('locatrust:call_event', { detail: payload }));
        }
        break;
    }
  } catch (e) {
    console.warn('Erreur dispatch événement local:', e);
  }
}

/**
 * Initialise le canal partagé UNE SEULE FOIS pour éviter l'erreur Supabase
 * "cannot add event handlers after subscribe"
 */
function initSharedChannel() {
  if (sharedLiveChannel) return sharedLiveChannel;

  try {
    const channel = supabase.channel(GLOBAL_REALTIME_CHANNEL, {
      config: {
        broadcast: { self: false }
      }
    });

    channel
      .on('broadcast', { event: 'locatrust_event' }, ({ payload }: { payload: BroadcastPayload }) => {
        try {
          console.log('⚡ Événement temps réel reçu :', payload.event, payload);
          dispatchDomEventForType(payload.event, payload);
          if (currentActiveUserId) {
            import('@/lib/unifiedSyncEngine').then(m => m.syncUserData(currentActiveUserId!)).catch(() => {});
          }
        } catch (e) {
          console.warn('Erreur gestion broadcast temps réel:', e);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
        if (payload?.new?.id && currentActiveUserId && payload.new.id === currentActiveUserId) {
          if (payload?.new?.avatar_url) {
            try { localStorage.setItem('locatrust_user_avatar', payload.new.avatar_url); } catch {}
            window.dispatchEvent(new CustomEvent('locatrust:avatar_updated', { detail: { avatarUrl: payload.new.avatar_url } }));
            window.dispatchEvent(new CustomEvent('locatrust:profile_updated', { detail: payload.new }));
          }
          if (payload?.new?.accounting_year) {
            const yr = payload.new.accounting_year;
            try {
              localStorage.setItem('locatrust_current_accounting_year', yr);
              localStorage.setItem('locatrust_reference_accounting_year', yr);
            } catch {}
            window.dispatchEvent(new CustomEvent('locatrust:year_changed', {
              detail: { year: yr, isTemporary: false, currentYear: yr }
            }));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rent_payments' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:payments-updated'));
        if (currentActiveUserId) {
          import('@/lib/unifiedSyncEngine').then(m => m.syncUserData(currentActiveUserId!)).catch(() => {});
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipts' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:receipts_updated'));
        window.dispatchEvent(new CustomEvent('locatrust:payments-updated'));
        if (currentActiveUserId) {
          import('@/lib/unifiedSyncEngine').then(m => m.syncUserData(currentActiveUserId!)).catch(() => {});
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cautions' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:cautions_updated'));
        if (currentActiveUserId) {
          import('@/lib/unifiedSyncEngine').then(m => m.syncUserData(currentActiveUserId!)).catch(() => {});
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:contracts-updated'));
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
        if (currentActiveUserId) {
          import('@/lib/unifiedSyncEngine').then(m => m.syncUserData(currentActiveUserId!)).catch(() => {});
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
        if (currentActiveUserId) {
          import('@/lib/unifiedSyncEngine').then(m => m.syncUserData(currentActiveUserId!)).catch(() => {});
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rental_applications' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated'));
        if (currentActiveUserId) {
          import('@/lib/unifiedSyncEngine').then(m => m.syncUserData(currentActiveUserId!)).catch(() => {});
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:messages-updated'));
        if (currentActiveUserId) {
          import('@/lib/unifiedSyncEngine').then(m => m.syncUserData(currentActiveUserId!)).catch(() => {});
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
        if (currentActiveUserId) {
          import('@/lib/unifiedSyncEngine').then(m => m.syncUserData(currentActiveUserId!)).catch(() => {});
        }
      });

    channel.subscribe((status) => {
      console.log('🔌 Statut canal temps réel LocaTrust:', status);
    });

    sharedLiveChannel = channel;
  } catch (err) {
    console.warn('Erreur initialisation canal temps réel:', err);
  }

  return sharedLiveChannel;
}

/**
 * Ferme proprement le canal Supabase Realtime lors de la déconnexion
 */
export function unsubscribeFromLiveSync() {
  currentActiveUserId = undefined;
  if (sharedLiveChannel) {
    try {
      supabase.removeChannel(sharedLiveChannel);
    } catch {}
    sharedLiveChannel = null;
  }
}

/**
 * Initialise l'écouteur Supabase Realtime multi-appareils (Desktop ↔ Mobile)
 */
export function subscribeToLiveSync(currentUserId?: string) {
  if (typeof window === 'undefined') return () => {};
  if (!currentUserId || (window as any).__LOCATRUST_LOGGING_OUT__) {
    unsubscribeFromLiveSync();
    return () => {};
  }

  currentActiveUserId = currentUserId;
  initSharedChannel();

  return () => {
    // Garde le canal actif tant que l'utilisateur est connecté
  };
}

/**
 * Diffuse un événement temps réel sur tous les appareils connectés
 */
export async function broadcastLiveEvent(
  event: LiveEventType,
  payload: Omit<BroadcastPayload, 'event' | 'timestamp'>
) {
  const fullPayload: BroadcastPayload = {
    event,
    ...payload,
    timestamp: new Date().toISOString()
  };

  try {
    const channel = initSharedChannel();
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'locatrust_event',
        payload: fullPayload
      });
    }
  } catch (err) {
    console.warn('Realtime broadcast error:', err);
  }

  // Déclencher également l'événement local immédiatement sur la fenêtre active
  dispatchDomEventForType(event, fullPayload);
}
