import { and, eq, sql } from "drizzle-orm";
import { db, featureUsageTable } from "@workspace/db";

import { paymentProvider } from "./paymentProvider";
import { FEATURE_LABELS, getPlan, type Feature } from "./subscriptionPlans";

export class QuotaExceededError extends Error {
  constructor(
    public readonly feature: Feature,
    public readonly limit: number,
    public readonly used: number,
  ) {
    super(`You've used all ${limit} ${FEATURE_LABELS[feature]} included this month.`);
    this.name = "QuotaExceededError";
  }
}

export interface QuotaResult {
  feature: Feature;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Atomically checks and increments a student's usage for `feature` within
 * their current subscription billing period, and throws QuotaExceededError
 * if they're already at their plan's limit.
 *
 * Race-safe under concurrent requests: the increment is a single
 * `INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit` statement, so
 * only requests that arrive while the student is still under the limit can
 * ever succeed — Postgres serializes conflicting writes to the same row.
 */
export async function consumeQuota(userId: string, feature: Feature): Promise<QuotaResult> {
  const subscription = await paymentProvider.ensureActiveSubscription(userId);
  const plan = getPlan(subscription.planId);
  const limit = plan.limits[feature];

  const [row] = await db
    .insert(featureUsageTable)
    .values({
      userId,
      feature,
      periodStart: subscription.currentPeriodStart,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [featureUsageTable.userId, featureUsageTable.feature, featureUsageTable.periodStart],
      set: { count: sql`${featureUsageTable.count} + 1`, updatedAt: new Date() },
      setWhere: sql`${featureUsageTable.count} < ${limit}`,
    })
    .returning();

  if (!row) {
    // The conflicting row exists but the setWhere condition failed —
    // the student is already at their limit for this period.
    throw new QuotaExceededError(feature, limit, limit);
  }

  return { feature, used: row.count, limit, remaining: Math.max(0, limit - row.count) };
}

export interface UsageSummary {
  planId: string;
  planName: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  usage: QuotaResult[];
}

/** Read-only usage snapshot for the student's current period. Does not consume quota. */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const subscription = await paymentProvider.ensureActiveSubscription(userId);
  const plan = getPlan(subscription.planId);

  const rows = await db
    .select()
    .from(featureUsageTable)
    .where(
      and(eq(featureUsageTable.userId, userId), eq(featureUsageTable.periodStart, subscription.currentPeriodStart)),
    );

  const usedByFeature = new Map(rows.map((r) => [r.feature as Feature, r.count]));

  const usage: QuotaResult[] = (Object.keys(plan.limits) as Feature[]).map((feature) => {
    const limit = plan.limits[feature];
    const used = usedByFeature.get(feature) ?? 0;
    return { feature, used, limit, remaining: Math.max(0, limit - used) };
  });

  return {
    planId: plan.id,
    planName: plan.name,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    usage,
  };
}
