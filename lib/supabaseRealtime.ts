import { supabase } from '@/src/lib/supabase';

export type LiveEventType =
  | 'PAYMENT_DECLARED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_REJECTED'
  | 'CAUTION_DECLARED'
  | 'CAUTION_CONFIRMED'
  | 'CAUTION_REJECTED'
  | 'CAUTION_RESTITUTED'
  | 'CAUTION_RECEIPT_TRANSMITTED'
  | 'CONTRACT_FINALIZED'
  | 'CONTRACT_TRANSMITTED'
  | 'CONTRACT_SIGNED_BY_TENANT'
  | 'PROPERTY_RENTED'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_UPDATED'
  | 'AVATAR_UPDATED'
  | 'ACCOUNTING_YEAR_UPDATED'
  | 'NEW_MESSAGE'
  | 'THEME_UPDATED'
  | 'NOTIFICATION_CREATED'
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
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_REJECTED':
        window.dispatchEvent(new CustomEvent('locatrust:payments-updated', { detail: payload }));
        break;

      case 'CAUTION_DECLARED':
      case 'CAUTION_CONFIRMED':
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
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated', { detail: payload }));
        break;

      case 'AVATAR_UPDATED':
        if (typeof window !== 'undefined') {
          const newAvatar = payload?.data?.avatarUrl;
          const actorId = payload?.actorId || payload?.data?.userId;
          const senderRole = payload?.data?.role;
          const myId = getCurrentUserId();

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

      case 'CAUTION_RECEIPT_TRANSMITTED':
        if (typeof window !== 'undefined') {
          const q = payload?.data?.quittance;
          const depId = payload?.depositId;
          const senderId = payload?.actorId || 'usr_owner';
          const receiverId = payload?.targetUserId || 'usr_tenant';

          // 1. Ingestion directe dans le registre des reçus du locataire
          if (q && q.receiptNumber) {
            try {
              const curRaw = localStorage.getItem('locatrust_tenant_receipts_v2');
              const cur = curRaw ? JSON.parse(curRaw) : [];
              const filtered = cur.filter((r: any) => r.receiptNumber !== q.receiptNumber);
              localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify([q, ...filtered]));
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

          // 3. Mettre à jour l'état de la caution en 'paye_complet'
          if (depId) {
            try {
              const depsRaw = localStorage.getItem('locatrust_caution_deposits');
              if (depsRaw) {
                const deps = JSON.parse(depsRaw);
                const updatedDeps = deps.map((d: any) => {
                  if (d.id === depId) {
                    return {
                      ...d,
                      status: 'paye_complet',
                      owner_signature: q?.ownerSignatureUrl || d.owner_signature,
                      receipt_sent_to_tenant: true
                    };
                  }
                  return d;
                });
                localStorage.setItem('locatrust_caution_deposits', JSON.stringify(updatedDeps));
              }
            } catch {}
          }

          // 4. Cartes de contacts bidirectionnelles
          try {
            if (q) {
              const ownerCard = {
                id: senderId,
                name: q.ownerName || 'kk',
                role: 'Propriétaire Bailleur',
                propertyTitle: q.propertyTitle,
                phone: q.ownerPhone || '+225 07 00 00 00 00',
                online: true
              };
              const tenantCard = {
                id: receiverId,
                name: q.tenantName || 'christian',
                role: 'Locataire',
                propertyTitle: q.propertyTitle,
                phone: q.tenantPhone || '+225 05 00 00 00 00',
                online: true
              };
              localStorage.setItem(`locatrust_contact_${senderId}`, JSON.stringify(ownerCard));
              localStorage.setItem(`locatrust_contact_${receiverId}`, JSON.stringify(tenantCard));
            }
          } catch {}

          window.dispatchEvent(new CustomEvent('locatrust:receipts_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:cautions_updated', { detail: payload }));
        }
        break;

      case 'NEW_MESSAGE':
        if (typeof window !== 'undefined') {
          const incomingMsg = payload?.data;
          if (incomingMsg && incomingMsg.id) {
            try {
              const msgsRaw = localStorage.getItem('locatrust_chat_messages_v4');
              const curMsgs = msgsRaw ? JSON.parse(msgsRaw) : [];
              const exists = curMsgs.some(
                (m: any) =>
                  m.id === incomingMsg.id ||
                  (m.sender_id === incomingMsg.sender_id &&
                    m.text === incomingMsg.text &&
                    Math.abs(new Date(m.created_at).getTime() - new Date(incomingMsg.created_at).getTime()) < 60000)
              );
              if (!exists) {
                localStorage.setItem('locatrust_chat_messages_v4', JSON.stringify([...curMsgs, incomingMsg]));
              }
            } catch {}

            // Si le message transporte une quittance ou un reçu de caution
            if (incomingMsg.quittance && incomingMsg.quittance.receiptNumber) {
              try {
                const curRaw = localStorage.getItem('locatrust_tenant_receipts_v2');
                const cur = curRaw ? JSON.parse(curRaw) : [];
                const filtered = cur.filter((r: any) => r.receiptNumber !== incomingMsg.quittance.receiptNumber);
                localStorage.setItem('locatrust_tenant_receipts_v2', JSON.stringify([incomingMsg.quittance, ...filtered]));
                window.dispatchEvent(new CustomEvent('locatrust:receipts_updated', { detail: payload }));
              } catch {}
            }
          }
          window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: payload }));
        }
        break;

      case 'THEME_UPDATED':
        if (typeof window !== 'undefined') {
          // Règle stricte : la couleur d'ambiance ne doit JAMAIS changer chez un autre utilisateur
          const myId = getCurrentUserId();
          if (payload.actorId && payload.actorId !== myId) {
            break; // Ignorer le thème choisi par un autre compte
          }
          const themeId = payload?.data?.themeId;
          if (themeId) {
            import('@/lib/themeHelper').then((m) => {
              m.applyAccentTheme(themeId, false);
            });
          }
          if (payload?.data?.theme) {
            const th = payload.data.theme;
            if (th === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            try { localStorage.setItem('locatrust_theme', th); } catch {}
          }
          window.dispatchEvent(new CustomEvent('locatrust:accent-color-changed', { detail: payload?.data }));
        }
        break;

      case 'NOTIFICATION_CREATED':
        if (typeof window !== 'undefined') {
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
        } catch (e) {
          console.warn('Erreur gestion broadcast temps réel:', e);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
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
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rent_payments' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:payments-updated'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cautions' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:cautions_updated'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:contracts-updated'));
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rental_applications' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:messages-updated'));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
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
 * Initialise l'écouteur Supabase Realtime multi-appareils (Desktop ↔ Mobile)
 */
export function subscribeToLiveSync(currentUserId?: string) {
  if (typeof window === 'undefined') return () => {};

  currentActiveUserId = currentUserId;
  initSharedChannel();

  return () => {
    // Garde le canal actif sans le détruire pour assurer la réactivité
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
