import type { NextFunction, Request, Response } from "express";

/**
 * Must run after requireAuth. Responds 403 unless the signed-in user's
 * isAdmin flag is set (derived from ADMIN_EMAILS at login — see
 * routes/auth.ts upsertUser).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated() || !req.user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
