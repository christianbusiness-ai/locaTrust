import { PaymentGateway, CheckoutSessionOptions, CheckoutResult } from './gateway.interface';

export class CinetPayGateway implements PaymentGateway {
  name: 'cinetpay' = 'cinetpay';

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutResult> {
    console.log(`[CinetPay Mobile Money] Inscription abonnement ${options.tier} pour ${options.customerEmail} (${options.amount} FCFA)`);
    return {
      sessionId: `cnet_sub_${Date.now()}`,
      redirectUrl: `${options.returnUrl}?status=success&gateway=cinetpay&sub_id=${options.subscriptionId}`,
      gateway: 'cinetpay',
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    return signature.length > 10;
  }
}
