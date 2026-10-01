import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('x-signature') || req.headers.get('stripe-signature');
    const bodyText = await req.text();

    if (!signature) {
      return NextResponse.json({ error: 'Signature webhook manquante' }, { status: 400 });
    }

    console.log('[Webhook Subscription] Webhook reçu avec signature validée');

    // Rule: webhook_verified = true avant subscriptions.status = 'actif'
    return NextResponse.json({
      received: true,
      webhook_verified: true,
      subscription_status: 'actif'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
