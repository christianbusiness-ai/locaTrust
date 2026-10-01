import { PaymentGateway, CheckoutSessionOptions, CheckoutResult } from './gateway.interface';

export class StripePaymentGateway implements PaymentGateway {
  name: 'stripe' = 'stripe';

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutResult> {
    console.log(`[Stripe] Inscription abonnement ${options.tier} pour ${options.customerEmail} (${options.amount} FCFA)`);
    return {
      sessionId: `str_sub_${Date.now()}`,
      redirectUrl: `${options.returnUrl}?status=success&gateway=stripe&sub_id=${options.subscriptionId}`,
      gateway: 'stripe',
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return signature.startsWith('t=') && payload.length > 0;
  }
}
