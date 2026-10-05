import { Router, type IRouter } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, usersTable, subscriptionsTable, aiUsageCostsTable, featureUsageTable, plansTable } from "@workspace/db";

import { requireAuth } from "../../lib/require-auth";
import { requireAdmin } from "../../lib/require-admin";

const router: IRouter = Router();
router.use(requireAuth, requireAdmin);

router.get("/admin/dashboard", async (_req, res): Promise<void> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [{ count: totalUsers }] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);

  const subscribersByPlanRows = await db
    .select({
      planId: subscriptionsTable.planId,
      planName: plansTable.name,
      count: sql<number>`count(*)::int`,
    })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
    .where(eq(subscriptionsTable.status, "active"))
    .groupBy(subscriptionsTable.planId, plansTable.name);

  const [{ total: estimatedMonthlyRevenueCents }] = await db
    .select({ total: sql<number>`coalesce(sum(${plansTable.priceCents}), 0)::int` })
    .from(subscriptionsTable)
    .innerJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
    .where(eq(subscriptionsTable.status, "active"));

  const [{ total: aiCostMicrosAllTime }] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsageCostsTable.estimatedCostMicros}), 0)::int` })
    .from(aiUsageCostsTable);

  const [{ total: aiCostMicrosLast30Days }] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsageCostsTable.estimatedCostMicros}), 0)::int` })
    .from(aiUsageCostsTable)
    .where(gte(aiUsageCostsTable.createdAt, thirtyDaysAgo));

  const usageByFeatureLast30Days = await db
    .select({ feature: featureUsageTable.feature, count: sql<number>`coalesce(sum(${featureUsageTable.count}), 0)::int` })
    .from(featureUsageTable)
    .where(and(gte(featureUsageTable.periodStart, thirtyDaysAgo)))
    .groupBy(featureUsageTable.feature);

  res.json({
    totalUsers,
    subscribersByPlan: subscribersByPlanRows,
    estimatedMonthlyRevenueCents,
    aiCostMicrosLast30Days,
    aiCostMicrosAllTime,
    usageByFeatureLast30Days,
  });
});

export default router;
