import { Router, type IRouter } from "express";

import { requireAuth } from "../../lib/require-auth";
import { getUsageSummary, selectPlan, UnknownPlanError } from "../../lib/quota";
import { listPlans, type Feature } from "../../lib/subscriptionPlans";
import { SelectSubscriptionPlanBody } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/subscription", async (req, res): Promise<void> => {
  const summary = await getUsageSummary(req.user!.id);
  res.json(summary);
});

router.get("/subscription/plans", async (_req, res): Promise<void> => {
  const plans = listPlans().map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceCents: plan.priceCents,
    limits: (Object.keys(plan.limits) as Feature[]).map((feature) => ({
      feature,
      limit: plan.limits[feature],
    })),
  }));
  res.json(plans);
});

router.post("/subscription/select-plan", async (req, res): Promise<void> => {
  const parsed = SelectSubscriptionPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const summary = await selectPlan(req.user!.id, parsed.data.planId);
    res.json(summary);
  } catch (err) {
    if (err instanceof UnknownPlanError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
