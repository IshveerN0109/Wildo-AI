import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

import { usersTable } from "./auth";

// Internal cost ledger: what Wildo pays the AI provider per request — kept
// completely separate from subscriptions/feature_usage (what the student
// is entitled to) and from Stripe revenue records (what the student pays).
// Never surfaced to students; read only by the admin dashboard to compute
// margin = revenue - AI cost - infra.
export const aiUsageCostsTable = pgTable("ai_usage_costs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  provider: text("provider").notNull(), // openai | deepseek | gemini
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  // Millionths of a dollar (1,000,000 = $1.00) — avoids floating point for
  // very small per-request costs while staying human-readable enough.
  estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AiUsageCost = typeof aiUsageCostsTable.$inferSelect;
export type InsertAiUsageCost = typeof aiUsageCostsTable.$inferInsert;
