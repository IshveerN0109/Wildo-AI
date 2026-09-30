import { Router, type IRouter } from "express";

import { requireAuth } from "../../lib/require-auth";
import { getUsageSummary } from "../../lib/quota";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/subscription", async (req, res): Promise<void> => {
  const summary = await getUsageSummary(req.user!.id);
  res.json(summary);
});

export default router;
