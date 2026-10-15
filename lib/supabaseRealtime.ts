import { supabase } from '@/src/lib/supabase';

export type LiveEventType =
  | 'PAYMENT_DECLARED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_REJECTED'
  | 'CAUTION_DECLARED'
  | 'CAUTION_CONFIRMED'
  | 'CAUTION_REJECTED'
  | 'CAUTION_RESTITUTED'
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
  | 'NOTIFICATION_CREATED';

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
          if (newAvatar) {
            try { localStorage.setItem('locatrust_user_avatar', newAvatar); } catch {}
          }
          window.dispatchEvent(new CustomEvent('locatrust:avatar_updated', { detail: { avatarUrl: newAvatar } }));
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

      case 'NEW_MESSAGE':
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('locatrust:messages_updated', { detail: payload }));
          window.dispatchEvent(new CustomEvent('locatrust:messages-updated', { detail: payload }));
        }
        break;

      case 'THEME_UPDATED':
        if (typeof window !== 'undefined') {
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
