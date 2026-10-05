import { and, asc, eq } from "drizzle-orm";
import { db, plansTable, type Plan as PlanRow } from "@workspace/db";

export const FEATURES = [
  "tutorMessage",
  "noteGeneration",
  "quizGeneration",
  "flashcardGeneration",
  "oralPractice",
] as const;

export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABELS: Record<Feature, string> = {
  tutorMessage: "AI Tutor questions",
  noteGeneration: "AI note generations",
  quizGeneration: "AI quiz generations",
  flashcardGeneration: "AI flashcard generations",
  oralPractice: "Oral practice evaluations",
};

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  limits: Record<Feature, number>;
  allowsTopups: boolean;
  sortOrder: number;
  isActive: boolean;
}

// Seeded once, the first time any plan is read and the table is still
// empty — lets a fresh DB (new environment, new deploy) work without a
// manual migration step. After that, plans live entirely in the DB and
// are edited through the admin CRM (routes/admin/plans.ts).
const DEFAULT_PLANS: Omit<Plan, "isActive">[] = [
  {
    id: "free",
    name: "Free",
    priceCents: 0,
    allowsTopups: false,
    sortOrder: 0,
    limits: { tutorMessage: 50, noteGeneration: 20, quizGeneration: 20, flashcardGeneration: 20, oralPractice: 15 },
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: 999,
    allowsTopups: false,
    sortOrder: 1,
    limits: { tutorMessage: 150, noteGeneration: 60, quizGeneration: 60, flashcardGeneration: 60, oralPractice: 45 },
  },
  {
    id: "premium",
    name: "Premium",
    priceCents: 2299,
    allowsTopups: true,
    sortOrder: 2,
    limits: { tutorMessage: 400, noteGeneration: 150, quizGeneration: 150, flashcardGeneration: 150, oralPractice: 120 },
  },
];

let seeded = false;

async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  const existing = await db.select({ id: plansTable.id }).from(plansTable).limit(1);
  if (existing.length === 0) {
    await db
      .insert(plansTable)
      .values(DEFAULT_PLANS.map((p) => ({ ...p, isActive: true })))
      .onConflictDoNothing();
  }
  seeded = true;
}

function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.priceCents,
    limits: row.limits as Record<Feature, number>,
    allowsTopups: row.allowsTopups,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

/** Falls back to the Free plan's shape if `planId` doesn't resolve to a row at all (should not happen once seeded). */
function fallbackPlan(): Plan {
  const free = DEFAULT_PLANS[0]!;
  return { ...free, isActive: true };
}

export async function getPlan(planId: string): Promise<Plan> {
  await ensureSeeded();
  const [row] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (row) return toPlan(row);
  const [free] = await db.select().from(plansTable).where(eq(plansTable.id, "free"));
  return free ? toPlan(free) : fallbackPlan();
}

export async function isKnownPlanId(planId: string): Promise<boolean> {
  await ensureSeeded();
  const [row] = await db
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(and(eq(plansTable.id, planId), eq(plansTable.isActive, true)));
  return !!row;
}

/** Active plans only, in display order — what students see on /plans. */
export async function listPlans(): Promise<Plan[]> {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.isActive, true))
    .orderBy(asc(plansTable.sortOrder));
  return rows.map(toPlan);
}

// ─── Admin CRM ───────────────────────────────────────────────────────────

/** Every plan including inactive ones — admin plan editor only. */
export async function listAllPlansForAdmin(): Promise<Plan[]> {
  await ensureSeeded();
  const rows = await db.select().from(plansTable).orderBy(asc(plansTable.sortOrder));
  return rows.map(toPlan);
}

export interface PlanUpdateInput {
  name?: string;
  priceCents?: number;
  limits?: Partial<Record<Feature, number>>;
  allowsTopups?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export async function updatePlanAdmin(planId: string, input: PlanUpdateInput): Promise<Plan> {
  await ensureSeeded();
  const [existing] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!existing) {
    throw new Error(`Plan "${planId}" does not exist.`);
  }

  const mergedLimits = input.limits ? { ...(existing.limits as Record<Feature, number>), ...input.limits } : existing.limits;

  const [updated] = await db
    .update(plansTable)
    .set({
      name: input.name ?? existing.name,
      priceCents: input.priceCents ?? existing.priceCents,
      limits: mergedLimits,
      allowsTopups: input.allowsTopups ?? existing.allowsTopups,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(plansTable.id, planId))
    .returning();

  return toPlan(updated);
}
