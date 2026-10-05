import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, creditPacksTable } from "@workspace/db";
import { AdminCreateCreditPackBody, AdminUpdateCreditPackBody } from "@workspace/api-zod";

import { requireAuth } from "../../lib/require-auth";
import { requireAdmin } from "../../lib/require-admin";

const router: IRouter = Router();
router.use(requireAuth, requireAdmin);

router.get("/admin/credit-packs", async (_req, res): Promise<void> => {
  const packs = await db.select().from(creditPacksTable);
  res.json(packs);
});

router.post("/admin/credit-packs", async (req, res): Promise<void> => {
  const parsed = AdminCreateCreditPackBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.feature || !parsed.data.label || parsed.data.amount == null || parsed.data.priceCents == null) {
    res.status(400).json({ error: "feature, label, amount, and priceCents are required" });
    return;
  }

  const [pack] = await db
    .insert(creditPacksTable)
    .values({
      feature: parsed.data.feature,
      label: parsed.data.label,
      amount: parsed.data.amount,
      priceCents: parsed.data.priceCents,
      isActive: parsed.data.isActive ?? true,
    })
    .returning();
  res.status(201).json(pack);
});

router.put("/admin/credit-packs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = AdminUpdateCreditPackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(creditPacksTable).where(eq(creditPacksTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Unknown credit pack" });
    return;
  }

  const [updated] = await db
    .update(creditPacksTable)
    .set({
      feature: parsed.data.feature ?? existing.feature,
      label: parsed.data.label ?? existing.label,
      amount: parsed.data.amount ?? existing.amount,
      priceCents: parsed.data.priceCents ?? existing.priceCents,
      isActive: parsed.data.isActive ?? existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(creditPacksTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/admin/credit-packs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(creditPacksTable).where(eq(creditPacksTable.id, id)).returning({ id: creditPacksTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Unknown credit pack" });
    return;
  }
  res.sendStatus(204);
});

export default router;
