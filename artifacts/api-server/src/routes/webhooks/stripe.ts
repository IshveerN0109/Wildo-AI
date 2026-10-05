import type { Request, Response } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, creditTopupsTable, creditPacksTable } from "@workspace/db";

import { getStripe, getWebhookSecret } from "../../lib/stripe";
import { logger } from "../../lib/logger";

async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata.userId;
  const planId = subscription.metadata.planId;
  if (!userId || !planId) {
    logger.warn({ subscriptionId: subscription.id }, "Stripe subscription missing userId/planId metadata");
    return;
  }

  const item = subscription.items.data[0];
  const currentPeriodStart = item ? new Date(item.current_period_start * 1000) : new Date();
  const currentPeriodEnd = item ? new Date(item.current_period_end * 1000) : new Date();

  // active/trialing count as usable; everything else (past_due, canceled,
  // unpaid, incomplete, incomplete_expired, paused) falls the student back
  // to free the next time ensureActiveSubscription runs.
  const status = subscription.status === "active" || subscription.status === "trialing" ? "active" : subscription.status;

  await db
    .insert(subscriptionsTable)
    .values({
      userId,
      planId,
      status,
      provider: "stripe",
      providerCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      providerSubscriptionId: subscription.id,
      currentPeriodStart,
      currentPeriodEnd,
    })
    .onConflictDoUpdate({
      target: subscriptionsTable.userId,
      set: {
        planId,
        status,
        provider: "stripe",
        providerCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
        providerSubscriptionId: subscription.id,
        currentPeriodStart,
        currentPeriodEnd,
        updatedAt: new Date(),
      },
    });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const stripe = getStripe();

  if (session.mode === "subscription" && session.subscription) {
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscriptionFromStripe(subscription);
    return;
  }

  if (session.mode === "payment") {
    // A credit-pack top-up purchase.
    const userId = session.metadata?.userId;
    const creditPackId = session.metadata?.creditPackId ? Number(session.metadata.creditPackId) : null;
    if (!userId || !creditPackId) {
      logger.warn({ sessionId: session.id }, "Stripe top-up checkout missing userId/creditPackId metadata");
      return;
    }

    const [pack] = await db.select().from(creditPacksTable).where(eq(creditPacksTable.id, creditPackId));
    if (!pack) {
      logger.warn({ creditPackId }, "Stripe top-up checkout referenced an unknown credit pack");
      return;
    }

    const [subscription] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
    if (!subscription) {
      logger.warn({ userId }, "Stripe top-up checkout completed for a user with no subscription row");
      return;
    }

    await db.insert(creditTopupsTable).values({
      userId,
      feature: pack.feature,
      amount: pack.amount,
      periodStart: subscription.currentPeriodStart,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    });
  }
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  const signature = req.headers["stripe-signature"];

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature as string, getWebhookSecret());
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.created":
        await syncSubscriptionFromStripe(event.data.object);
        break;
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata.userId;
        if (userId) {
          await db
            .update(subscriptionsTable)
            .set({ status: "canceled", updatedAt: new Date() })
            .where(eq(subscriptionsTable.userId, userId));
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Failed to process Stripe webhook event");
    // Stripe retries on non-2xx; 500 here is intentional so a transient DB
    // error gets retried instead of silently dropping the event.
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }

  res.json({ received: true });
}
