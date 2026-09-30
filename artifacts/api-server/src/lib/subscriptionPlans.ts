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

// Every student is auto-enrolled on this plan while there is no real payment
// provider wired up (see paymentProvider.ts). Add paid plans here once
// billing goes live — the quota service only needs a plan's `limits`.
export const FREE_TEST_PLAN: Plan = {
  id: "free_test",
  name: "Free (Test)",
  limits: {
    tutorMessage: 50,
    noteGeneration: 20,
    quizGeneration: 20,
    flashcardGeneration: 20,
    oralPractice: 15,
  },
};

const PLANS: Record<string, Plan> = {
  [FREE_TEST_PLAN.id]: FREE_TEST_PLAN,
};

export function getPlan(planId: string): Plan {
  return PLANS[planId] ?? FREE_TEST_PLAN;
}
