import type { NextFunction, Request, Response } from "express";

import { consumeQuota, QuotaExceededError } from "./quota";
import type { Feature } from "./subscriptionPlans";

/**
 * Consumes one unit of `feature` quota for the signed-in student before
 * letting the request through. Must run after `requireAuth`. Responds 402
 * with a student-readable message if the student is already at their
 * plan's monthly limit for this feature.
 */
export function requireQuota(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await consumeQuota(req.user!.id, feature);
      res.setHeader("X-Quota-Feature", feature);
      res.setHeader("X-Quota-Limit", String(result.limit));
      res.setHeader("X-Quota-Remaining", String(result.remaining));
      next();
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        res.status(402).json({
          error: err.message,
          code: "quota_exceeded",
          feature: err.feature,
          limit: err.limit,
          used: err.used,
        });
        return;
      }
      next(err);
    }
  };
}
