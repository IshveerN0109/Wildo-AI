import { eq } from "drizzle-orm";
import { db, subscriptionsTable, type Subscription } from "@workspace/db";

import { FREE_PLAN } from "./subscriptionPlans";

function startOfMonth(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
}

function startOfNextMonth(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}

export interface PaymentProvider {
  readonly name: string;
  /**
   * Returns an active subscription for the student, creating one or
   * rolling it over to a fresh billing period if needed. Never fails for a
   * signed-in student. A real provider (e.g. Stripe) would instead read
   * back whatever period/status the payment gateway reports.
   */
  ensureActiveSubscription(userId: string): Promise<Subscription>;
}

/**
 * Auto-enrolls every student on the free plan with no real payment step —
 * there's no money involved yet, so there's nothing to charge or fail. The
 * rest of the product (limits, resets, blocking at the cap) behaves exactly
 * as it will once billing is live — this class is the only stand-in piece.
 *
 * This is the one seam to swap out once billing goes live: implement a
 * StripePaymentProvider (reading Stripe's subscription status and billing
 * period) and change the `paymentProvider` export below. Nothing in
 * quota.ts or any route needs to change.
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
        planId: FREE_PLAN.id,
        status: "active",
        provider: this.name,
        currentPeriodStart,
        currentPeriodEnd,
      })
      .onConflictDoUpdate({
        target: subscriptionsTable.userId,
        set: {
          planId: FREE_PLAN.id,
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
}

export const paymentProvider: PaymentProvider = new TestPaymentProvider();
