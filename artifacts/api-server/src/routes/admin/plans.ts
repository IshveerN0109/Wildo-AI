import { Router, type IRouter } from "express";
import { AdminUpdatePlanBody } from "@workspace/api-zod";

import { requireAuth } from "../../lib/require-auth";
import { requireAdmin } from "../../lib/require-admin";
import { listAllPlansForAdmin, updatePlanAdmin, type Feature } from "../../lib/subscriptionPlans";

const router: IRouter = Router();
router.use(requireAuth, requireAdmin);

function serialize(plan: Awaited<ReturnType<typeof listAllPlansForAdmin>>[number]) {
  return {
    id: plan.id,
    name: plan.name,
    priceCents: plan.priceCents,
    allowsTopups: plan.allowsTopups,
    sortOrder: plan.sortOrder,
    isActive: plan.isActive,
    limits: (Object.keys(plan.limits) as Feature[]).map((feature) => ({ feature, limit: plan.limits[feature] })),
  };
}

router.get("/admin/plans", async (_req, res): Promise<void> => {
  const plans = await listAllPlansForAdmin();
  res.json(plans.map(serialize));
});

router.put("/admin/plans/:id", async (req, res): Promise<void> => {
  const parsed = AdminUpdatePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const plan = await updatePlanAdmin(req.params.id, parsed.data as Parameters<typeof updatePlanAdmin>[1]);
    res.json(serialize(plan));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Plan not found" });
  }
});

export default router;
