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
  /** Display-only. Nothing is ever charged until a real payment provider is wired up. */
  priceCents: number;
  limits: Record<Feature, number>;
}

// Every student is auto-enrolled on this plan with no payment step, since
// there's no payment provider wired up yet (see paymentProvider.ts) — but
// the limits below are enforced exactly as they will be in production.
export const FREE_PLAN: Plan = {
  id: "free",
  name: "Free",
  priceCents: 0,
  limits: {
    tutorMessage: 50,
    noteGeneration: 20,
    quizGeneration: 20,
    flashcardGeneration: 20,
    oralPractice: 15,
  },
};

// Selectable today via POST /subscription/select-plan — switches a student
// onto it immediately, for free, since there's no payment step yet. Once
// billing goes live, plan selection should instead kick off a real
// checkout with the payment provider before this plan is assigned.
export const PRO_PLAN: Plan = {
  id: "pro",
  name: "Pro",
  priceCents: 999, // $9.99/mo — placeholder until real pricing is set
  limits: {
    tutorMessage: 150,
    noteGeneration: 60,
    quizGeneration: 60,
    flashcardGeneration: 60,
    oralPractice: 45,
  },
};

const PLANS_IN_ORDER: Plan[] = [FREE_PLAN, PRO_PLAN];
const PLANS: Record<string, Plan> = Object.fromEntries(PLANS_IN_ORDER.map((p) => [p.id, p]));

export function getPlan(planId: string): Plan {
  return PLANS[planId] ?? FREE_PLAN;
}

export function isKnownPlanId(planId: string): boolean {
  return planId in PLANS;
}

export function listPlans(): Plan[] {
  return PLANS_IN_ORDER;
}
