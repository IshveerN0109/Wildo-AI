import Stripe from "stripe";

// Lazy, same reasoning as the AI clients in lib/integrations-openai-ai-server:
// this module is reached from routes loaded at server startup, so an eager
// throw for a missing STRIPE_SECRET_KEY would crash the whole app instead of
// just the checkout/webhook endpoints. Absent the key, payment routes fail
// cleanly per-request and the app falls back to TestPaymentProvider (see
// paymentProvider.ts) so the rest of the product keeps working.
let client: Stripe | undefined;

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  if (client) return client;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY must be set. Please add it to secrets.");
  }
  client = new Stripe(apiKey);
  return client;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET must be set. Please add it to secrets.");
  }
  return secret;
}
