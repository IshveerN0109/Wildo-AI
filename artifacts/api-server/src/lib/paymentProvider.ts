import { eq } from "drizzle-orm";
import { db, subscriptionsTable, type Subscription } from "@workspace/db";

import { getPlan } from "./subscriptionPlans";
import { isStripeConfigured } from "./stripe";

function startOfMonth(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
}

function startOfNextMonth(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}

export interface PaymentProvider {
  readonly name: string;
  /**
   * Returns an active subscription for the student, creating one on the
   * free plan if none exists yet. Never fails for a signed-in student.
   */
  ensureActiveSubscription(userId: string): Promise<Subscription>;
  /**
   * Switches the student onto `planId` immediately. Only valid for
   * zero-cost plans (e.g. moving to/between free tiers, or an admin
   * override) — paid plans must go through routes/subscription/index.ts's
   * checkout flow instead, which only assigns the plan once Stripe
   * confirms payment via webhook. Caller must have already validated
   * `planId` against subscriptionPlans.isKnownPlanId.
   */
  selectPlan(userId: string, planId: string): Promise<Subscription>;
}

/**
 * Auto-enrolls every student on the free plan with no real payment step —
 * used when Stripe isn't configured (no STRIPE_SECRET_KEY secret), so the
 * rest of the product (limits, resets, blocking at the cap) stays fully
 * usable in dev/test without a Stripe account.
 */
class TestPaymentProvider implements PaymentProvider {
  readonly name = "test";

  async ensureActiveSubscription(userId: string): Promise<Subscription> {
    const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

    const now = new Date();
    if (existing && existing.status === "active" && existing.currentPeriodEnd > now) {
      return existing;
    }

    const currentPeriodStart = startOfMonth(now);
    const currentPeriodEnd = startOfNextMonth(now);

    const [subscription] = await db
      .insert(subscriptionsTable)
      .values({
        userId,
        planId: "free",
        status: "active",
        provider: this.name,
        currentPeriodStart,
        currentPeriodEnd,
      })
      .onConflictDoUpdate({
        target: subscriptionsTable.userId,
        set: {
          planId: "free",
          status: "active",
          provider: "test",
          currentPeriodStart,
          currentPeriodEnd,
          updatedAt: now,
        },
      })
      .returning();

    return subscription;
  }

  async selectPlan(userId: string, planId: string): Promise<Subscription> {
    await this.ensureActiveSubscription(userId);
    const plan = await getPlan(planId);

    const [subscription] = await db
      .update(subscriptionsTable)
      .set({ planId: plan.id, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, userId))
      .returning();

    return subscription;
  }
}

/**
 * Real billing via Stripe. Subscription status/period are kept in sync by
 * Stripe webhooks (routes/webhooks/stripe.ts), not fetched from Stripe on
 * every request — ensureActiveSubscription just reads our own DB, which
 * the webhook handler is responsible for keeping current. A student with
 * no subscription row yet (new account) is enrolled on the free plan,
 * exactly like TestPaymentProvider — free never needs a Stripe object.
 */
class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";

  async ensureActiveSubscription(userId: string): Promise<Subscription> {
    const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));

    const now = new Date();
    if (existing && existing.status === "active" && existing.currentPeriodEnd > now) {
      return existing;
    }

    // No row, or a paid period that lapsed without a renewal webhook
    // arriving (e.g. a failed payment) — fall back to a fresh free period
    // rather than leaving the student stuck on an expired paid plan.
    const currentPeriodStart = startOfMonth(now);
    const currentPeriodEnd = startOfNextMonth(now);

    const [subscription] = await db
      .insert(subscriptionsTable)
      .values({
        userId,
        planId: "free",
        status: "active",
        provider: this.name,
        currentPeriodStart,
        currentPeriodEnd,
      })
      .onConflictDoUpdate({
        target: subscriptionsTable.userId,
        set: {
          planId: "free",
          status: "active",
          provider: this.name,
          currentPeriodStart,
          currentPeriodEnd,
          updatedAt: now,
        },
      })
      .returning();

    return subscription;
  }

  async selectPlan(userId: string, planId: string): Promise<Subscription> {
    const plan = await getPlan(planId);
    if (plan.priceCents > 0) {
      throw new Error(
        `"${planId}" is a paid plan — use POST /subscription/checkout to start a Stripe checkout instead of selecting it directly.`,
      );
    }

    await this.ensureActiveSubscription(userId);
    const [subscription] = await db
      .update(subscriptionsTable)
      .set({ planId: plan.id, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, userId))
      .returning();

    return subscription;
  }
}

export const paymentProvider: PaymentProvider = isStripeConfigured()
  ? new StripePaymentProvider()
  : new TestPaymentProvider();
