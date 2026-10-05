import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, creditPacksTable } from "@workspace/db";

import { requireAuth } from "../../lib/require-auth";
import { getUsageSummary, selectPlan, UnknownPlanError } from "../../lib/quota";
import { getPlan, listPlans, type Feature } from "../../lib/subscriptionPlans";
import { getStripe, isStripeConfigured } from "../../lib/stripe";
import {
  SelectSubscriptionPlanBody,
  CreateSubscriptionCheckoutBody,
  CreateTopupCheckoutBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
router.use(requireAuth);

function getOrigin(req: { headers: Record<string, string | string[] | undefined> }): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${String(proto)}://${String(host)}`;
}

router.get("/subscription", async (req, res): Promise<void> => {
  const summary = await getUsageSummary(req.user!.id);
  res.json(summary);
});

router.get("/subscription/plans", async (_req, res): Promise<void> => {
  const plans = await listPlans();
  res.json(
    plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      priceCents: plan.priceCents,
      allowsTopups: plan.allowsTopups,
      limits: (Object.keys(plan.limits) as Feature[]).map((feature) => ({
        feature,
        limit: plan.limits[feature],
      })),
    })),
  );
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

router.post("/subscription/checkout", async (req, res): Promise<void> => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Payments are not configured yet." });
    return;
  }

  const parsed = CreateSubscriptionCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const plan = await getPlan(parsed.data.planId);
  if (plan.priceCents <= 0) {
    res.status(400).json({ error: "This plan is free — use select-plan instead of checkout." });
    return;
  }

  const stripe = getStripe();
  const userId = req.user!.id;
  const email = req.user!.email ?? undefined;

  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  let customerId = existing?.providerCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
  }

  const origin = getOrigin(req);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: plan.priceCents,
          recurring: { interval: "month" },
          product_data: { name: `Wildo ${plan.name} plan` },
        },
        quantity: 1,
      },
    ],
    subscription_data: { metadata: { userId, planId: plan.id } },
    success_url: `${origin}/plans?checkout=success`,
    cancel_url: `${origin}/plans?checkout=canceled`,
  });

  if (!session.url) {
    res.status(500).json({ error: "Stripe did not return a checkout URL." });
    return;
  }
  res.json({ url: session.url });
});

router.get("/subscription/portal", async (req, res): Promise<void> => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Payments are not configured yet." });
    return;
  }

  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, req.user!.id));

  if (!existing?.providerCustomerId) {
    res.status(400).json({ error: "No billing account yet — upgrade to a paid plan first." });
    return;
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: existing.providerCustomerId,
    return_url: `${getOrigin(req)}/profile`,
  });
  res.json({ url: session.url });
});

router.get("/subscription/credit-packs", async (_req, res): Promise<void> => {
  const packs = await db.select().from(creditPacksTable).where(eq(creditPacksTable.isActive, true));
  res.json(
    packs.map((p) => ({ id: p.id, feature: p.feature, label: p.label, amount: p.amount, priceCents: p.priceCents })),
  );
});

router.post("/subscription/topup/checkout", async (req, res): Promise<void> => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Payments are not configured yet." });
    return;
  }

  const parsed = CreateTopupCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.id;
  const summary = await getUsageSummary(userId);
  if (!summary.allowsTopups) {
    res.status(403).json({ error: "Your current plan does not allow purchasing extra credits. Upgrade first." });
    return;
  }

  const [pack] = await db
    .select()
    .from(creditPacksTable)
    .where(eq(creditPacksTable.id, parsed.data.creditPackId));
  if (!pack || !pack.isActive) {
    res.status(400).json({ error: "Unknown credit pack." });
    return;
  }

  const stripe = getStripe();
  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  let customerId = existing?.providerCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: req.user!.email ?? undefined, metadata: { userId } });
    customerId = customer.id;
  }

  const origin = getOrigin(req);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: { name: `Wildo credit pack — ${pack.label}` },
        },
        quantity: 1,
      },
    ],
    metadata: { userId, creditPackId: String(pack.id) },
    success_url: `${origin}/plans?topup=success`,
    cancel_url: `${origin}/plans?topup=canceled`,
  });

  if (!session.url) {
    res.status(500).json({ error: "Stripe did not return a checkout URL." });
    return;
  }
  res.json({ url: session.url });
});

export default router;
