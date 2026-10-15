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
  | 'APPLICATION_UPDATED';

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

function getSharedChannel() {
  if (!sharedLiveChannel) {
    sharedLiveChannel = supabase.channel(GLOBAL_REALTIME_CHANNEL, {
      config: {
        broadcast: { self: false }
      }
    });
  }
  return sharedLiveChannel;
}

/**
 * Diffuse un événement temps réel sur tous les appareils connectés (PC ↔ Mobile ↔ Tablette)
 * via le canal Supabase Realtime Broadcast.
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
    const channel = getSharedChannel();
    if (channel.state !== 'joined') {
      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR') resolve();
        });
        setTimeout(resolve, 400);
      });
    }

    await channel.send({
      type: 'broadcast',
      event: 'locatrust_event',
      payload: fullPayload
    });
  } catch (err) {
    console.warn('Realtime broadcast error:', err);
  }

  // Déclencher également l'événement local immédiatement sur la fenêtre active
  dispatchDomEventForType(event, fullPayload);
}

function dispatchDomEventForType(event: LiveEventType, payload?: BroadcastPayload) {
  if (typeof window === 'undefined') return;

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
  }
}

/**
 * Initialise l'écouteur Supabase Realtime multi-appareils (Desktop ↔ Mobile)
 * Écoute à la fois les Broadcasts instantanés et les modifications directes Postgres.
 */
export function subscribeToLiveSync(currentUserId?: string) {
  if (typeof window === 'undefined') return () => {};

  const channel = getSharedChannel();

  channel
    .on('broadcast', { event: 'locatrust_event' }, ({ payload }: { payload: BroadcastPayload }) => {
      // Ignorer uniquement si l'événement vise explicitement un autre compte différent
      if (payload.targetUserId && currentUserId && payload.targetUserId !== currentUserId && payload.actorId !== currentUserId) {
        return;
      }
      console.log('⚡ Événement temps réel reçu depuis un autre appareil:', payload.event, payload);
      dispatchDomEventForType(payload.event, payload);
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rent_payments' },
      () => {
        window.dispatchEvent(new CustomEvent('locatrust:payments-updated'));
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cautions' },
      () => {
        window.dispatchEvent(new CustomEvent('locatrust:cautions_updated'));
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contracts' },
      () => {
        window.dispatchEvent(new CustomEvent('locatrust:contracts-updated'));
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'properties' },
      () => {
        window.dispatchEvent(new CustomEvent('locatrust:properties-updated'));
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rental_applications' },
      () => {
        window.dispatchEvent(new CustomEvent('locatrust:applications-updated'));
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      () => {
        window.dispatchEvent(new CustomEvent('locatrust:messages-updated'));
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      () => {
        window.dispatchEvent(new CustomEvent('locatrust:notifications-updated'));
      }
    );

  if (channel.state !== 'joined') {
    channel.subscribe();
  }

  return () => {
    // Keep shared channel alive across view changes
  };
}
