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
  limits: Record<Feature, number>;
}

// The one real plan students are enrolled on today. Every student is
// auto-enrolled on it with no payment step, since there's no payment
// provider wired up yet (see paymentProvider.ts) — but the limits below are
// enforced exactly as they will be in production. Once billing goes live,
// add paid plans here and have the payment provider assign them instead.
export const FREE_PLAN: Plan = {
  id: "free",
  name: "Free",
  limits: {
    tutorMessage: 50,
    noteGeneration: 20,
    quizGeneration: 20,
    flashcardGeneration: 20,
    oralPractice: 15,
  },
};

const PLANS: Record<string, Plan> = {
  [FREE_PLAN.id]: FREE_PLAN,
};

export function getPlan(planId: string): Plan {
  return PLANS[planId] ?? FREE_PLAN;
}
