export interface CheckoutSessionOptions {
  subscriptionId: string;
  tier: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
}

export interface CheckoutResult {
  sessionId: string;
  redirectUrl: string;
  gateway: 'stripe' | 'cinetpay';
}

export interface PaymentGateway {
  name: 'stripe' | 'cinetpay';
  createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
