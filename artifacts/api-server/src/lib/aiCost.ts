import { db, aiUsageCostsTable } from "@workspace/db";
import type { Feature } from "./subscriptionPlans";
import { logger } from "./logger";

// $ per 1,000,000 tokens. Update when a provider changes pricing — this is
// an internal estimate for the admin dashboard, not what's actually billed
// by the provider (their invoice is authoritative).
const PRICING: Record<string, { prompt: number; completion: number }> = {
  "openai:gpt-4o": { prompt: 2.5, completion: 10 },
  "deepseek:deepseek-chat": { prompt: 0.27, completion: 1.1 },
  "deepseek:deepseek-reasoner": { prompt: 0.55, completion: 2.19 },
  "gemini:gemini-2.5-flash": { prompt: 0.075, completion: 0.3 },
  "gemini:gemini-2.5-pro": { prompt: 1.25, completion: 5 },
};

const DEFAULT_PRICING = { prompt: 1, completion: 3 }; // conservative fallback for an unlisted model

export interface RecordAiUsageInput {
  userId: string;
  feature: Feature;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Logs what Wildo paid the AI provider for one request. Kept in a table
 * separate from subscriptions/feature_usage (what the student is entitled
 * to) and never surfaced to students — this is an internal COGS ledger the
 * admin dashboard reads to compute margin = revenue - AI cost - infra.
 * Failures here must never break the feature that triggered them.
 */
export async function recordAiUsage(input: RecordAiUsageInput): Promise<void> {
  try {
    const pricing = PRICING[`${input.provider}:${input.model}`] ?? DEFAULT_PRICING;
    const estimatedCostMicros = Math.round(
      (input.promptTokens / 1_000_000) * pricing.prompt * 1_000_000 +
        (input.completionTokens / 1_000_000) * pricing.completion * 1_000_000,
    );

    await db.insert(aiUsageCostsTable).values({
      userId: input.userId,
      feature: input.feature,
      provider: input.provider,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      estimatedCostMicros,
    });
  } catch (err) {
    logger.error({ err, input }, "Failed to record AI usage cost");
  }
}
